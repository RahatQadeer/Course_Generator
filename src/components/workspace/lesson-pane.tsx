"use client";

import { LessonBody } from "@/components/course/lesson-body";
import { QuizView } from "@/components/course/quiz-view";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Segmented } from "@/components/ui/primitives";
import { BlockEditor } from "@/components/workspace/block-editor";
import { EditableList, EditableText } from "@/components/workspace/editable";
import { ImproveMenu } from "@/components/workspace/improve-menu";
import type { ImproveAction } from "@/lib/ai/improve-actions";
import type { Lesson, Module } from "@/lib/schema/course";
import { formatMinutes } from "@/lib/utils";
import { Eye, FileText, ListChecks, Pencil, RefreshCw, Sparkles } from "lucide-react";
import * as React from "react";

export function LessonPane({
  lesson,
  module,
  moduleIndex,
  lessonIndex,
  onPatch,
  onRegenerate,
  onImprove,
  onRegenerateQuiz,
  busy,
}: {
  lesson: Lesson;
  module: Module;
  moduleIndex: number;
  lessonIndex: number;
  onPatch: (patch: Partial<Lesson>) => void;
  onRegenerate: () => void;
  onImprove: (action: ImproveAction | string) => void;
  onRegenerateQuiz: () => void;
  busy: boolean;
}) {
  const [mode, setMode] = React.useState<"read" | "edit">("read");

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <div className="mb-1.5 flex items-center gap-2 text-[12px] text-[var(--ink-faint)]">
        <span>
          Module {moduleIndex + 1} · {module.title}
        </span>
        <span aria-hidden>›</span>
        <span>Lesson {lessonIndex + 1}</span>
      </div>

      <EditableText
        as="h1"
        className="text-[28px] leading-[1.2] font-semibold tracking-[-0.03em] text-[var(--ink)]"
        value={lesson.title}
        onCommit={(title) => onPatch({ title })}
        placeholder="Untitled lesson"
        multiline={false}
        disabled={busy}
      />

      <EditableText
        className="mt-1 text-[14.5px] leading-relaxed text-[var(--ink-soft)]"
        value={lesson.summary}
        onCommit={(summary) => onPatch({ summary })}
        placeholder="Add a one-line summary"
        disabled={busy}
      />

      <div className="mt-4 mb-6 flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-4">
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "read", label: "Read", icon: <Eye className="size-3.5" /> },
            { value: "edit", label: "Edit", icon: <Pencil className="size-3.5" /> },
          ]}
        />
        <div className="flex-1" />
        <ImproveMenu onSelect={onImprove} disabled={busy} />
        <Button variant="secondary" size="sm" onClick={onRegenerate} disabled={busy}>
          <RefreshCw />
          Regenerate
        </Button>
      </div>

      {lesson.status === "failed" && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-3 text-[13px] text-[var(--ink)]">
          This lesson failed to generate. Use <strong>Regenerate</strong> to write it.
        </div>
      )}

      {mode === "read" ? (
        lesson.content.length ? (
          <LessonBody lesson={lesson} />
        ) : (
          <EmptyState
            icon={<FileText />}
            title="This lesson has no content yet"
            description="Generate it with AI, or switch to Edit and write it yourself."
            action={
              <Button variant="primary" size="sm" onClick={onRegenerate} disabled={busy}>
                <Sparkles />
                Write this lesson
              </Button>
            }
          />
        )
      ) : (
        <div className="space-y-7">
          <Section title="Learning objectives">
            <EditableList
              items={lesson.learningObjectives}
              onChange={(learningObjectives) => onPatch({ learningObjectives })}
              placeholder="Add an objective"
            />
          </Section>

          <Section title="Introduction">
            <EditableText
              className="text-[15px] leading-[1.7] text-[var(--ink)]"
              value={lesson.introduction}
              onCommit={(introduction) => onPatch({ introduction })}
              placeholder="Open with the problem this lesson solves…"
            />
          </Section>

          <Section title="Content">
            <BlockEditor blocks={lesson.content} onChange={(content) => onPatch({ content })} />
          </Section>

          <Section title="Key takeaways">
            <EditableList
              items={lesson.keyTakeaways}
              onChange={(keyTakeaways) => onPatch({ keyTakeaways })}
              placeholder="Add a takeaway"
            />
          </Section>

          <Section title="Duration">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={240}
                value={lesson.durationMinutes}
                onChange={(event) =>
                  onPatch({ durationMinutes: Math.max(1, Number(event.target.value) || 1) })
                }
                className="focus-ring w-20 rounded-[6px] border border-[var(--line-strong)] bg-[var(--surface)] px-2 py-1.5 text-[13px]"
              />
              <span className="text-[13px] text-[var(--ink-faint)]">
                minutes · {formatMinutes(lesson.durationMinutes)}
              </span>
            </div>
          </Section>
        </div>
      )}

      {/* Quiz ------------------------------------------------------------- */}
      <div className="mt-10 border-t border-[var(--line)] pt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-[var(--ink-faint)]" />
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
              Knowledge check
            </h2>
            {lesson.quiz && <Badge tone="outline">{lesson.quiz.questions.length} questions</Badge>}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRegenerateQuiz}
            disabled={busy || !lesson.content.length}
          >
            <RefreshCw />
            {lesson.quiz ? "Regenerate quiz" : "Generate quiz"}
          </Button>
        </div>

        {lesson.quiz ? (
          <QuizView quiz={lesson.quiz} />
        ) : (
          <EmptyState
            icon={<ListChecks />}
            title="No quiz yet"
            description={
              lesson.content.length
                ? "Generate questions drawn from this lesson's content."
                : "Write the lesson first — quizzes are generated from its content."
            }
          />
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold tracking-[0.09em] text-[var(--ink-faint)] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/primitives";
import { EditableList, EditableText } from "@/components/workspace/editable";
import { QualityPanel } from "@/components/workspace/quality-panel";
import {
  DIFFICULTY_LABEL,
  countLessons,
  countQuestions,
  totalMinutes,
  type Course,
} from "@/lib/schema/course";
import { formatMinutes } from "@/lib/utils";
import { Clock, FileText, Layers, ListChecks, Sparkles, Users } from "lucide-react";
import * as React from "react";

export function OverviewPane({
  course,
  onPatch,
  onImproveCopy,
  onQualityCheck,
  busy,
}: {
  course: Course;
  onPatch: (patch: Partial<Course>) => void;
  onImproveCopy: (instruction: string) => void;
  onQualityCheck: () => void;
  busy: boolean;
}) {
  const [copyOpen, setCopyOpen] = React.useState(false);
  const [instruction, setInstruction] = React.useState("");

  const stats = [
    { icon: Layers, label: "Modules", value: String(course.modules.length) },
    { icon: FileText, label: "Lessons", value: String(countLessons(course)) },
    { icon: ListChecks, label: "Questions", value: String(countQuestions(course)) },
    { icon: Clock, label: "Learning time", value: formatMinutes(totalMinutes(course)) },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="brand">{DIFFICULTY_LABEL[course.difficulty]}</Badge>
        <Badge tone="outline">{course.duration}</Badge>
        {course.meta.sourceNames.length > 0 && (
          <Badge tone="outline">
            Grounded in {course.meta.sourceNames.length} source
            {course.meta.sourceNames.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <EditableText
        as="h1"
        className="text-[30px] leading-[1.15] font-semibold tracking-[-0.035em] text-[var(--ink)]"
        value={course.title}
        onCommit={(title) => onPatch({ title })}
        multiline={false}
        disabled={busy}
      />
      <EditableText
        className="mt-1.5 text-[16px] leading-relaxed text-[var(--ink-soft)]"
        value={course.subtitle}
        onCommit={(subtitle) => onPatch({ subtitle })}
        placeholder="Add a subtitle"
        disabled={busy}
      />

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="subtle" size="sm" onClick={() => setCopyOpen(true)} disabled={busy}>
          <Sparkles />
          Improve overview with AI
        </Button>
        <Button variant="secondary" size="sm" onClick={onQualityCheck} disabled={busy}>
          Re-run quality check
        </Button>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="px-3.5 py-3">
            <stat.icon className="mb-2 size-4 text-[var(--ink-faint)]" />
            <p className="text-[19px] leading-none font-semibold tracking-[-0.02em] text-[var(--ink)]">
              {stat.value}
            </p>
            <p className="mt-1 text-[11.5px] text-[var(--ink-faint)]">{stat.label}</p>
          </Card>
        ))}
      </div>

      {course.quality && <QualityPanel report={course.quality} className="mt-7" />}

      <Block title="Description">
        <EditableText
          className="text-[15px] leading-[1.7] text-[var(--ink)]"
          value={course.description}
          onCommit={(description) => onPatch({ description })}
          disabled={busy}
        />
      </Block>

      <Block title="Who this is for" icon={<Users className="size-3.5" />}>
        <EditableText
          className="text-[15px] leading-[1.7] text-[var(--ink)]"
          value={course.audience}
          onCommit={(audience) => onPatch({ audience })}
          disabled={busy}
        />
      </Block>

      <Block title="Learning objectives">
        <EditableList
          items={course.learningObjectives}
          onChange={(learningObjectives) => onPatch({ learningObjectives })}
          placeholder="Add an objective"
          disabled={busy}
        />
      </Block>

      {(course.outcomes.length > 0 || !busy) && (
        <Block title="What you'll be able to do">
          <EditableList
            items={course.outcomes}
            onChange={(outcomes) => onPatch({ outcomes })}
            placeholder="Add an outcome"
            disabled={busy}
          />
        </Block>
      )}

      <Block title="Prerequisites">
        <EditableList
          items={course.prerequisites}
          onChange={(prerequisites) => onPatch({ prerequisites })}
          placeholder="Add a prerequisite"
          disabled={busy}
        />
      </Block>

      <Block title="Curriculum">
        <ol className="space-y-3">
          {course.modules.map((module, index) => (
            <li key={module.id} className="rounded-[var(--radius)] border border-[var(--line)] p-3.5">
              <p className="text-[14px] font-medium text-[var(--ink)]">
                <span className="mr-1.5 text-[var(--ink-faint)] tabular-nums">{index + 1}.</span>
                {module.title}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                {module.description}
              </p>
              <p className="mt-2 text-[11.5px] text-[var(--ink-faint)]">
                {module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}
                {module.quiz ? ` · ${module.quiz.questions.length}-question quiz` : ""}
              </p>
            </li>
          ))}
        </ol>
      </Block>

      <Dialog
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title="Improve the course overview"
        description="The AI rewrites the title, subtitle, description and objectives to match what the course actually teaches."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCopyOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onImproveCopy(instruction.trim() || "Sharpen the copy and make the promise concrete.");
                setCopyOpen(false);
                setInstruction("");
              }}
            >
              <Sparkles />
              Rewrite
            </Button>
          </>
        }
      >
        <Textarea
          autoFocus
          rows={3}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Make it appeal to hiring managers rather than students. Keep it under 60 words."
        />
      </Dialog>
    </div>
  );
}

function Block({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7 space-y-2">
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.09em] text-[var(--ink-faint)] uppercase">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

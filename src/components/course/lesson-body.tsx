"use client";

import { ContentBlocks } from "@/components/course/content-blocks";
import type { Activity, KnowledgeCheck, Lesson } from "@/lib/schema/course";
import { cn, formatMinutes } from "@/lib/utils";
import { CheckCircle2, ChevronDown, ClipboardList, Target } from "lucide-react";
import * as React from "react";

/** Read-only rendering of a lesson, shared by the workspace, preview and export. */
export function LessonBody({ lesson, className }: { lesson: Lesson; className?: string }) {
  return (
    <article className={cn("space-y-7", className)}>
      {lesson.learningObjectives.length > 0 && (
        <ObjectiveStrip objectives={lesson.learningObjectives} />
      )}

      {lesson.introduction && (
        <p className="text-[17px] leading-[1.7] font-medium text-[var(--ct-heading)]">
          {lesson.introduction}
        </p>
      )}

      <ContentBlocks blocks={lesson.content} />

      {lesson.keyTakeaways.length > 0 && <KeyTakeaways items={lesson.keyTakeaways} />}
      {lesson.activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
      {lesson.knowledgeChecks.length > 0 && <KnowledgeChecks checks={lesson.knowledgeChecks} />}
    </article>
  );
}

export function ObjectiveStrip({ objectives }: { objectives: string[] }) {
  return (
    <div className="print-avoid-break rounded-[var(--ct-radius)] border border-[var(--ct-line)] bg-[var(--ct-surface-alt)] px-4 py-3.5">
      <div className="mb-2 flex items-center gap-2">
        <Target className="size-3.5 text-[var(--ct-primary)]" />
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--ct-primary)] uppercase">
          By the end of this lesson
        </p>
      </div>
      <ul className="space-y-1.5">
        {objectives.map((objective, index) => (
          <li key={index} className="flex gap-2.5 text-[14px] leading-[1.6] text-[var(--ct-text)]">
            <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-[var(--ct-primary)]" />
            {objective}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KeyTakeaways({ items }: { items: string[] }) {
  return (
    <section className="ct-card print-avoid-break px-4 py-4">
      <p className="ct-display mb-3 text-[15px] font-semibold">Key takeaways</p>
      <ul className="space-y-2.5">
        {items.map((item, index) => (
          <li key={index} className="flex gap-3 text-[14.5px] leading-[1.65] text-[var(--ct-text)]">
            <CheckCircle2 className="mt-[3px] size-4 shrink-0 text-[var(--ct-accent)]" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ActivityCard({ activity }: { activity: Activity }) {
  return (
    <section className="print-avoid-break overflow-hidden rounded-[var(--ct-radius)] border border-dashed border-[var(--ct-primary)]/45">
      <div className="flex items-center justify-between gap-3 bg-[var(--ct-accent-soft)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-3.5 text-[var(--ct-primary)]" />
          <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--ct-primary)] uppercase">
            {activity.type}
          </p>
        </div>
        <span className="text-[11.5px] text-[var(--ct-muted)]">
          {formatMinutes(activity.estimatedMinutes)}
        </span>
      </div>
      <div className="space-y-3 px-4 py-4">
        <p className="ct-display text-[15px] font-semibold">{activity.title}</p>
        <ol className="space-y-2">
          {activity.instructions.map((instruction, index) => (
            <li key={index} className="flex gap-3 text-[14.5px] leading-[1.65] text-[var(--ct-text)]">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--ct-line)] text-[11px] font-semibold text-[var(--ct-muted)] tabular-nums">
                {index + 1}
              </span>
              {instruction}
            </li>
          ))}
        </ol>
        {activity.successCriteria.length > 0 && (
          <div className="border-t border-[var(--ct-line)] pt-3">
            <p className="mb-1.5 text-[11.5px] font-semibold tracking-[0.05em] text-[var(--ct-muted)] uppercase">
              You have succeeded when
            </p>
            <ul className="space-y-1">
              {activity.successCriteria.map((criterion, index) => (
                <li key={index} className="flex gap-2.5 text-[14px] leading-[1.6] text-[var(--ct-text)]">
                  <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-[var(--ct-accent)]" />
                  {criterion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export function KnowledgeChecks({ checks }: { checks: KnowledgeCheck[] }) {
  return (
    <section className="print-avoid-break space-y-2">
      <p className="ct-display text-[15px] font-semibold">Check your understanding</p>
      {checks.map((check) => (
        <KnowledgeCheckRow key={check.id} check={check} />
      ))}
    </section>
  );
}

function KnowledgeCheckRow({ check }: { check: KnowledgeCheck }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="overflow-hidden rounded-[var(--ct-radius)] border border-[var(--ct-line)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span className="flex-1 text-[14.5px] leading-[1.6] text-[var(--ct-text)]">{check.prompt}</span>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-[var(--ct-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <div className={cn("hidden", open && "block")}>
        <p className="border-t border-[var(--ct-line)] bg-[var(--ct-surface-alt)] px-4 py-3 text-[14px] leading-[1.65] text-[var(--ct-text)]">
          {check.answer}
        </p>
      </div>
      {/* Answers are always in the DOM so print/PDF export includes them. */}
      <p className="hidden border-t border-[var(--ct-line)] bg-[var(--ct-surface-alt)] px-4 py-3 text-[14px] leading-[1.65] text-[var(--ct-text)] print:block">
        {check.answer}
      </p>
    </div>
  );
}

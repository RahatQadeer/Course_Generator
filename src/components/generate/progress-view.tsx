"use client";

import { Button } from "@/components/ui/button";
import { Card, Progress } from "@/components/ui/primitives";
import { STAGES, type StageId } from "@/lib/ai/stages";
import type { Course } from "@/lib/schema/course";
import { cn } from "@/lib/utils";
import { AlertCircle, Check, Loader2, RotateCcw, X } from "lucide-react";
import * as React from "react";

export type StageState = {
  status: "pending" | "active" | "done" | "failed";
  detail?: string;
  progress?: number;
};

export type StageMap = Record<StageId, StageState>;

export function initialStages(): StageMap {
  return Object.fromEntries(
    STAGES.map((stage) => [stage.id, { status: "pending" } as StageState]),
  ) as StageMap;
}

const TOTAL_WEIGHT = STAGES.reduce((sum, stage) => sum + stage.weight, 0);

export function overallProgress(stages: StageMap): number {
  let done = 0;
  for (const stage of STAGES) {
    const state = stages[stage.id];
    if (state.status === "done" || state.status === "failed") done += stage.weight;
    else if (state.status === "active") done += stage.weight * (state.progress ?? 0.12);
  }
  return (done / TOTAL_WEIGHT) * 100;
}

export function ProgressView({
  stages,
  skeleton,
  error,
  onCancel,
  onRetry,
  title,
}: {
  stages: StageMap;
  skeleton: Course | null;
  error: string | null;
  onCancel: () => void;
  onRetry: () => void;
  title: string;
}) {
  const percent = overallProgress(stages);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (error) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [error]);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <Card className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-[19px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
              {error ? "Generation stopped" : "Creating your course…"}
            </h1>
            <p className="mt-1 truncate text-[13.5px] text-[var(--ink-faint)]">{title}</p>
          </div>
          {!error && (
            <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[12px] tabular-nums text-[var(--ink-faint)]">
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>

        <div className="mb-6 space-y-2">
          <Progress value={percent} tone={error ? "warn" : "brand"} />
          <div className="flex justify-between text-[12px] text-[var(--ink-faint)]">
            <span>{Math.round(percent)}% complete</span>
            <span>
              {STAGES.filter((stage) => stages[stage.id].status === "done").length} of {STAGES.length}{" "}
              stages
            </span>
          </div>
        </div>

        <ol className="space-y-0.5">
          {STAGES.map((stage) => {
            const state = stages[stage.id];
            return (
              <li
                key={stage.id}
                className={cn(
                  "flex items-start gap-3 rounded-[var(--radius)] px-2.5 py-2 transition-colors",
                  state.status === "active" && "bg-[var(--brand-soft)]",
                )}
              >
                <StageIcon status={state.status} />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[13.5px] transition-colors",
                      state.status === "pending" && "text-[var(--ink-faint)]",
                      state.status === "active" && "font-medium text-[var(--brand)]",
                      state.status === "done" && "text-[var(--ink)]",
                      state.status === "failed" && "text-[var(--danger)]",
                    )}
                  >
                    {stage.label}
                  </p>
                  {state.detail && (
                    <p className="mt-0.5 truncate text-[12px] text-[var(--ink-faint)]">{state.detail}</p>
                  )}
                  {state.status === "active" && state.progress !== undefined && state.progress > 0 && (
                    <Progress value={state.progress * 100} className="mt-1.5 h-1" />
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {error ? (
          <div className="mt-5 space-y-3">
            <div className="flex gap-2.5 rounded-[var(--radius)] border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" />
              <p className="text-[13px] leading-relaxed text-[var(--ink)]">{error}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={onRetry}>
                <RotateCcw />
                Try again
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Back to the form
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="mt-5" onClick={onCancel}>
            <X />
            Cancel
          </Button>
        )}
      </Card>

      <div className="space-y-4">
        <CurriculumPreview skeleton={skeleton} stages={stages} />
      </div>
    </div>
  );
}

function StageIcon({ status }: { status: StageState["status"] }) {
  if (status === "done") {
    return (
      <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-[var(--positive)] text-white">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center">
        <Loader2 className="size-4 animate-spin text-[var(--brand)]" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-[var(--danger)] text-white">
        <X className="size-3" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center">
      <span className="size-2.5 rounded-full border border-[var(--line-strong)]" />
    </span>
  );
}

function CurriculumPreview({ skeleton, stages }: { skeleton: Course | null; stages: StageMap }) {
  if (!skeleton) {
    return (
      <Card className="p-5">
        <p className="mb-4 text-[11px] font-semibold tracking-[0.09em] text-[var(--ink-faint)] uppercase">
          Curriculum
        </p>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="skeleton h-3.5" style={{ width: `${55 + ((index * 13) % 35)}%` }} />
              <div className="ml-4 space-y-1.5">
                <div className="skeleton h-2.5 w-[70%]" />
                <div className="skeleton h-2.5 w-[58%]" />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[12px] leading-relaxed text-[var(--ink-faint)]">
          The curriculum appears here as soon as the structure is designed.
        </p>
      </Card>
    );
  }

  const lessonsDone = stages.lessons.status === "done";
  const writing = stages.lessons.status === "active";

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <p className="text-[15px] leading-snug font-semibold tracking-[-0.015em] text-[var(--ink)]">
          {skeleton.title}
        </p>
        {skeleton.subtitle && (
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-faint)]">
            {skeleton.subtitle}
          </p>
        )}
      </div>
      <div className="scroll-thin max-h-[480px] overflow-y-auto px-5 py-4">
        <ol className="space-y-3.5">
          {skeleton.modules.map((module, index) => (
            <li key={module.id}>
              <p className="text-[13px] font-medium text-[var(--ink)]">
                <span className="mr-1.5 text-[var(--ink-faint)] tabular-nums">{index + 1}.</span>
                {module.title}
              </p>
              <ul className="mt-1 ml-5 space-y-1">
                {module.lessons.map((lesson) => (
                  <li
                    key={lesson.id}
                    className="flex items-center gap-2 text-[12.5px] text-[var(--ink-soft)]"
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full transition-colors",
                        lessonsDone || !writing ? "bg-[var(--positive)]" : "bg-[var(--line-strong)]",
                      )}
                    />
                    <span className="truncate">{lesson.title}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

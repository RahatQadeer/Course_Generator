"use client";

import { Card, Progress } from "@/components/ui/primitives";
import type { QualityReport } from "@/lib/schema/course";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronDown, CircleAlert, TriangleAlert } from "lucide-react";
import * as React from "react";

const SEVERITY = {
  critical: { tone: "text-[var(--danger)]", bg: "bg-[var(--danger-soft)]", icon: CircleAlert },
  major: { tone: "text-[var(--warn)]", bg: "bg-[var(--warn-soft)]", icon: TriangleAlert },
  minor: { tone: "text-[var(--ink-faint)]", bg: "bg-[var(--surface-muted)]", icon: TriangleAlert },
} as const;

export function QualityPanel({
  report,
  className,
}: {
  report: QualityReport;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const tone = report.overall >= 88 ? "positive" : report.overall >= 72 ? "brand" : "warn";
  const unresolved = report.issues.filter((issue) => !issue.fixed);

  const dimensions = [
    { label: "Structure", ...report.dimensions.structure },
    { label: "Content", ...report.dimensions.content },
    { label: "Objective alignment", ...report.dimensions.objectiveAlignment },
    { label: "Assessment", ...report.dimensions.assessment },
  ];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-center gap-4 px-4 py-4">
        <div className="relative flex size-14 shrink-0 items-center justify-center">
          <ScoreRing value={report.overall} />
          <span className="absolute text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)] tabular-nums">
            {report.overall}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
            Course quality: {report.overall}%
          </p>
          <p className="mt-0.5 text-[12.5px] text-[var(--ink-faint)]">
            {unresolved.length
              ? `${unresolved.length} issue${unresolved.length === 1 ? "" : "s"} flagged by the reviewer`
              : "No outstanding issues"}
            {report.issues.some((issue) => issue.fixed) &&
              ` · ${report.issues.filter((issue) => issue.fixed).length} auto-fixed`}
          </p>
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-2.5 border-t border-[var(--line)] px-4 py-4 sm:grid-cols-2">
        {dimensions.map((dimension) => (
          <div key={dimension.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] text-[var(--ink-soft)]">{dimension.label}</span>
              <span className="text-[12.5px] font-medium text-[var(--ink)] tabular-nums">
                {Math.round(dimension.score)}%
              </span>
            </div>
            <Progress
              value={dimension.score}
              className="h-1"
              tone={dimension.score >= 88 ? "positive" : dimension.score >= 72 ? "brand" : "warn"}
            />
          </div>
        ))}
      </div>

      {(report.issues.length > 0 || report.strengths.length > 0) && (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="focus-ring flex w-full items-center gap-2 border-t border-[var(--line)] px-4 py-2.5 text-left text-[12.5px] font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-muted)]"
          >
            <span className="flex-1">{open ? "Hide" : "Show"} reviewer notes</span>
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <div className="animate-fade-in space-y-4 border-t border-[var(--line)] px-4 py-4">
              {report.strengths.length > 0 && (
                <div className="space-y-1.5">
                  {report.strengths.map((strength, index) => (
                    <p
                      key={index}
                      className="flex gap-2 text-[13px] leading-relaxed text-[var(--ink-soft)]"
                    >
                      <CheckCircle2 className="mt-[3px] size-3.5 shrink-0 text-[var(--positive)]" />
                      {strength}
                    </p>
                  ))}
                </div>
              )}

              {report.issues.map((issue, index) => {
                const meta = SEVERITY[issue.severity];
                const Icon = meta.icon;
                return (
                  <div
                    key={index}
                    className={cn("flex gap-2.5 rounded-[var(--radius)] px-3 py-2.5", meta.bg)}
                  >
                    <Icon className={cn("mt-[3px] size-3.5 shrink-0", meta.tone)} />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[11px] font-semibold tracking-[0.05em] uppercase">
                        <span className={meta.tone}>{issue.severity}</span>
                        <span className="ml-1.5 text-[var(--ink-faint)]">{issue.area}</span>
                        {issue.fixed && (
                          <span className="ml-1.5 text-[var(--positive)]">· auto-fixed</span>
                        )}
                      </p>
                      <p className="text-[13px] leading-relaxed text-[var(--ink)]">{issue.detail}</p>
                    </div>
                  </div>
                );
              })}

              <div className="space-y-1 border-t border-[var(--line)] pt-3">
                {dimensions.map((dimension) => (
                  <p key={dimension.label} className="text-[12.5px] leading-relaxed text-[var(--ink-faint)]">
                    <span className="font-medium text-[var(--ink-soft)]">{dimension.label}: </span>
                    {dimension.notes}
                  </p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <span className="sr-only">{tone}</span>
    </Card>
  );
}

function ScoreRing({ value }: { value: number }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);
  const color =
    value >= 88 ? "var(--positive)" : value >= 72 ? "var(--brand)" : "var(--warn)";

  return (
    <svg viewBox="0 0 56 56" className="size-14 -rotate-90">
      <circle cx="28" cy="28" r={radius} fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle
        cx="28"
        cy="28"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  );
}

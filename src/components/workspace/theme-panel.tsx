"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SectionLabel, Segmented } from "@/components/ui/primitives";
import type { Course } from "@/lib/schema/course";
import { THEMES, getTheme, themeStyle, type CardStyle, type ThemeOverrides } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { Check, RotateCcw } from "lucide-react";
import * as React from "react";

const CARD_STYLES: { value: CardStyle; label: string }[] = [
  { value: "elevated", label: "Elevated" },
  { value: "outlined", label: "Outlined" },
  { value: "flat", label: "Flat" },
  { value: "accent-bar", label: "Accent" },
];

export function ThemePanel({
  open,
  onClose,
  course,
  overrides,
  onThemeChange,
  onOverridesChange,
}: {
  open: boolean;
  onClose: () => void;
  course: Course;
  overrides: ThemeOverrides;
  onThemeChange: (themeId: string) => void;
  onOverridesChange: (overrides: ThemeOverrides) => void;
}) {
  const theme = getTheme(course.themeId);
  const set = <K extends keyof ThemeOverrides>(key: K, value: ThemeOverrides[K]) =>
    onOverridesChange({ ...overrides, [key]: value });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Course theme"
      description="Controls how the preview, the PDF and the HTML export look."
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOverridesChange({})}>
            <RotateCcw />
            Reset tweaks
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <SectionLabel className="mb-2.5">Theme</SectionLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {THEMES.map((entry) => {
              const active = entry.id === course.themeId;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onThemeChange(entry.id)}
                  className={cn(
                    "focus-ring group relative overflow-hidden rounded-[var(--radius)] border p-2.5 text-left transition-all",
                    active
                      ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/20"
                      : "border-[var(--line-strong)] hover:border-[var(--ink-faint)]",
                  )}
                >
                  <div
                    className="mb-2 flex h-11 items-end gap-1 rounded-[6px] p-1.5"
                    style={{ background: entry.tokens.bg }}
                  >
                    <span
                      className="h-full w-1/3 rounded-[3px]"
                      style={{ background: entry.tokens.primary }}
                    />
                    <span
                      className="h-2/3 w-1/4 rounded-[3px]"
                      style={{ background: entry.tokens.accent }}
                    />
                    <span
                      className="h-1/2 flex-1 rounded-[3px]"
                      style={{ background: entry.tokens.surface, border: `1px solid ${entry.tokens.line}` }}
                    />
                  </div>
                  <p className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--ink)]">
                    {entry.name}
                    {active && <Check className="size-3 text-[var(--brand)]" />}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--ink-faint)]">
                    {entry.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <SectionLabel className="mb-2">Primary colour</SectionLabel>
            <ColorField
              value={overrides.primary ?? theme.tokens.primary}
              fallback={theme.tokens.primary}
              onChange={(primary) => set("primary", primary)}
            />
          </div>
          <div>
            <SectionLabel className="mb-2">Accent colour</SectionLabel>
            <ColorField
              value={overrides.accent ?? theme.tokens.accent}
              fallback={theme.tokens.accent}
              onChange={(accent) => set("accent", accent)}
            />
          </div>
        </div>

        <div>
          <SectionLabel className="mb-2">Typeface</SectionLabel>
          <Segmented
            size="sm"
            className="w-full"
            value={overrides.font ?? "sans"}
            onChange={(font) => set("font", font)}
            options={[
              { value: "sans", label: "Sans" },
              { value: "serif", label: "Serif" },
              { value: "mono", label: "Mono" },
            ]}
          />
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <SectionLabel>Corner radius</SectionLabel>
            <span className="text-[12px] text-[var(--ink-faint)] tabular-nums">
              {overrides.radius ?? parseInt(theme.tokens.radius, 10)}px
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={24}
            value={overrides.radius ?? parseInt(theme.tokens.radius, 10)}
            onChange={(event) => set("radius", Number(event.target.value))}
            className="w-full accent-[var(--brand)]"
          />
        </div>

        <div>
          <SectionLabel className="mb-2">Card style</SectionLabel>
          <Segmented
            size="sm"
            className="w-full"
            value={overrides.cardStyle ?? theme.tokens.cardStyle}
            onChange={(cardStyle) => set("cardStyle", cardStyle)}
            options={CARD_STYLES}
          />
        </div>

        <ThemePreview course={course} themeId={course.themeId} overrides={overrides} />
      </div>
    </Dialog>
  );
}

function ColorField({
  value,
  fallback,
  onChange,
}: {
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring size-9 shrink-0 cursor-pointer rounded-[var(--radius)] border border-[var(--line-strong)] bg-transparent p-1"
        aria-label="Pick a colour"
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring h-9 w-full rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] px-2.5 font-mono text-[12.5px] text-[var(--ink)]"
      />
      {value.toLowerCase() !== fallback.toLowerCase() && (
        <Button variant="ghost" size="iconSm" onClick={() => onChange(fallback)} aria-label="Reset">
          <RotateCcw />
        </Button>
      )}
    </div>
  );
}

function ThemePreview({
  course,
  themeId,
  overrides,
}: {
  course: Course;
  themeId: string;
  overrides: ThemeOverrides;
}) {
  const theme = getTheme(themeId);
  const style = themeStyle(theme, overrides);
  const lesson = course.modules[0]?.lessons[0];

  return (
    <div>
      <SectionLabel className="mb-2">Preview</SectionLabel>
      <div
        className="course-theme overflow-hidden rounded-[var(--radius)] border border-[var(--line)] p-5"
        style={style}
      >
        <p className="ct-display text-[18px] leading-snug font-semibold">{course.title}</p>
        <p className="ct-muted mt-1 text-[13px] leading-relaxed">{course.subtitle || course.description}</p>
        <div className="ct-card mt-3.5 px-3.5 py-3">
          <p className="ct-display text-[14px] font-semibold">
            {lesson?.title ?? "Lesson title"}
          </p>
          <p className="mt-1 text-[13px] leading-[1.65] text-[var(--ct-text)]">
            {lesson?.introduction?.slice(0, 150) ??
              "A short paragraph of lesson content showing how body text reads in this theme."}
            …
          </p>
          <div className="mt-3 flex gap-2">
            <span
              className="rounded-[var(--ct-radius)] px-2.5 py-1 text-[11.5px] font-medium"
              style={{ background: "var(--ct-primary)", color: "var(--ct-primary-contrast)" }}
            >
              Primary
            </span>
            <span
              className="rounded-[var(--ct-radius)] px-2.5 py-1 text-[11.5px] font-medium"
              style={{ background: "var(--ct-accent-soft)", color: "var(--ct-primary)" }}
            >
              Accent
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

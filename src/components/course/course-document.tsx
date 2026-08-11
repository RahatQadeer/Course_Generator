"use client";

import { LessonBody } from "@/components/course/lesson-body";
import { QuizView } from "@/components/course/quiz-view";
import {
  DIFFICULTY_LABEL,
  countLessons,
  countQuestions,
  totalMinutes,
  type Course,
} from "@/lib/schema/course";
import { getTheme, themeStyle, type ThemeOverrides } from "@/lib/themes";
import { cn, formatMinutes } from "@/lib/utils";
import { GraduationCap, Target } from "lucide-react";
import * as React from "react";

/**
 * The complete course rendered as a document. This is exactly what the
 * "Preview course" screen shows and what the PDF/HTML exports produce.
 */
export function CourseDocument({
  course,
  overrides = {},
  className,
}: {
  course: Course;
  overrides?: ThemeOverrides;
  className?: string;
}) {
  const theme = getTheme(course.themeId);
  const style = themeStyle(theme, overrides);
  const header = theme.tokens.headerStyle;

  return (
    <div className={cn("course-theme min-h-full", className)} style={style}>
      {/* Header ---------------------------------------------------- */}
      <header
        className={cn(
          "px-6 py-14 sm:px-10 sm:py-20",
          header === "bordered" && "border-b-4 border-[var(--ct-primary)]",
          header === "minimal" && "border-b border-[var(--ct-line)]",
        )}
        style={
          header === "gradient"
            ? {
                background: `linear-gradient(150deg, color-mix(in srgb, var(--ct-primary) 12%, var(--ct-bg)), var(--ct-bg) 62%)`,
              }
            : header === "solid"
              ? { background: "var(--ct-primary)", color: "var(--ct-primary-contrast)" }
              : undefined
        }
      >
        <div className="mx-auto max-w-3xl">
          <p
            className="text-[11.5px] font-semibold tracking-[0.14em] uppercase"
            style={{
              color: header === "solid" ? "var(--ct-primary-contrast)" : "var(--ct-primary)",
              opacity: header === "solid" ? 0.75 : 1,
            }}
          >
            {DIFFICULTY_LABEL[course.difficulty]} · {course.duration}
          </p>
          <h1
            className="ct-display mt-3 text-[34px] leading-[1.1] font-bold sm:text-[46px]"
            style={header === "solid" ? { color: "var(--ct-primary-contrast)" } : undefined}
          >
            {course.title}
          </h1>
          {course.subtitle && (
            <p
              className="mt-3 max-w-2xl text-[17px] leading-relaxed sm:text-[19px]"
              style={{
                color: header === "solid" ? "var(--ct-primary-contrast)" : "var(--ct-muted)",
                opacity: header === "solid" ? 0.85 : 1,
              }}
            >
              {course.subtitle}
            </p>
          )}

          <div
            className="mt-7 flex flex-wrap gap-x-8 gap-y-3"
            style={header === "solid" ? { color: "var(--ct-primary-contrast)" } : undefined}
          >
            <Stat label="Modules" value={String(course.modules.length)} solid={header === "solid"} />
            <Stat label="Lessons" value={String(countLessons(course))} solid={header === "solid"} />
            <Stat
              label="Learning time"
              value={formatMinutes(totalMinutes(course))}
              solid={header === "solid"}
            />
            <Stat
              label="Questions"
              value={String(countQuestions(course))}
              solid={header === "solid"}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-14 px-6 py-12 sm:px-10">
        {/* Overview ------------------------------------------------ */}
        <section className="space-y-6">
          <p className="text-[16.5px] leading-[1.75] text-[var(--ct-text)]">{course.description}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="ct-card px-4 py-4">
              <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--ct-primary)] uppercase">
                Who this is for
              </p>
              <p className="text-[14.5px] leading-[1.65] text-[var(--ct-text)]">{course.audience}</p>
            </div>
            {course.prerequisites.length > 0 && (
              <div className="ct-card px-4 py-4">
                <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--ct-primary)] uppercase">
                  Prerequisites
                </p>
                <ul className="space-y-1.5">
                  {course.prerequisites.map((item, index) => (
                    <li key={index} className="flex gap-2 text-[14px] leading-[1.6] text-[var(--ct-text)]">
                      <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-[var(--ct-accent)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {course.learningObjectives.length > 0 && (
            <div className="ct-card px-5 py-5">
              <div className="mb-3 flex items-center gap-2">
                <Target className="size-4 text-[var(--ct-primary)]" />
                <h2 className="ct-display text-[17px] font-semibold">Learning objectives</h2>
              </div>
              <ol className="space-y-2.5">
                {course.learningObjectives.map((objective, index) => (
                  <li key={index} className="flex gap-3 text-[15px] leading-[1.65] text-[var(--ct-text)]">
                    <span className="mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full bg-[var(--ct-accent-soft)] text-[11.5px] font-semibold text-[var(--ct-primary)] tabular-nums">
                      {index + 1}
                    </span>
                    {objective}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {course.outcomes.length > 0 && (
            <div>
              <h2 className="ct-display mb-2.5 text-[17px] font-semibold">What you&apos;ll be able to do</h2>
              <ul className="space-y-2">
                {course.outcomes.map((outcome, index) => (
                  <li key={index} className="flex gap-3 text-[15px] leading-[1.65] text-[var(--ct-text)]">
                    <span className="mt-[0.65em] size-1.5 shrink-0 rounded-full bg-[var(--ct-primary)]" />
                    {outcome}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Modules -------------------------------------------------- */}
        {course.modules.map((module, moduleIndex) => (
          <section key={module.id} className="print-page-break space-y-8">
            <div className="border-t-2 border-[var(--ct-primary)] pt-5">
              <p className="text-[11.5px] font-semibold tracking-[0.14em] text-[var(--ct-primary)] uppercase">
                Module {moduleIndex + 1}
              </p>
              <h2 className="ct-display mt-1.5 text-[27px] leading-[1.2] font-bold">{module.title}</h2>
              <p className="mt-2.5 text-[15.5px] leading-[1.7] text-[var(--ct-muted)]">
                {module.description}
              </p>
              {module.learningObjectives.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {module.learningObjectives.map((objective, index) => (
                    <li
                      key={index}
                      className="flex gap-2.5 text-[14px] leading-[1.6] text-[var(--ct-text)]"
                    >
                      <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-[var(--ct-accent)]" />
                      {objective}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {module.lessons.map((lesson, lessonIndex) => (
              <article key={lesson.id} className="space-y-5">
                <div>
                  <p className="text-[11.5px] font-medium tracking-[0.08em] text-[var(--ct-muted)] uppercase">
                    Lesson {moduleIndex + 1}.{lessonIndex + 1} · {formatMinutes(lesson.durationMinutes)}
                  </p>
                  <h3 className="ct-display mt-1 text-[22px] leading-[1.25] font-semibold">
                    {lesson.title}
                  </h3>
                  {lesson.summary && (
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-[var(--ct-muted)]">
                      {lesson.summary}
                    </p>
                  )}
                </div>

                <LessonBody lesson={lesson} />

                {lesson.quiz && (
                  <div className="border-t border-[var(--ct-line)] pt-6">
                    <QuizView quiz={lesson.quiz} />
                  </div>
                )}
              </article>
            ))}

            {module.quiz && (
              <div className="print-avoid-break rounded-[var(--ct-radius)] bg-[var(--ct-surface-alt)] px-5 py-6">
                <QuizView quiz={module.quiz} />
              </div>
            )}
          </section>
        ))}

        {/* Final assessment ----------------------------------------- */}
        {course.finalAssessment && (
          <section className="print-page-break space-y-6">
            <div className="border-t-2 border-[var(--ct-primary)] pt-5">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-[var(--ct-primary)]" />
                <p className="text-[11.5px] font-semibold tracking-[0.14em] text-[var(--ct-primary)] uppercase">
                  Final assessment
                </p>
              </div>
              <h2 className="ct-display mt-1.5 text-[27px] leading-[1.2] font-bold">
                {course.finalAssessment.title}
              </h2>
            </div>
            <QuizView quiz={course.finalAssessment} />
          </section>
        )}

        <footer className="border-t border-[var(--ct-line)] pt-6 text-[12px] text-[var(--ct-muted)]">
          {course.title} · {course.modules.length} modules · {countLessons(course)} lessons ·
          generated {new Date(course.meta.generatedAt).toLocaleDateString()}
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value, solid }: { label: string; value: string; solid: boolean }) {
  return (
    <div>
      <p className="text-[20px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
      <p
        className="mt-1 text-[11.5px]"
        style={{ color: solid ? "inherit" : "var(--ct-muted)", opacity: solid ? 0.75 : 1 }}
      >
        {label}
      </p>
    </div>
  );
}

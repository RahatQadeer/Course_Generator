"use client";

import { Badge, SectionLabel } from "@/components/ui/primitives";
import type { CourseNode } from "@/lib/course-ops";
import {
  DIFFICULTY_LABEL,
  QUESTION_TYPE_LABEL,
  type Course,
  type Lesson,
  type Module,
  type Quiz,
} from "@/lib/schema/course";
import { formatMinutes } from "@/lib/utils";
import * as React from "react";

export function Inspector({
  course,
  node,
  lesson,
  module,
}: {
  course: Course;
  node: CourseNode;
  lesson?: Lesson;
  module?: Module;
}) {
  return (
    <aside className="scroll-thin h-full overflow-y-auto px-4 py-5">
      {node.kind === "lesson" && lesson && module ? (
        <LessonInfo lesson={lesson} module={module} course={course} />
      ) : node.kind === "module-quiz" && module?.quiz ? (
        <QuizInfo quiz={module.quiz} context={module.title} />
      ) : node.kind === "final" && course.finalAssessment ? (
        <QuizInfo quiz={course.finalAssessment} context="Whole course" />
      ) : (
        <CourseInfo course={course} />
      )}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[12px] text-[var(--ink-faint)]">{label}</span>
      <span className="text-right text-[12.5px] font-medium text-[var(--ink)]">{value}</span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <SectionLabel className="mb-2">{title}</SectionLabel>
      {children}
    </section>
  );
}

function LessonInfo({ lesson, module, course }: { lesson: Lesson; module: Module; course: Course }) {
  const words = React.useMemo(() => countWords(lesson), [lesson]);
  const position = module.lessons.findIndex((entry) => entry.id === lesson.id) + 1;

  return (
    <>
      <Group title="Lesson">
        <div className="divide-y divide-[var(--line)]">
          <Row label="Position" value={`${position} of ${module.lessons.length}`} />
          <Row label="Duration" value={formatMinutes(lesson.durationMinutes)} />
          <Row label="Difficulty" value={DIFFICULTY_LABEL[lesson.difficulty]} />
          <Row label="Words" value={words.toLocaleString()} />
          <Row label="Blocks" value={String(lesson.content.length)} />
          <Row label="Activities" value={String(lesson.activities.length)} />
          <Row
            label="Quiz"
            value={lesson.quiz ? `${lesson.quiz.questions.length} questions` : "None"}
          />
        </div>
      </Group>

      {lesson.learningObjectives.length > 0 && (
        <Group title="Objectives">
          <ul className="space-y-2">
            {lesson.learningObjectives.map((objective, index) => (
              <li key={index} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
                <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-[var(--brand)]" />
                {objective}
              </li>
            ))}
          </ul>
        </Group>
      )}

      {lesson.outline.length > 0 && (
        <Group title="Planned outline">
          <ol className="space-y-1.5">
            {lesson.outline.map((beat, index) => (
              <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-[var(--ink-faint)]">
                <span className="tabular-nums">{index + 1}.</span>
                {beat}
              </li>
            ))}
          </ol>
        </Group>
      )}

      <Group title="Module">
        <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{module.description}</p>
      </Group>

      <Group title="Course">
        <p className="text-[12.5px] text-[var(--ink-soft)]">{course.title}</p>
      </Group>
    </>
  );
}

function QuizInfo({ quiz, context }: { quiz: Quiz; context: string }) {
  const byType = quiz.questions.reduce<Record<string, number>>((counts, question) => {
    counts[question.type] = (counts[question.type] ?? 0) + 1;
    return counts;
  }, {});
  const byDifficulty = quiz.questions.reduce<Record<string, number>>((counts, question) => {
    counts[question.difficulty] = (counts[question.difficulty] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <>
      <Group title="Assessment">
        <div className="divide-y divide-[var(--line)]">
          <Row label="Covers" value={context} />
          <Row label="Questions" value={String(quiz.questions.length)} />
          <Row
            label="Points"
            value={String(quiz.questions.reduce((sum, question) => sum + question.points, 0))}
          />
          <Row label="Pass mark" value={`${quiz.passingScore}%`} />
        </div>
      </Group>

      <Group title="Question types">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(byType).map(([type, count]) => (
            <Badge key={type} tone="outline">
              {QUESTION_TYPE_LABEL[type as keyof typeof QUESTION_TYPE_LABEL]} · {count}
            </Badge>
          ))}
        </div>
      </Group>

      <Group title="Difficulty mix">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(byDifficulty).map(([difficulty, count]) => (
            <Badge key={difficulty} tone="outline">
              {DIFFICULTY_LABEL[difficulty as keyof typeof DIFFICULTY_LABEL]} · {count}
            </Badge>
          ))}
        </div>
      </Group>
    </>
  );
}

function CourseInfo({ course }: { course: Course }) {
  const lessons = course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const minutes = course.modules.reduce(
    (sum, module) => sum + module.lessons.reduce((inner, lesson) => inner + lesson.durationMinutes, 0),
    0,
  );

  return (
    <>
      <Group title="Course">
        <div className="divide-y divide-[var(--line)]">
          <Row label="Level" value={DIFFICULTY_LABEL[course.difficulty]} />
          <Row label="Duration" value={course.duration} />
          <Row label="Learning time" value={formatMinutes(minutes)} />
          <Row label="Modules" value={String(course.modules.length)} />
          <Row label="Lessons" value={String(lessons)} />
          <Row label="Language" value={course.meta.language} />
          <Row label="Style" value={course.meta.teachingStyle} />
        </div>
      </Group>

      {course.meta.sourceNames.length > 0 && (
        <Group title="Source material">
          <ul className="space-y-1">
            {course.meta.sourceNames.map((name) => (
              <li key={name} className="truncate text-[12px] text-[var(--ink-soft)]">
                {name}
              </li>
            ))}
          </ul>
          {course.meta.sourceSummary && (
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-faint)]">
              {course.meta.sourceSummary}
            </p>
          )}
        </Group>
      )}

      <Group title="Generated">
        <p className="text-[12px] text-[var(--ink-faint)]">
          {new Date(course.meta.generatedAt).toLocaleString()}
        </p>
        {course.meta.model && (
          <p className="mt-0.5 font-mono text-[11px] text-[var(--ink-faint)]">{course.meta.model}</p>
        )}
      </Group>
    </>
  );
}

function countWords(lesson: Lesson): number {
  const count = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
  let total = count(lesson.introduction);
  for (const block of lesson.content) {
    switch (block.type) {
      case "paragraph":
      case "heading":
        total += count(block.text);
        break;
      case "list":
        total += block.items.reduce((sum, item) => sum + count(item), 0);
        break;
      case "callout":
        total += count(block.text);
        break;
      case "code":
        total += count(block.code);
        break;
      case "example":
        total += count(block.scenario) + block.walkthrough.reduce((sum, step) => sum + count(step), 0);
        break;
      case "steps":
        total += block.steps.reduce((sum, step) => sum + count(step.title) + count(step.detail), 0);
        break;
      case "table":
        total += block.rows.flat().reduce((sum, cell) => sum + count(cell), 0);
        break;
    }
  }
  return total + lesson.keyTakeaways.reduce((sum, item) => sum + count(item), 0);
}

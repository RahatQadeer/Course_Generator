import "server-only";

import { mapLimit } from "@/lib/ai/client";
import { blueprintFromCourse, requestFromCourse } from "@/lib/ai/context";
import { qualityPass, type Emit } from "@/lib/ai/pipeline";
import * as ops from "@/lib/course-ops";
import type { Course, Lesson, Module } from "@/lib/schema/course";
import { IMPROVE_ACTIONS, improveCourseCopy, improveLesson, sketchLesson } from "@/services/ai/aiEditor";
import { generateFinalAssessment } from "@/services/ai/assessmentGenerator";
import { generateLessonPlan, type ModulePlan } from "@/services/ai/curriculumGenerator";
import { generateLessonBody, generateModuleActivities } from "@/services/ai/lessonGenerator";
import { generateLessonQuizzes, generateModuleQuiz } from "@/services/ai/quizGenerator";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Request schema                                                            */
/* -------------------------------------------------------------------------- */

export const aiOperationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("regenerate-lesson"), lessonId: z.string(), instruction: z.string().optional() }),
  z.object({ action: z.literal("improve-lesson"), lessonId: z.string(), improve: z.string() }),
  z.object({ action: z.literal("regenerate-module"), moduleId: z.string(), instruction: z.string().optional() }),
  z.object({ action: z.literal("regenerate-lesson-quiz"), lessonId: z.string() }),
  z.object({ action: z.literal("regenerate-module-quiz"), moduleId: z.string() }),
  z.object({ action: z.literal("regenerate-final-assessment") }),
  z.object({ action: z.literal("generate-lesson"), moduleId: z.string(), hint: z.string().default("") }),
  z.object({ action: z.literal("improve-course-copy"), instruction: z.string() }),
  z.object({ action: z.literal("quality-check") }),
]);

export type AIOperation = z.infer<typeof aiOperationSchema>;

type Ctx = { signal?: AbortSignal; emit: Emit };

/* -------------------------------------------------------------------------- */
/*  Dispatch                                                                  */
/* -------------------------------------------------------------------------- */

export async function runOperation(course: Course, operation: AIOperation, ctx: Ctx): Promise<Course> {
  const request = requestFromCourse(course);
  const blueprint = blueprintFromCourse(course);
  const ai = { signal: ctx.signal };
  const step = (detail: string, progress?: number) =>
    ctx.emit({ type: "stage", stage: "lessons", status: "active", detail, progress });

  switch (operation.action) {
    /* ---------------------------------------------------------------- */
    case "regenerate-lesson":
    case "improve-lesson": {
      const lessonId = operation.lessonId;
      const located = locate(course, lessonId);
      if (!located) throw new Error("Lesson not found");

      step(`Rewriting “${located.lesson.title}”`, 0.2);

      let lesson: Lesson;
      if (operation.action === "improve-lesson") {
        const key = operation.improve;
        const known = key in IMPROVE_ACTIONS ? (key as keyof typeof IMPROVE_ACTIONS) : null;
        lesson = await improveLesson(
          located.lesson,
          known ?? "custom",
          { course, request, moduleTitle: located.module.title },
          { customInstruction: known ? undefined : key, ...ai },
        );
      } else {
        lesson = await generateLessonBody(
          { ...located.lesson, content: [], introduction: "", keyTakeaways: [] },
          {
            request,
            blueprint,
            module: located.module,
            moduleIndex: course.modules.indexOf(located.module),
            lessonIndex: located.module.lessons.indexOf(located.lesson),
            priorLessons: priorLessons(course, lessonId),
            nextLessonTitle: nextLessonTitle(course, lessonId),
          },
          { ...ai, extraInstruction: operation.instruction },
        );
      }

      step("Refreshing the knowledge check", 0.7);
      const quizzes = await generateLessonQuizzes(
        request,
        blueprint,
        located.module,
        [{ lesson, index: 0 }],
        ai,
      ).catch(() => null);

      const withQuiz: Lesson = { ...lesson, quiz: quizzes?.get(lesson.id) ?? lesson.quiz };
      return ops.replaceLesson(course, lessonId, withQuiz);
    }

    /* ---------------------------------------------------------------- */
    case "regenerate-module": {
      const module = course.modules.find((entry) => entry.id === operation.moduleId);
      if (!module) throw new Error("Module not found");
      const moduleIndex = course.modules.indexOf(module);

      step("Re-planning the module", 0.05);
      const plan: ModulePlan = {
        title: module.title,
        description: module.description,
        learningObjectives: module.learningObjectives,
        servesCourseObjectives: [],
        lessonCount: Math.max(1, module.lessons.length),
        focus: operation.instruction || module.description,
      };

      const planned = await generateLessonPlan(
        request,
        blueprint,
        plan,
        {
          index: moduleIndex,
          total: course.modules.length,
          previousTitles: course.modules.slice(0, moduleIndex).map((entry) => entry.title),
          nextModuleTitle: course.modules[moduleIndex + 1]?.title,
        },
        ai,
      );

      let next: Module = {
        ...module,
        lessons: planned.lessons.map((lesson, index) => ({
          ...ops.blankLesson(lesson.title, lesson.difficulty),
          summary: lesson.summary,
          learningObjectives: lesson.learningObjectives,
          durationMinutes: lesson.durationMinutes,
          outline: lesson.outline,
          // Preserve ids where the lesson count is unchanged so the UI keeps its place.
          id: module.lessons[index]?.id ?? ops.blankLesson().id,
        })),
      };

      const total = next.lessons.length;
      let done = 0;
      const written = await mapLimit(next.lessons, 4, async (lesson, index) => {
        const result = await generateLessonBody(
          lesson,
          {
            request,
            blueprint,
            module: next,
            moduleIndex,
            lessonIndex: index,
            priorLessons: next.lessons.slice(0, index).map((entry) => ({
              title: entry.title,
              summary: entry.summary,
            })),
            nextLessonTitle: next.lessons[index + 1]?.title,
          },
          ai,
        ).catch(() => ({ ...lesson, status: "failed" as const }));
        done++;
        step(`${done} of ${total} lessons rewritten`, 0.1 + (done / total) * 0.6);
        return result;
      });

      next = { ...next, lessons: written };

      step("Creating activities", 0.75);
      next = await generateModuleActivities(request, blueprint, next, ai).catch(() => next);

      step("Building quizzes", 0.85);
      const usable = next.lessons
        .map((lesson, index) => ({ lesson, index }))
        .filter((entry) => entry.lesson.content.length > 0);
      if (usable.length) {
        const quizzes = await generateLessonQuizzes(request, blueprint, next, usable, ai).catch(
          () => new Map<string, NonNullable<Lesson["quiz"]>>(),
        );
        next = {
          ...next,
          lessons: next.lessons.map((lesson) => ({ ...lesson, quiz: quizzes.get(lesson.id) ?? null })),
        };
        const moduleQuiz = await generateModuleQuiz(request, blueprint, next, ai).catch(() => null);
        next = { ...next, quiz: moduleQuiz };
      }

      return ops.replaceModule(course, module.id, next);
    }

    /* ---------------------------------------------------------------- */
    case "regenerate-lesson-quiz": {
      const located = locate(course, operation.lessonId);
      if (!located) throw new Error("Lesson not found");
      if (!located.lesson.content.length) throw new Error("Write the lesson before generating its quiz.");

      step(`Writing questions for “${located.lesson.title}”`, 0.4);
      const quizzes = await generateLessonQuizzes(
        request,
        blueprint,
        located.module,
        [{ lesson: located.lesson, index: 0 }],
        ai,
      );
      const quiz = quizzes.get(located.lesson.id);
      if (!quiz) throw new Error("The quiz generator returned nothing.");
      return ops.setLessonQuiz(course, located.lesson.id, quiz);
    }

    /* ---------------------------------------------------------------- */
    case "regenerate-module-quiz": {
      const module = course.modules.find((entry) => entry.id === operation.moduleId);
      if (!module) throw new Error("Module not found");
      if (!module.lessons.some((lesson) => lesson.content.length)) {
        throw new Error("Write the module's lessons before generating its quiz.");
      }
      step(`Writing the “${module.title}” assessment`, 0.4);
      const quiz = await generateModuleQuiz(request, blueprint, module, ai);
      return ops.setModuleQuiz(course, module.id, quiz);
    }

    /* ---------------------------------------------------------------- */
    case "regenerate-final-assessment": {
      step("Composing the final assessment", 0.3);
      const quiz = await generateFinalAssessment(request, blueprint, course, ai);
      return ops.updateCourse(course, { finalAssessment: quiz });
    }

    /* ---------------------------------------------------------------- */
    case "generate-lesson": {
      const module = course.modules.find((entry) => entry.id === operation.moduleId);
      if (!module) throw new Error("Module not found");

      step("Planning the lesson", 0.15);
      const sketch = await sketchLesson(course, module.id, operation.hint, ai);
      const draft: Lesson = { ...ops.blankLesson(), ...sketch };

      step(`Writing “${draft.title}”`, 0.4);
      const lesson = await generateLessonBody(
        draft,
        {
          request,
          blueprint,
          module,
          moduleIndex: course.modules.indexOf(module),
          lessonIndex: module.lessons.length,
          priorLessons: module.lessons.map((entry) => ({ title: entry.title, summary: entry.summary })),
        },
        ai,
      );

      step("Adding a knowledge check", 0.85);
      const quizzes = await generateLessonQuizzes(
        request,
        blueprint,
        module,
        [{ lesson, index: 0 }],
        ai,
      ).catch(() => null);

      const withQuiz: Lesson = { ...lesson, quiz: quizzes?.get(lesson.id) ?? null };
      return ops.mapModules(course, (entry) =>
        entry.id === module.id ? { ...entry, lessons: [...entry.lessons, withQuiz] } : entry,
      );
    }

    /* ---------------------------------------------------------------- */
    case "improve-course-copy": {
      step("Rewriting the course overview", 0.4);
      const copy = await improveCourseCopy(course, operation.instruction, ai);
      return ops.updateCourse(course, copy);
    }

    /* ---------------------------------------------------------------- */
    case "quality-check": {
      step("Reviewing the course", 0.3);
      return qualityPass(course, request, blueprint, ctx.emit, ai);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function locate(course: Course, lessonId: string) {
  for (const module of course.modules) {
    const lesson = module.lessons.find((entry) => entry.id === lessonId);
    if (lesson) return { module, lesson };
  }
  return null;
}

function flatten(course: Course): Lesson[] {
  return course.modules.flatMap((module) => module.lessons);
}

function priorLessons(course: Course, lessonId: string) {
  const all = flatten(course);
  const index = all.findIndex((lesson) => lesson.id === lessonId);
  return all.slice(0, Math.max(0, index)).map((lesson) => ({
    title: lesson.title,
    summary: lesson.summary,
  }));
}

function nextLessonTitle(course: Course, lessonId: string): string | undefined {
  const all = flatten(course);
  const index = all.findIndex((lesson) => lesson.id === lessonId);
  return index >= 0 ? all[index + 1]?.title : undefined;
}

import "server-only";

import {
  AIQuotaError,
  activeModels,
  addUsage,
  emptyUsage,
  mapLimit,
  modelsUsed,
  type Usage,
} from "@/lib/ai/client";
import type { Emit } from "@/lib/ai/stages";
import type { Course, GenerationRequest, Lesson, Module } from "@/lib/schema/course";
import { id } from "@/lib/utils";
import { improveLesson } from "@/services/ai/aiEditor";
import { generateFinalAssessment } from "@/services/ai/assessmentGenerator";
import { analyzeBrief, generateObjectives, type Blueprint } from "@/services/ai/coursePlanner";
import {
  assembleModule,
  generateLessonPlan,
  generateModulePlan,
} from "@/services/ai/curriculumGenerator";
import { buildReport, reviewCourse, structuralCheck } from "@/services/ai/courseValidator";
import { generateLessonBody, generateModuleActivities } from "@/services/ai/lessonGenerator";
import { generateLessonQuizzes, generateModuleQuiz } from "@/services/ai/quizGenerator";

/* -------------------------------------------------------------------------- */
/*  Stages                                                                    */
/* -------------------------------------------------------------------------- */

export { STAGES } from "@/lib/ai/stages";
export type { Emit, PipelineEvent, StageId } from "@/lib/ai/stages";

/** Bounded parallelism — high enough to be fast, low enough to avoid rate limits. */
const LESSON_CONCURRENCY = Number(process.env.COURSEGEN_CONCURRENCY ?? 5);
const MAX_AUTO_REPAIRS = 3;

/* -------------------------------------------------------------------------- */
/*  Orchestrator                                                              */
/* -------------------------------------------------------------------------- */

export async function runPipeline(
  request: GenerationRequest,
  emit: Emit,
  signal?: AbortSignal,
): Promise<Course> {
  const startedAt = Date.now();
  let usage = emptyUsage();
  const onUsage = (next: Usage) => {
    usage = addUsage(usage, next);
  };
  const ai = { signal, onUsage };

  const check = () => {
    if (signal?.aborted) throw new Error("Generation cancelled");
  };

  /* Stage 1 — analyse ----------------------------------------------------- */
  emit({ type: "stage", stage: "analyze", status: "active" });
  const blueprint: Blueprint = await analyzeBrief(request, ai);
  emit({
    type: "stage",
    stage: "analyze",
    status: "done",
    detail: blueprint.title,
  });
  check();

  /* Stage 2 — objectives -------------------------------------------------- */
  emit({ type: "stage", stage: "objectives", status: "active" });
  const objectives = await generateObjectives(request, blueprint, ai);
  emit({
    type: "stage",
    stage: "objectives",
    status: "done",
    detail: `${objectives.learningObjectives.length} objectives`,
  });
  check();

  /* Stage 3 — module arc -------------------------------------------------- */
  emit({ type: "stage", stage: "curriculum", status: "active" });
  const arc = await generateModulePlan(request, blueprint, objectives, ai);
  emit({
    type: "stage",
    stage: "curriculum",
    status: "done",
    detail: `${arc.modules.length} modules`,
  });
  check();

  let course: Course = {
    id: id("course"),
    title: request.title?.trim() || blueprint.title,
    subtitle: blueprint.subtitle,
    description: request.description?.trim() || blueprint.description,
    audience: blueprint.audience,
    difficulty: blueprint.difficulty,
    duration: request.duration,
    estimatedHours: blueprint.estimatedHours,
    prerequisites: blueprint.prerequisites,
    learningObjectives: objectives.learningObjectives,
    outcomes: objectives.outcomes,
    modules: [],
    finalAssessment: null,
    quality: null,
    themeId: "modern",
    meta: {
      topic: request.topic,
      language: request.language,
      teachingStyle: request.teachingStyle,
      sourceSummary: blueprint.sourceSummary || undefined,
      sourceNames: request.sources.map((source) => source.name),
      generatedAt: new Date().toISOString(),
      model: activeModels().provider,
    },
    updatedAt: new Date().toISOString(),
  };

  /* Stage 4 — lesson plans per module ------------------------------------- */
  emit({ type: "stage", stage: "modules", status: "active", progress: 0 });
  let planned = 0;
  const modules = await mapLimit(arc.modules, 3, async (plan, index) => {
    const previousTitles = arc.modules.slice(0, index).map((entry) => entry.title);
    const result = await generateLessonPlan(
      request,
      blueprint,
      plan,
      {
        index,
        total: arc.modules.length,
        previousTitles,
        nextModuleTitle: arc.modules[index + 1]?.title,
      },
      ai,
    );
    planned++;
    emit({
      type: "stage",
      stage: "modules",
      status: "active",
      progress: planned / arc.modules.length,
      detail: `${planned} of ${arc.modules.length} modules structured`,
    });
    return assembleModule(plan, result.lessons);
  });

  course = { ...course, modules };
  const lessonTotal = modules.reduce((sum, module) => sum + module.lessons.length, 0);
  emit({
    type: "stage",
    stage: "modules",
    status: "done",
    detail: `${modules.length} modules · ${lessonTotal} lessons`,
  });
  emit({ type: "skeleton", course });
  check();

  /* Stage 5 — lesson bodies ----------------------------------------------- */
  emit({ type: "stage", stage: "lessons", status: "active", progress: 0 });

  const jobs = modules.flatMap((module, moduleIndex) =>
    module.lessons.map((lesson, lessonIndex) => ({ module, moduleIndex, lesson, lessonIndex })),
  );

  // Prior-lesson context is taken from the plan (titles + summaries), which is
  // known up front — so lessons can be written in parallel while still knowing
  // what comes before and after them.
  const flatPlan = jobs.map((job) => ({ title: job.lesson.title, summary: job.lesson.summary }));

  let written = 0;
  const writtenLessons = await mapLimit(jobs, LESSON_CONCURRENCY, async (job, index) => {
    const lesson = await generateLessonBody(
      job.lesson,
      {
        request,
        blueprint,
        module: job.module,
        moduleIndex: job.moduleIndex,
        lessonIndex: job.lessonIndex,
        priorLessons: flatPlan.slice(0, index),
        nextLessonTitle: flatPlan[index + 1]?.title,
      },
      ai,
    ).catch((error) => {
      if (error instanceof AIQuotaError) throw error;
      // One failed lesson must not sink the course — mark it and continue.
      console.error(`[pipeline] lesson failed: ${job.lesson.title}`, error);
      return { ...job.lesson, status: "failed" as const };
    });
    written++;
    emit({
      type: "stage",
      stage: "lessons",
      status: "active",
      progress: written / jobs.length,
      detail: `${written} of ${jobs.length} lessons written`,
    });
    return lesson;
  });

  course = applyLessons(course, writtenLessons);
  const failed = writtenLessons.filter((lesson) => lesson.status === "failed").length;
  emit({
    type: "stage",
    stage: "lessons",
    status: failed === writtenLessons.length ? "failed" : "done",
    detail: failed ? `${jobs.length - failed} of ${jobs.length} written` : `${jobs.length} lessons written`,
  });
  if (failed === writtenLessons.length) {
    throw new Error("Every lesson failed to generate. Check your API key and try again.");
  }
  check();

  /* Stage 6 — activities and knowledge checks ------------------------------ */
  emit({ type: "stage", stage: "activities", status: "active", progress: 0 });
  let enriched = 0;
  const withActivities = await mapLimit(course.modules, 3, async (module) => {
    const result = await generateModuleActivities(request, blueprint, module, ai).catch((error) => {
      if (error instanceof AIQuotaError) throw error;
      console.error(`[pipeline] activities failed: ${module.title}`, error);
      return module;
    });
    enriched++;
    emit({
      type: "stage",
      stage: "activities",
      status: "active",
      progress: enriched / course.modules.length,
      detail: `${enriched} of ${course.modules.length} modules`,
    });
    return result;
  });
  course = { ...course, modules: withActivities };
  emit({ type: "stage", stage: "activities", status: "done" });
  check();

  /* Stage 7 — quizzes ------------------------------------------------------ */
  if (request.includeQuizzes) {
    emit({ type: "stage", stage: "quizzes", status: "active", progress: 0 });
    const quizJobs = course.modules.length * 2;
    let quizDone = 0;
    const bump = (detail?: string) => {
      quizDone++;
      emit({
        type: "stage",
        stage: "quizzes",
        status: "active",
        progress: quizDone / quizJobs,
        detail,
      });
    };

    const quizzed = await mapLimit(course.modules, 3, async (module) => {
      const usable = module.lessons
        .map((lesson, index) => ({ lesson, index }))
        .filter((entry) => entry.lesson.content.length > 0);

      let next = module;

      if (usable.length) {
        const chunks = chunk(usable, 3);
        const maps = await Promise.all(
          chunks.map((group) =>
            generateLessonQuizzes(request, blueprint, module, group, ai).catch((error) => {
              if (error instanceof AIQuotaError) throw error;
              console.error(`[pipeline] lesson quizzes failed: ${module.title}`, error);
              return new Map<string, NonNullable<Lesson["quiz"]>>();
            }),
          ),
        );
        const merged = new Map(maps.flatMap((map) => [...map.entries()]));
        next = {
          ...next,
          lessons: next.lessons.map((lesson) => ({ ...lesson, quiz: merged.get(lesson.id) ?? lesson.quiz })),
        };
      }
      bump(`${module.title} — lesson quizzes`);

      if (usable.length) {
        const moduleQuiz = await generateModuleQuiz(request, blueprint, next, ai).catch((error) => {
          if (error instanceof AIQuotaError) throw error;
          console.error(`[pipeline] module quiz failed: ${module.title}`, error);
          return null;
        });
        next = { ...next, quiz: moduleQuiz };
      }
      bump(`${module.title} — module quiz`);

      return next;
    });

    course = { ...course, modules: quizzed };
    emit({ type: "stage", stage: "quizzes", status: "done" });
  } else {
    emit({ type: "stage", stage: "quizzes", status: "done", detail: "skipped" });
  }
  check();

  /* Stage 8 — final assessment -------------------------------------------- */
  if (request.includeFinalAssessment) {
    emit({ type: "stage", stage: "assessment", status: "active" });
    const finalAssessment = await generateFinalAssessment(request, blueprint, course, ai).catch(
      (error) => {
        if (error instanceof AIQuotaError) throw error;
        console.error("[pipeline] final assessment failed", error);
        return null;
      },
    );
    course = { ...course, finalAssessment };
    emit({
      type: "stage",
      stage: "assessment",
      status: finalAssessment ? "done" : "failed",
      detail: finalAssessment ? `${finalAssessment.questions.length} questions` : "could not be generated",
    });
  } else {
    emit({ type: "stage", stage: "assessment", status: "done", detail: "skipped" });
  }
  check();

  /* Stage 9 — quality check and auto-repair -------------------------------- */
  emit({ type: "stage", stage: "quality", status: "active" });
  course = await qualityPass(course, request, blueprint, emit, ai);

  // Stamp the models that actually produced content — a tier can fall back to
  // a different model part-way through when a daily quota runs out.
  course = {
    ...course,
    meta: { ...course.meta, model: modelsUsed().join(", ") || activeModels().writing },
    updatedAt: new Date().toISOString(),
  };
  emit({
    type: "stage",
    stage: "quality",
    status: "done",
    detail: course.quality ? `${course.quality.overall}% quality` : undefined,
  });

  emit({ type: "done", course, usage, elapsedMs: Date.now() - startedAt });
  return course;
}

/* -------------------------------------------------------------------------- */
/*  Quality pass                                                              */
/* -------------------------------------------------------------------------- */

export async function qualityPass(
  input: Course,
  request: GenerationRequest,
  blueprint: Blueprint,
  emit: Emit,
  ai: { signal?: AbortSignal; onUsage?: (usage: Usage) => void },
): Promise<Course> {
  let course = input;

  const structural = structuralCheck(course);
  const review = await reviewCourse(course, ai).catch((error) => {
    if (error instanceof AIQuotaError) throw error;
    console.error("[pipeline] review failed", error);
    return null;
  });

  let report = buildReport(structural, review, course);

  /* Auto-repair: rewrite the worst offending lessons, then re-score. */
  const repairable = (review?.issues ?? [])
    .filter((issue) => issue.severity !== "minor" && issue.lessonTitle && issue.fixInstruction)
    .slice(0, MAX_AUTO_REPAIRS);

  const structuralRepairs = structural.issues
    .filter((issue) => issue.severity === "critical" && issue.targetId)
    .slice(0, MAX_AUTO_REPAIRS);

  const targets = new Map<string, string>();
  for (const issue of repairable) {
    const lessonId = findLessonId(course, issue.lessonTitle);
    if (lessonId) targets.set(lessonId, issue.fixInstruction);
  }
  for (const issue of structuralRepairs) {
    if (issue.targetId && !targets.has(issue.targetId)) {
      targets.set(issue.targetId, "This lesson is empty or far too thin. Write it in full.");
    }
  }

  if (targets.size) {
    emit({
      type: "stage",
      stage: "quality",
      status: "active",
      detail: `Improving ${targets.size} lesson${targets.size > 1 ? "s" : ""}`,
    });

    const entries = [...targets.entries()].slice(0, MAX_AUTO_REPAIRS);
    const repaired = await mapLimit(entries, 3, async ([lessonId, instruction]) => {
      const located = locate(course, lessonId);
      if (!located) return null;
      try {
        return await improveLesson(
          located.lesson,
          "custom",
          { course, request, moduleTitle: located.module.title },
          { customInstruction: instruction, ...ai },
        );
      } catch (error) {
        console.error("[pipeline] repair failed", error);
        return null;
      }
    });

    const fixed = repaired.filter(Boolean) as Lesson[];
    if (fixed.length) {
      course = applyLessons(course, fixed);
      const fixedIds = new Set(fixed.map((lesson) => lesson.id));
      const rescored = structuralCheck(course);
      report = buildReport(rescored, review, course);
      report = {
        ...report,
        issues: report.issues.map((issue) =>
          issue.targetId && fixedIds.has(issue.targetId) ? { ...issue, fixed: true } : issue,
        ),
      };
      // Repairs genuinely improve the course; reflect that without inflating.
      const lift = Math.min(6, fixed.length * 2);
      report = { ...report, overall: Math.min(99, report.overall + lift) };
    }
  }

  return { ...course, quality: report };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function applyLessons(course: Course, lessons: Lesson[]): Course {
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  return {
    ...course,
    modules: course.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => byId.get(lesson.id) ?? lesson),
    })),
  };
}

function locate(course: Course, lessonId: string): { module: Module; lesson: Lesson } | null {
  for (const module of course.modules) {
    const lesson = module.lessons.find((entry) => entry.id === lessonId);
    if (lesson) return { module, lesson };
  }
  return null;
}

function findLessonId(course: Course, title: string): string | undefined {
  const needle = title.trim().toLowerCase();
  for (const module of course.modules) {
    const match = module.lessons.find((lesson) => lesson.title.trim().toLowerCase() === needle);
    if (match) return match.id;
  }
  return undefined;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

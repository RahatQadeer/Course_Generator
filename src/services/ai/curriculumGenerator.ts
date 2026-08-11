import "server-only";

import { generateStructured, type Usage } from "@/lib/ai/client";
import {
  DEPTH_GUIDE,
  DESIGNER_SYSTEM,
  briefBlock,
  calibrationBlock,
  jsonDiscipline,
  sourceBlock,
} from "@/lib/ai/prompts";
import type { GenerationRequest, Module } from "@/lib/schema/course";
import { difficultySchema } from "@/lib/schema/course";
import { id } from "@/lib/utils";
import { z } from "zod";
import type { Blueprint, Objectives } from "./coursePlanner";

/* -------------------------------------------------------------------------- */
/*  Stage 3 — Module arc                                                      */
/* -------------------------------------------------------------------------- */

const modulePlanSchema = z.object({
  title: z.string().describe("Specific module title naming the capability built. Not 'Introduction'."),
  description: z
    .string()
    .describe("2–3 sentences: what this module covers and why it sits at this point in the sequence."),
  learningObjectives: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("Module objectives, each starting with an observable verb."),
  servesCourseObjectives: z
    .array(z.number().int())
    .describe("1-based indexes of the course objectives this module advances."),
  lessonCount: z.number().int().min(1).max(8),
  focus: z
    .string()
    .describe("One sentence for the lesson planner: the exact ground this module must cover, and nothing else."),
});

export const modulePlanListSchema = z.object({
  modules: z.array(modulePlanSchema).min(1).max(16),
  progressionRationale: z
    .string()
    .describe("2–3 sentences explaining why this order is pedagogically correct."),
});

export type ModulePlan = z.infer<typeof modulePlanSchema>;

export async function generateModulePlan(
  request: GenerationRequest,
  blueprint: Blueprint,
  objectives: Objectives,
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<z.infer<typeof modulePlanListSchema>> {
  const sources = sourceBlock(request.sources, 30_000);
  const depth = DEPTH_GUIDE[request.depth];

  const prompt = `Design the module arc for this course.

${briefBlock(request)}

COURSE: ${blueprint.title} — ${blueprint.subtitle}
LEVEL: ${blueprint.difficulty}
IN SCOPE: ${blueprint.inScope.join("; ")}
OUT OF SCOPE: ${blueprint.outOfScope.join("; ") || "—"}

DOMAIN ANALYSIS:
${blueprint.domainAnalysis}

COURSE OBJECTIVES (1-based):
${objectives.learningObjectives.map((objective, index) => `${index + 1}. ${objective}`).join("\n")}

${sources ? `${sources}\n\n` : ""}${calibrationBlock(request)}

Rules:
- Produce exactly ${request.moduleCount} modules unless the subject genuinely cannot be divided that way (in that case go within ±1 and make the arc coherent).
- Every course objective must be served by at least one module. Every module must serve at least one course objective.
- The sequence must respect dependencies: nothing is used before it has been taught.
- No filler modules. "Introduction to X" is only acceptable if it teaches real content. Never end with a "Conclusion" or "Next steps" module.
- Choose lessonCount from the module's actual weight, not evenly. Total lessons across the course should fit ${blueprint.estimatedHours} hours at roughly ${depth.lessonMinutes} minutes per lesson.
- Modules later in the course should be more demanding than earlier ones.

${jsonDiscipline()}`;

  return generateStructured({
    name: "module_arc",
    description: "The ordered list of course modules.",
    schema: modulePlanListSchema,
    system: DESIGNER_SYSTEM,
    tier: "reasoning",
    maxTokens: 6000,
    temperature: 0.7,
    prompt,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });
}

/* -------------------------------------------------------------------------- */
/*  Stage 4 — Lesson breakdown per module                                     */
/* -------------------------------------------------------------------------- */

const lessonPlanSchema = z.object({
  title: z.string().describe("Concrete lesson title naming what is taught."),
  summary: z.string().describe("One sentence a learner would read in a syllabus."),
  learningObjectives: z.array(z.string()).min(1).max(3),
  durationMinutes: z.number().int().min(5).max(90),
  difficulty: difficultySchema,
  outline: z
    .array(z.string())
    .min(3)
    .max(9)
    .describe("The beats the lesson writer must cover, in order. Each is a specific claim or skill, not a heading."),
  requiresCode: z
    .boolean()
    .describe("True only if this lesson genuinely needs code, config or command-line snippets.")
    .default(false),
});

export const lessonPlanListSchema = z.object({
  lessons: z.array(lessonPlanSchema).min(1).max(8),
});

export type LessonPlan = z.infer<typeof lessonPlanSchema>;

export async function generateLessonPlan(
  request: GenerationRequest,
  blueprint: Blueprint,
  modulePlan: ModulePlan,
  context: { index: number; total: number; previousTitles: string[]; nextModuleTitle?: string },
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<z.infer<typeof lessonPlanListSchema>> {
  const depth = DEPTH_GUIDE[request.depth];

  const prompt = `Break module ${context.index + 1} of ${context.total} into lessons.

COURSE: ${blueprint.title} (${blueprint.difficulty})
MODULE ${context.index + 1}: ${modulePlan.title}
MODULE DESCRIPTION: ${modulePlan.description}
MODULE OBJECTIVES:
${modulePlan.learningObjectives.map((objective) => `- ${objective}`).join("\n")}
MODULE FOCUS: ${modulePlan.focus}
TARGET LESSON COUNT: ${modulePlan.lessonCount}

ALREADY COVERED IN EARLIER MODULES:
${context.previousTitles.length ? context.previousTitles.map((title) => `- ${title}`).join("\n") : "- nothing yet, this is the first module"}
${context.nextModuleTitle ? `\nCOMES NEXT (do not pre-empt it): ${context.nextModuleTitle}` : ""}

DOMAIN ANALYSIS:
${blueprint.domainAnalysis}

${calibrationBlock(request)}

Rules:
- Produce ${modulePlan.lessonCount} lessons unless the material clearly demands one more or one fewer.
- Do not repeat ground already covered in earlier modules. If a concept must be revisited, the lesson must extend it, not restate it.
- Each lesson teaches one coherent idea a learner could name afterwards.
- The outline is a contract with the lesson writer: each entry is a specific point to make, in teaching order. Be concrete enough that two different writers would produce the same lesson.
- durationMinutes should be realistic reading-plus-practice time, around ${depth.lessonMinutes} minutes.
- Lesson difficulty may step up within the module but must stay anchored to the course level (${blueprint.difficulty}).

${jsonDiscipline()}`;

  return generateStructured({
    name: "lesson_plan",
    description: "Lesson breakdown for one module.",
    schema: lessonPlanListSchema,
    system: DESIGNER_SYSTEM,
    tier: "reasoning",
    maxTokens: 5000,
    temperature: 0.7,
    prompt,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });
}

/* -------------------------------------------------------------------------- */
/*  Assembly                                                                  */
/* -------------------------------------------------------------------------- */

export function assembleModule(plan: ModulePlan, lessons: LessonPlan[]): Module {
  return {
    id: id("module"),
    title: plan.title,
    description: plan.description,
    learningObjectives: plan.learningObjectives,
    quiz: null,
    lessons: lessons.map((lesson) => ({
      id: id("lesson"),
      title: lesson.title,
      summary: lesson.summary,
      durationMinutes: lesson.durationMinutes,
      difficulty: lesson.difficulty,
      learningObjectives: lesson.learningObjectives,
      introduction: "",
      content: [],
      activities: [],
      keyTakeaways: [],
      knowledgeChecks: [],
      quiz: null,
      outline: lesson.outline,
      status: "planned" as const,
    })),
  };
}

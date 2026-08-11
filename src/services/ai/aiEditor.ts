import "server-only";

import { generateStructured, type Usage } from "@/lib/ai/client";
import { DESIGNER_SYSTEM, calibrationBlock, jsonDiscipline, lessonDigest } from "@/lib/ai/prompts";
import type { Course, GenerationRequest, Lesson } from "@/lib/schema/course";
import { id } from "@/lib/utils";
import { z } from "zod";
import { IMPROVE_ACTIONS, type ImproveAction } from "@/lib/ai/improve-actions";
import { lessonBodySchema, normalizeBlocks } from "./lessonGenerator";

export { IMPROVE_ACTIONS } from "@/lib/ai/improve-actions";
export type { ImproveAction } from "@/lib/ai/improve-actions";

export type EditContext = {
  course: Course;
  request: GenerationRequest;
  moduleTitle: string;
};

export async function improveLesson(
  lesson: Lesson,
  action: ImproveAction | "custom",
  context: EditContext,
  opts: { customInstruction?: string; signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<Lesson> {
  const instruction =
    action === "custom"
      ? (opts.customInstruction ?? "Improve this lesson.")
      : IMPROVE_ACTIONS[action].instruction;

  const prompt = `Revise one lesson of an existing course.

COURSE: ${context.course.title} (${context.course.difficulty})
AUDIENCE: ${context.course.audience}
MODULE: ${context.moduleTitle}

CURRENT LESSON:
${lessonDigest(lesson)}

${calibrationBlock(context.request)}

REVISION REQUESTED: ${instruction}

Rules:
- Return the complete revised lesson body, not a diff and not only the changed parts.
- Do not change what the lesson is about or which objectives it serves.
- Do not introduce material that belongs to another lesson in this course.
- Keep the same content-block vocabulary: paragraph, heading, list, callout, code, example, steps, table.
- Accuracy still governs everything. Never invent facts to satisfy the request.

${jsonDiscipline()}`;

  const body = await generateStructured({
    name: "revised_lesson",
    description: "The revised lesson body.",
    schema: lessonBodySchema,
    system: DESIGNER_SYSTEM,
    tier: "writing",
    maxTokens: 12000,
    temperature: 0.7,
    prompt,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });

  return {
    ...lesson,
    introduction: body.introduction,
    content: normalizeBlocks(body.content),
    keyTakeaways: body.keyTakeaways,
    status: "ready",
  };
}

/* -------------------------------------------------------------------------- */
/*  Course-level text edits                                                   */
/* -------------------------------------------------------------------------- */

export const courseCopySchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  description: z.string(),
  learningObjectives: z.array(z.string()).min(3).max(10),
});

export async function improveCourseCopy(
  course: Course,
  instruction: string,
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<z.infer<typeof courseCopySchema>> {
  const prompt = `Revise the top-level copy for this course.

CURRENT TITLE: ${course.title}
CURRENT SUBTITLE: ${course.subtitle}
CURRENT DESCRIPTION: ${course.description}
AUDIENCE: ${course.audience}
LEVEL: ${course.difficulty}

CURRENT OBJECTIVES:
${course.learningObjectives.map((objective, index) => `${index + 1}. ${objective}`).join("\n")}

WHAT THE COURSE ACTUALLY TEACHES:
${course.modules
  .map(
    (module, index) =>
      `${index + 1}. ${module.title}: ${module.lessons.map((lesson) => lesson.title).join(", ")}`,
  )
  .join("\n")}

REVISION REQUESTED: ${instruction}

The copy must describe the course that actually exists above — never promise more than the modules deliver. Objectives must start with observable verbs.

${jsonDiscipline()}`;

  return generateStructured({
    name: "course_copy",
    description: "Revised course title, subtitle, description and objectives.",
    schema: courseCopySchema,
    system: DESIGNER_SYSTEM,
    tier: "reasoning",
    maxTokens: 2500,
    temperature: 0.7,
    prompt,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });
}

/* -------------------------------------------------------------------------- */
/*  Free-form text rewriting (inline editor helper)                           */
/* -------------------------------------------------------------------------- */

const rewriteSchema = z.object({ text: z.string() });

export async function rewriteText(
  text: string,
  instruction: string,
  context: string,
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<string> {
  const result = await generateStructured({
    name: "rewrite_text",
    description: "The rewritten passage.",
    schema: rewriteSchema,
    system: DESIGNER_SYSTEM,
    tier: "fast",
    maxTokens: 3000,
    temperature: 0.7,
    prompt: `Rewrite the passage below.

CONTEXT: ${context}

INSTRUCTION: ${instruction}

PASSAGE:
${text}

Return only the rewritten passage as plain prose. Keep its role in the lesson unchanged.`,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });
  return result.text;
}

/* -------------------------------------------------------------------------- */
/*  New lesson from a title (used by "Add lesson" → generate)                 */
/* -------------------------------------------------------------------------- */

export const lessonSketchSchema = z.object({
  title: z.string(),
  summary: z.string(),
  learningObjectives: z.array(z.string()).min(1).max(3),
  durationMinutes: z.number().int().min(5).max(90),
  outline: z.array(z.string()).min(3).max(9),
});

export async function sketchLesson(
  course: Course,
  moduleId: string,
  hint: string,
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<Pick<Lesson, "id" | "title" | "summary" | "learningObjectives" | "durationMinutes" | "outline" | "difficulty" | "status">> {
  const module = course.modules.find((entry) => entry.id === moduleId);
  if (!module) throw new Error("Module not found");

  const result = await generateStructured({
    name: "lesson_sketch",
    description: "A plan for one new lesson.",
    schema: lessonSketchSchema,
    system: DESIGNER_SYSTEM,
    tier: "reasoning",
    maxTokens: 2000,
    temperature: 0.7,
    prompt: `Plan a new lesson to slot into an existing module.

COURSE: ${course.title} (${course.difficulty})
MODULE: ${module.title} — ${module.description}
MODULE OBJECTIVES: ${module.learningObjectives.join("; ")}

LESSONS ALREADY IN THIS MODULE:
${module.lessons.map((lesson) => `- ${lesson.title}: ${lesson.summary}`).join("\n") || "- none"}

LESSONS ELSEWHERE IN THE COURSE:
${course.modules
  .filter((entry) => entry.id !== moduleId)
  .flatMap((entry) => entry.lessons.map((lesson) => `- ${lesson.title}`))
  .join("\n") || "- none"}

WHAT THE AUTHOR WANTS: ${hint || "a lesson that fills the most important gap in this module"}

The new lesson must not duplicate anything above. The outline is a contract for the writer: specific points in teaching order.

${jsonDiscipline()}`,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });

  return {
    id: id("lesson"),
    title: result.title,
    summary: result.summary,
    learningObjectives: result.learningObjectives,
    durationMinutes: result.durationMinutes,
    outline: result.outline,
    difficulty: course.difficulty,
    status: "planned",
  };
}

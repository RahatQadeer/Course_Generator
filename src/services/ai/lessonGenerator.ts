import "server-only";

import { generateStructured, type Usage } from "@/lib/ai/client";
import {
  DEPTH_GUIDE,
  DESIGNER_SYSTEM,
  calibrationBlock,
  jsonDiscipline,
  lessonDigest,
  sourceBlock,
} from "@/lib/ai/prompts";
import type { GenerationRequest, Lesson, Module } from "@/lib/schema/course";
import { id } from "@/lib/utils";
import { z } from "zod";
import type { Blueprint } from "./coursePlanner";

/* -------------------------------------------------------------------------- */
/*  Content block schema (id-free — ids are assigned after generation)        */
/* -------------------------------------------------------------------------- */

const rawBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("paragraph"),
    text: z.string().describe("2–5 sentences of substantive explanation."),
  }),
  z.object({
    type: z.literal("heading"),
    text: z.string(),
    level: z.union([z.literal(2), z.literal(3)]).default(2),
  }),
  z.object({
    type: z.literal("list"),
    ordered: z.boolean().default(false),
    items: z.array(z.string()).min(2).describe("Each item is a full, informative clause — not one word."),
  }),
  z.object({
    type: z.literal("callout"),
    variant: z.enum(["info", "tip", "warning", "key-concept"]),
    title: z.string().optional(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("code"),
    language: z.string(),
    code: z.string().describe("Runnable, correct, commented where non-obvious."),
    caption: z.string().optional(),
  }),
  z.object({
    type: z.literal("example"),
    title: z.string(),
    scenario: z.string().describe("A concrete, named situation with real specifics."),
    walkthrough: z.array(z.string()).min(2).describe("The reasoning or steps, one per entry."),
    outcome: z.string().optional().describe("What the example proves."),
  }),
  z.object({
    type: z.literal("steps"),
    title: z.string().optional(),
    steps: z
      .array(z.object({ title: z.string(), detail: z.string() }))
      .min(2)
      .describe("Each detail explains how to do the step and how to tell it worked."),
  }),
  z.object({
    type: z.literal("table"),
    caption: z.string().optional(),
    headers: z.array(z.string()).min(2),
    rows: z.array(z.array(z.string())).min(2).describe("Each row must have exactly as many cells as there are headers."),
  }),
]);

export const lessonBodySchema = z.object({
  introduction: z
    .string()
    .describe(
      "2–4 sentences. Open with the concrete problem this lesson solves. No 'In this lesson we will…' preamble.",
    ),
  content: z.array(rawBlockSchema).min(3),
  keyTakeaways: z
    .array(z.string())
    .min(3)
    .max(6)
    .describe("Standalone statements of fact or practice. Each must be true on its own, out of context."),
});

/* -------------------------------------------------------------------------- */
/*  Stage 5 — Lesson body                                                     */
/* -------------------------------------------------------------------------- */

export type LessonContext = {
  request: GenerationRequest;
  blueprint: Blueprint;
  module: Module;
  moduleIndex: number;
  lessonIndex: number;
  /** Titles + summaries of lessons already written, for continuity and de-duplication. */
  priorLessons: { title: string; summary: string }[];
  nextLessonTitle?: string;
};

export async function generateLessonBody(
  lesson: Lesson,
  context: LessonContext,
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void; extraInstruction?: string } = {},
): Promise<Lesson> {
  const { request, blueprint, module, moduleIndex, lessonIndex } = context;
  const depth = DEPTH_GUIDE[request.depth];
  const sources = sourceBlock(request.sources, 24_000);

  const prompt = `Write the full body of one lesson.

COURSE: ${blueprint.title} (${blueprint.difficulty})
COURSE DESCRIPTION: ${blueprint.description}
MODULE ${moduleIndex + 1}: ${module.title} — ${module.description}

LESSON ${lessonIndex + 1}: ${lesson.title}
SUMMARY: ${lesson.summary}
LESSON OBJECTIVES:
${lesson.learningObjectives.map((objective) => `- ${objective}`).join("\n")}

OUTLINE — cover every beat, in this order:
${lesson.outline.map((beat, index) => `${index + 1}. ${beat}`).join("\n")}

ALREADY TAUGHT (do not re-teach; you may reference it in one clause):
${
  context.priorLessons.length
    ? context.priorLessons
        .slice(-14)
        .map((prior) => `- ${prior.title}: ${prior.summary}`)
        .join("\n")
    : "- nothing yet, this is the first lesson of the course"
}
${context.nextLessonTitle ? `\nTAUGHT NEXT (do not pre-empt): ${context.nextLessonTitle}` : ""}

${sources ? `${sources}\n\n` : ""}${calibrationBlock(request)}

FORMAT REQUIREMENTS
- Target ${depth.words} words of body text across ${depth.blocks} content blocks.
- Vary the block types. A wall of paragraphs is a failure; so is a lesson made only of lists.
- Use \`heading\` blocks to break the lesson into 2–4 named sections. Do not put a heading first — the introduction already opens the lesson.
- Include at least one \`example\` block with a named, concrete scenario and a real walkthrough.
- Include a \`steps\` block when the lesson teaches a procedure.
- Include \`code\` blocks only if this subject genuinely involves code or configuration${lesson.outline.some((beat) => /code|command|config|script|query|syntax/i.test(beat)) ? " — this lesson likely does" : " — this lesson probably does not"}. Code must be correct and runnable.
- Use a \`table\` only for genuine comparisons across 2+ dimensions, and give every row exactly as many cells as headers.
- Use \`callout\` sparingly: at most two, for a genuine pitfall, a key definition, or a hard-won tip.

QUALITY BAR
- Every claim must be one you are confident is correct. No invented statistics, benchmarks, version numbers or citations.
- Name real tools, real formats, real numbers where they exist.
- Do not restate the objectives back at the learner, and do not write a summary section — keyTakeaways covers that.
${opts.extraInstruction ? `\nADDITIONAL INSTRUCTION FROM THE AUTHOR: ${opts.extraInstruction}` : ""}

${jsonDiscipline()}`;

  const body = await generateStructured({
    name: "lesson_body",
    description: "Introduction, content blocks and key takeaways for one lesson.",
    schema: lessonBodySchema,
    system: DESIGNER_SYSTEM,
    tier: "writing",
    maxTokens: request.depth === "comprehensive" ? 12000 : 9000,
    temperature: 0.75,
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

/** Attach stable ids and repair malformed tables. */
export function normalizeBlocks(blocks: z.infer<typeof rawBlockSchema>[]): Lesson["content"] {
  return blocks.map((block) => {
    if (block.type === "table") {
      const width = block.headers.length;
      const rows = block.rows
        .map((row) => {
          if (row.length === width) return row;
          if (row.length > width) return row.slice(0, width);
          return [...row, ...Array(width - row.length).fill("")];
        })
        .filter((row) => row.some((cell) => cell.trim()));
      return { ...block, rows, id: id("block") };
    }
    return { ...block, id: id("block") };
  }) as Lesson["content"];
}

/* -------------------------------------------------------------------------- */
/*  Stage 6 — Activities and knowledge checks, per module                     */
/* -------------------------------------------------------------------------- */

const activityPlanSchema = z.object({
  lessonIndex: z.number().int().describe("0-based index of the lesson within this module."),
  activities: z
    .array(
      z.object({
        title: z.string(),
        type: z.enum(["exercise", "reflection", "discussion", "project", "lab"]),
        instructions: z
          .array(z.string())
          .min(2)
          .describe("Numbered steps the learner performs. Specific enough to actually do."),
        estimatedMinutes: z.number().int().min(3).max(180),
        successCriteria: z
          .array(z.string())
          .min(1)
          .max(4)
          .describe("How the learner knows they did it right."),
      }),
    )
    .min(1)
    .max(2),
  knowledgeChecks: z
    .array(
      z.object({
        prompt: z.string().describe("An open question that makes the learner retrieve, not recognise."),
        answer: z.string().describe("The model answer, 1–3 sentences, drawn only from this lesson."),
      }),
    )
    .min(1)
    .max(3),
});

export const activityBatchSchema = z.object({
  lessons: z.array(activityPlanSchema),
});

export async function generateModuleActivities(
  request: GenerationRequest,
  blueprint: Blueprint,
  module: Module,
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<Module> {
  const digests = module.lessons
    .map((lesson, index) => `<lesson index="${index}">\n${lessonDigest(lesson)}\n</lesson>`)
    .join("\n\n");

  const prompt = `Write practice activities and knowledge checks for every lesson in this module.

COURSE: ${blueprint.title} (${blueprint.difficulty})
MODULE: ${module.title} — ${module.description}

LESSON CONTENT (this is everything the learner has been taught):
${digests}

${calibrationBlock(request)}

Rules:
- One activity per lesson (two only when the lesson teaches a procedure worth both practising and reflecting on).
- Activities must exercise exactly what the lesson taught — nothing that requires unstated knowledge, tools or data.
- Instructions must be executable by someone with only this lesson's content. If an activity needs a dataset, file or tool, either describe how to obtain it in the instructions or choose a different activity.
- Reflection and discussion activities are legitimate, but at ${blueprint.difficulty} level most should be hands-on.
- Knowledge checks are retrieval practice: open questions with short model answers. Never yes/no. Never answerable from the question itself.
- Return one entry per lesson, using the 0-based lessonIndex shown above. Include every lesson.

${jsonDiscipline()}`;

  const result = await generateStructured({
    name: "module_activities",
    description: "Activities and knowledge checks for each lesson in a module.",
    schema: activityBatchSchema,
    system: DESIGNER_SYSTEM,
    tier: "writing",
    maxTokens: 9000,
    temperature: 0.7,
    prompt,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });

  const byIndex = new Map(result.lessons.map((entry) => [entry.lessonIndex, entry]));

  return {
    ...module,
    lessons: module.lessons.map((lesson, index) => {
      const entry = byIndex.get(index);
      if (!entry) return lesson;
      return {
        ...lesson,
        activities: entry.activities.map((activity) => ({ ...activity, id: id("act") })),
        knowledgeChecks: entry.knowledgeChecks.map((check) => ({ ...check, id: id("kc") })),
      };
    }),
  };
}

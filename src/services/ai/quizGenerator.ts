import "server-only";

import { generateStructured, type Usage } from "@/lib/ai/client";
import { DESIGNER_SYSTEM, calibrationBlock, jsonDiscipline, lessonDigest } from "@/lib/ai/prompts";
import type { GenerationRequest, Lesson, Module, Quiz } from "@/lib/schema/course";
import { difficultySchema, questionTypeSchema } from "@/lib/schema/course";
import { id } from "@/lib/utils";
import { z } from "zod";
import type { Blueprint } from "./coursePlanner";

/* -------------------------------------------------------------------------- */
/*  Shared question schema                                                    */
/* -------------------------------------------------------------------------- */

const rawQuestionSchema = z.object({
  type: questionTypeSchema,
  question: z.string().describe("Self-contained. Never 'according to the lesson' or 'which of the following is NOT'."),
  options: z
    .array(z.string())
    .default([])
    .describe(
      "4 options for multiple-choice, exactly ['True','False'] for true-false, 4–6 for multi-select, empty for short-answer.",
    ),
  correctOptionIndexes: z
    .array(z.number().int())
    .default([])
    .describe("0-based indexes of correct options. Exactly one for multiple-choice and true-false, 2+ for multi-select, empty for short-answer."),
  sampleAnswer: z.string().default("").describe("Model answer for short-answer questions. Empty otherwise."),
  explanation: z
    .string()
    .describe("Why the correct answer is correct AND why a plausible wrong answer is wrong. 1–3 sentences."),
  difficulty: difficultySchema,
  taughtIn: z
    .string()
    .describe("The exact lesson title where this was taught. Must match one of the titles given to you."),
});

type RawQuestion = z.infer<typeof rawQuestionSchema>;

const QUESTION_RULES = `QUESTION RULES — these are hard requirements:
- Every question must be answerable from the lesson content provided. If the content does not teach it, do not ask it. This is the single most important rule.
- Test understanding and application, not recall of a phrase. Prefer "what happens if…", "which approach fits this situation…", "why does X fail when…" over "what is the definition of X".
- Distractors must be plausible to someone who half-learned the material — common misconceptions, adjacent concepts, right answer to a different question. Never absurd, never obviously longer or shorter than the correct option.
- The correct option must not be identifiable by length, specificity, or hedging language.
- No "All of the above", "None of the above", "Both A and B".
- Do not negate the stem ("which is NOT…") more than once per quiz.
- true-false options must be exactly ["True", "False"].
- multi-select must have 2 or more correct indexes and say so in the stem ("Select all that apply").
- short-answer must have empty options, empty correctOptionIndexes, and a real sampleAnswer.
- Explanations teach: they must add something beyond restating the correct option.`;

function toQuestion(raw: RawQuestion, lessonIdByTitle: Map<string, string>): Quiz["questions"][number] {
  const options = raw.type === "true-false" ? ["True", "False"] : raw.type === "short-answer" ? [] : raw.options;
  let correct = raw.correctOptionIndexes.filter((index) => index >= 0 && index < options.length);

  if (raw.type === "short-answer") correct = [];
  else if (!correct.length) correct = [0];
  else if (raw.type !== "multi-select") correct = [correct[0]];

  return {
    id: id("q"),
    type: raw.type,
    question: raw.question,
    options,
    correctOptionIndexes: correct,
    sampleAnswer: raw.sampleAnswer || undefined,
    explanation: raw.explanation,
    difficulty: raw.difficulty,
    sourceLessonId: lessonIdByTitle.get(raw.taughtIn.trim().toLowerCase()),
    points: raw.type === "short-answer" ? 2 : raw.type === "multi-select" ? 2 : 1,
  };
}

/* -------------------------------------------------------------------------- */
/*  Stage 7a — Lesson quizzes                                                 */
/* -------------------------------------------------------------------------- */

export const lessonQuizBatchSchema = z.object({
  quizzes: z.array(
    z.object({
      lessonIndex: z.number().int(),
      questions: z.array(rawQuestionSchema).min(2).max(6),
    }),
  ),
});

function questionCount(depth: GenerationRequest["depth"]): string {
  return depth === "concise" ? "2–3" : depth === "comprehensive" ? "4–5" : "3–4";
}

export async function generateLessonQuizzes(
  request: GenerationRequest,
  blueprint: Blueprint,
  module: Module,
  lessons: { lesson: Lesson; index: number }[],
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<Map<string, Quiz>> {
  const digests = lessons
    .map(({ lesson }, position) => `<lesson index="${position}">\n${lessonDigest(lesson)}\n</lesson>`)
    .join("\n\n");

  const prompt = `Write a short end-of-lesson quiz for each lesson below.

COURSE: ${blueprint.title} (${blueprint.difficulty})
MODULE: ${module.title}

LESSON CONTENT — the complete set of what these learners have been taught:
${digests}

${calibrationBlock(request)}

Write ${questionCount(request.depth)} questions per lesson. Mix the question types across the quiz — do not make every question multiple-choice. Calibrate difficulty to ${blueprint.difficulty}, with one question per quiz that stretches slightly beyond it.

Set \`taughtIn\` to the exact lesson title the question comes from.

${QUESTION_RULES}

${jsonDiscipline()}`;

  const result = await generateStructured({
    name: "lesson_quizzes",
    description: "One quiz per lesson, grounded strictly in that lesson's content.",
    schema: lessonQuizBatchSchema,
    system: DESIGNER_SYSTEM,
    tier: "writing",
    maxTokens: 10000,
    temperature: 0.65,
    prompt,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });

  const titleToId = new Map(lessons.map(({ lesson }) => [lesson.title.trim().toLowerCase(), lesson.id]));
  const output = new Map<string, Quiz>();

  for (const entry of result.quizzes) {
    const target = lessons[entry.lessonIndex];
    if (!target) continue;
    output.set(target.lesson.id, {
      id: id("quiz"),
      title: `${target.lesson.title} — Knowledge Check`,
      description: undefined,
      passingScore: 70,
      questions: entry.questions.map((raw) =>
        toQuestion({ ...raw, taughtIn: target.lesson.title }, titleToId),
      ),
    });
  }

  return output;
}

/* -------------------------------------------------------------------------- */
/*  Stage 7b — Module quiz                                                    */
/* -------------------------------------------------------------------------- */

export const moduleQuizSchema = z.object({
  title: z.string(),
  description: z.string().describe("One sentence telling the learner what this quiz covers."),
  questions: z.array(rawQuestionSchema).min(4).max(12),
});

export async function generateModuleQuiz(
  request: GenerationRequest,
  blueprint: Blueprint,
  module: Module,
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<Quiz> {
  const digests = module.lessons
    .map((lesson) => `<lesson title="${lesson.title.replace(/"/g, "'")}">\n${lessonDigest(lesson)}\n</lesson>`)
    .join("\n\n");

  const count = Math.min(12, Math.max(5, module.lessons.length * 2));

  const prompt = `Write the end-of-module assessment.

COURSE: ${blueprint.title} (${blueprint.difficulty})
MODULE: ${module.title} — ${module.description}
MODULE OBJECTIVES:
${module.learningObjectives.map((objective) => `- ${objective}`).join("\n")}

LESSON CONTENT — everything taught in this module:
${digests}

${calibrationBlock(request)}

Write ${count} questions that together prove the module objectives were met.
- Cover every lesson; weight toward the lessons that carry the module's objectives.
- At least a third of the questions must combine material from two or more lessons — that is what makes this a module assessment rather than a longer lesson quiz.
- Include a spread of question types and a spread of difficulty, ending with 1–2 genuinely hard questions.
- Set \`taughtIn\` to the exact lesson title where the material was taught (for cross-lesson questions, the lesson carrying most of the answer).

${QUESTION_RULES}

${jsonDiscipline()}`;

  const result = await generateStructured({
    name: "module_quiz",
    description: "End-of-module assessment.",
    schema: moduleQuizSchema,
    system: DESIGNER_SYSTEM,
    tier: "writing",
    maxTokens: 9000,
    temperature: 0.65,
    prompt,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });

  const titleToId = new Map(module.lessons.map((lesson) => [lesson.title.trim().toLowerCase(), lesson.id]));

  return {
    id: id("quiz"),
    title: result.title || `${module.title} — Module Assessment`,
    description: result.description,
    passingScore: 70,
    questions: result.questions.map((raw) => toQuestion(raw, titleToId)),
  };
}

export { rawQuestionSchema, QUESTION_RULES, toQuestion };

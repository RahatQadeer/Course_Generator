import "server-only";

import { generateStructured, type Usage } from "@/lib/ai/client";
import { DESIGNER_SYSTEM, calibrationBlock, jsonDiscipline } from "@/lib/ai/prompts";
import type { Course, GenerationRequest, Quiz } from "@/lib/schema/course";
import { id } from "@/lib/utils";
import { z } from "zod";
import type { Blueprint } from "./coursePlanner";
import { QUESTION_RULES, rawQuestionSchema, toQuestion } from "./quizGenerator";

/* -------------------------------------------------------------------------- */
/*  Stage 8 — Final assessment                                                */
/* -------------------------------------------------------------------------- */

export const finalAssessmentSchema = z.object({
  title: z.string(),
  description: z.string().describe("2–3 sentences: what this assessment proves and how it is structured."),
  passingScore: z.number().int().min(50).max(90),
  // The prompt asks for a specific count; this floor only rejects junk. Keeping
  // it loose avoids an expensive repair pass when the model returns 7 of 8.
  questions: z.array(rawQuestionSchema).min(6).max(30),
});

/** A course-wide syllabus digest — titles, objectives and takeaways only. */
function syllabusDigest(course: Course): string {
  return course.modules
    .map((module, moduleIndex) => {
      const lessons = module.lessons
        .map(
          (lesson) =>
            `  - ${lesson.title}: ${lesson.summary}\n` +
            (lesson.keyTakeaways.length
              ? lesson.keyTakeaways.map((takeaway) => `      • ${takeaway}`).join("\n")
              : ""),
        )
        .join("\n");
      return `MODULE ${moduleIndex + 1}: ${module.title}\nObjectives: ${module.learningObjectives.join("; ")}\nLessons:\n${lessons}`;
    })
    .join("\n\n");
}

export async function generateFinalAssessment(
  request: GenerationRequest,
  blueprint: Blueprint,
  course: Course,
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<Quiz> {
  const lessonCount = course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const count = Math.min(28, Math.max(10, Math.round(lessonCount * 1.3)));

  const prompt = `Write the final assessment for this course.

COURSE: ${course.title} (${blueprint.difficulty})
DESCRIPTION: ${course.description}
AUDIENCE: ${course.audience}

COURSE OBJECTIVES:
${course.learningObjectives.map((objective, index) => `${index + 1}. ${objective}`).join("\n")}

SYLLABUS — every lesson taught, with its key takeaways:
${syllabusDigest(course)}

${calibrationBlock(request)}

Write ${count} questions forming a summative assessment.
- Every course objective must be tested by at least one question. Distribute coverage across all ${course.modules.length} modules; do not over-sample the first module.
- Prioritise synthesis: questions that require material from more than one module are the point of a final assessment. At least half should be of this kind.
- Include 2–4 scenario questions that present a realistic situation and ask the learner to choose or justify a course of action.
- Sequence from moderate to hard.
- passingScore should reflect the stakes: 70 for most courses, higher only if the material is safety-critical or certification-grade.
- Set \`taughtIn\` to the exact lesson title where the primary material was taught.

${QUESTION_RULES}

${jsonDiscipline()}`;

  const result = await generateStructured({
    name: "final_assessment",
    description: "Summative assessment covering the whole course.",
    schema: finalAssessmentSchema,
    system: DESIGNER_SYSTEM,
    tier: "reasoning",
    maxTokens: 16000,
    temperature: 0.65,
    prompt,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });

  const titleToId = new Map(
    course.modules.flatMap((module) =>
      module.lessons.map((lesson) => [lesson.title.trim().toLowerCase(), lesson.id] as const),
    ),
  );

  return {
    id: id("quiz"),
    title: result.title || `${course.title} — Final Assessment`,
    description: result.description,
    passingScore: result.passingScore,
    questions: result.questions.map((raw) => toQuestion(raw, titleToId)),
  };
}

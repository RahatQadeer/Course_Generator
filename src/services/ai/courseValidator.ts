import "server-only";

import { generateStructured, type Usage } from "@/lib/ai/client";
import { DESIGNER_SYSTEM, jsonDiscipline } from "@/lib/ai/prompts";
import type { ContentBlock, Course, QualityReport, Question } from "@/lib/schema/course";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Deterministic structural checks                                           */
/* -------------------------------------------------------------------------- */

export type StructuralIssue = QualityReport["issues"][number];

/**
 * Things we can know for certain without asking a model. These are cheap,
 * always correct, and they stop the AI reviewer from wasting attention on
 * mechanical problems.
 */
export function structuralCheck(course: Course): { score: number; issues: StructuralIssue[] } {
  const issues: StructuralIssue[] = [];
  const penalty = { critical: 18, major: 8, minor: 3 };

  if (!course.modules.length) {
    issues.push({ severity: "critical", area: "Structure", detail: "The course has no modules.", fixed: false });
  }

  const seenTitles = new Map<string, number>();
  let emptyLessons = 0;
  let thinLessons = 0;

  for (const module of course.modules) {
    if (!module.lessons.length) {
      issues.push({
        severity: "major",
        area: "Structure",
        detail: `Module "${module.title}" has no lessons.`,
        targetId: module.id,
        fixed: false,
      });
    }
    if (!module.learningObjectives.length) {
      issues.push({
        severity: "minor",
        area: "Objectives",
        detail: `Module "${module.title}" has no learning objectives.`,
        targetId: module.id,
        fixed: false,
      });
    }

    for (const lesson of module.lessons) {
      const key = lesson.title.trim().toLowerCase();
      seenTitles.set(key, (seenTitles.get(key) ?? 0) + 1);

      if (!lesson.content.length) {
        emptyLessons++;
        issues.push({
          severity: "critical",
          area: "Content",
          detail: `Lesson "${lesson.title}" has no content.`,
          targetId: lesson.id,
          fixed: false,
        });
      } else {
        const words = lesson.content.reduce((sum, block) => sum + blockWords(block), 0);
        if (words < 180) {
          thinLessons++;
          issues.push({
            severity: "major",
            area: "Content",
            detail: `Lesson "${lesson.title}" is only ~${words} words — too thin to teach anything.`,
            targetId: lesson.id,
            fixed: false,
          });
        }
      }

      if (!lesson.learningObjectives.length) {
        issues.push({
          severity: "minor",
          area: "Objectives",
          detail: `Lesson "${lesson.title}" has no learning objective.`,
          targetId: lesson.id,
          fixed: false,
        });
      }

      for (const question of lesson.quiz?.questions ?? []) {
        const problem = questionProblem(question);
        if (problem) {
          issues.push({
            severity: "major",
            area: "Assessment",
            detail: `In "${lesson.title}": ${problem}`,
            targetId: lesson.id,
            fixed: false,
          });
        }
      }
    }

    for (const question of module.quiz?.questions ?? []) {
      const problem = questionProblem(question);
      if (problem) {
        issues.push({
          severity: "major",
          area: "Assessment",
          detail: `In the "${module.title}" quiz: ${problem}`,
          targetId: module.id,
          fixed: false,
        });
      }
    }
  }

  for (const [title, count] of seenTitles) {
    if (count > 1) {
      issues.push({
        severity: "major",
        area: "Structure",
        detail: `${count} lessons share the title "${title}" — the curriculum repeats itself.`,
        fixed: false,
      });
    }
  }

  for (const question of course.finalAssessment?.questions ?? []) {
    const problem = questionProblem(question);
    if (problem) {
      issues.push({
        severity: "major",
        area: "Assessment",
        detail: `In the final assessment: ${problem}`,
        fixed: false,
      });
    }
  }

  const deduction = issues.reduce((sum, issue) => sum + penalty[issue.severity], 0);
  void emptyLessons;
  void thinLessons;

  return { score: Math.max(0, 100 - deduction), issues };
}

function blockWords(block: ContentBlock): number {
  const count = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
  switch (block.type) {
    case "paragraph":
    case "heading":
      return count(block.text);
    case "list":
      return block.items.reduce((sum, item) => sum + count(item), 0);
    case "callout":
      return count(block.text) + count(block.title ?? "");
    case "code":
      return Math.round(count(block.code) / 2);
    case "example":
      return count(block.scenario) + block.walkthrough.reduce((sum, step) => sum + count(step), 0);
    case "steps":
      return block.steps.reduce((sum, step) => sum + count(step.title) + count(step.detail), 0);
    case "table":
      return block.rows.flat().reduce((sum, cell) => sum + count(cell), 0);
  }
}

function questionProblem(question: Question): string | null {
  const { type, options, correctOptionIndexes, explanation } = question;
  if (type === "short-answer") {
    if (!question.sampleAnswer?.trim()) return `a short-answer question has no model answer.`;
    return null;
  }
  if (options.length < 2) return `"${question.question.slice(0, 60)}…" has fewer than two options.`;
  if (!correctOptionIndexes.length) return `"${question.question.slice(0, 60)}…" has no correct answer marked.`;
  if (correctOptionIndexes.some((index) => index < 0 || index >= options.length)) {
    return `"${question.question.slice(0, 60)}…" points at an option that does not exist.`;
  }
  if (type === "multi-select" && correctOptionIndexes.length < 2) {
    return `"${question.question.slice(0, 60)}…" is multi-select but has one correct answer.`;
  }
  if (type !== "multi-select" && correctOptionIndexes.length > 1) {
    return `"${question.question.slice(0, 60)}…" is single-answer but marks several as correct.`;
  }
  if (new Set(options.map((option) => option.trim().toLowerCase())).size !== options.length) {
    return `"${question.question.slice(0, 60)}…" has duplicate options.`;
  }
  if (!explanation.trim()) return `"${question.question.slice(0, 60)}…" has no explanation.`;
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Stage 9 — AI review                                                       */
/* -------------------------------------------------------------------------- */

export const reviewSchema = z.object({
  content: z.object({
    score: z.number().min(0).max(100),
    notes: z.string().describe("One or two sentences. Concrete, not encouraging."),
  }),
  objectiveAlignment: z.object({
    score: z.number().min(0).max(100),
    notes: z.string(),
  }),
  assessment: z.object({
    score: z.number().min(0).max(100),
    notes: z.string(),
  }),
  structure: z.object({
    score: z.number().min(0).max(100),
    notes: z.string(),
  }),
  strengths: z.array(z.string()).max(4),
  issues: z
    .array(
      z.object({
        severity: z.enum(["critical", "major", "minor"]),
        area: z.enum(["Structure", "Content", "Objectives", "Assessment", "Accuracy", "Redundancy"]),
        detail: z.string().describe("What is wrong, naming the module or lesson."),
        lessonTitle: z
          .string()
          .default("")
          .describe("Exact title of the lesson at fault, or empty if the issue is course-wide."),
        fixInstruction: z
          .string()
          .default("")
          .describe("A single instruction that would fix it if the lesson were rewritten. Empty for course-wide issues."),
      }),
    )
    .max(12),
});

export type AIReview = z.infer<typeof reviewSchema>;

/** A compact but faithful rendering of the course for review. */
function reviewDigest(course: Course): string {
  return course.modules
    .map((module, moduleIndex) => {
      const lessons = module.lessons
        .map((lesson) => {
          const blocks = lesson.content
            .map((block) => {
              switch (block.type) {
                case "paragraph":
                  return block.text.slice(0, 320);
                case "heading":
                  return `## ${block.text}`;
                case "list":
                  return block.items.slice(0, 5).map((item) => `• ${item.slice(0, 140)}`).join("\n");
                case "example":
                  return `EXAMPLE ${block.title}: ${block.scenario.slice(0, 220)}`;
                case "steps":
                  return block.steps.map((step) => `→ ${step.title}`).join("\n");
                case "callout":
                  return `[${block.variant}] ${block.text.slice(0, 200)}`;
                case "code":
                  return `<code ${block.language}, ${block.code.split("\n").length} lines>`;
                case "table":
                  return `<table: ${block.headers.join(" | ")}>`;
              }
            })
            .join("\n");
          const quiz = lesson.quiz
            ? `\n    QUIZ: ${lesson.quiz.questions.map((question) => `[${question.type}] ${question.question}`).join(" || ")}`
            : "";
          return `  LESSON: ${lesson.title} (${lesson.durationMinutes}min, ${lesson.difficulty})\n    Objectives: ${lesson.learningObjectives.join("; ")}\n    Intro: ${lesson.introduction.slice(0, 240)}\n${blocks
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n")}\n    Takeaways: ${lesson.keyTakeaways.join(" | ")}\n    Activity: ${lesson.activities.map((activity) => activity.title).join(", ") || "none"}${quiz}`;
        })
        .join("\n\n");
      const moduleQuiz = module.quiz
        ? `\n  MODULE QUIZ (${module.quiz.questions.length} questions): ${module.quiz.questions
            .map((question) => question.question)
            .join(" || ")}`
        : "";
      return `MODULE ${moduleIndex + 1}: ${module.title}\n  ${module.description}\n  Objectives: ${module.learningObjectives.join("; ")}\n\n${lessons}${moduleQuiz}`;
    })
    .join("\n\n———\n\n");
}

export async function reviewCourse(
  course: Course,
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<AIReview> {
  const prompt = `Review this generated course as a demanding curriculum editor. You are not here to be encouraging — you are here to catch what would embarrass the author in front of a paying learner.

COURSE: ${course.title}
DESCRIPTION: ${course.description}
AUDIENCE: ${course.audience}
LEVEL: ${course.difficulty}
DURATION: ${course.duration}

COURSE OBJECTIVES:
${course.learningObjectives.map((objective, index) => `${index + 1}. ${objective}`).join("\n")}

CURRICULUM:
${reviewDigest(course)}

${course.finalAssessment ? `FINAL ASSESSMENT (${course.finalAssessment.questions.length} questions):\n${course.finalAssessment.questions.map((question) => `- [${question.type}] ${question.question}`).join("\n")}` : "FINAL ASSESSMENT: none"}

Judge these four dimensions on a 0–100 scale, where 70 is "publishable but ordinary", 85 is "genuinely good", and 95+ is reserved for work you could not improve:

1. STRUCTURE — Does the curriculum progress logically? Are dependencies respected? Is anything out of order, missing, or redundant?
2. CONTENT — Are explanations substantive and accurate? Are examples concrete? Is anything vague, padded, or repeated across lessons? Flag any claim you believe is factually wrong.
3. OBJECTIVE ALIGNMENT — Does every lesson serve a stated objective? Is any course objective unserved by the curriculum? Are objectives observable and assessable?
4. ASSESSMENT — Do quiz questions test material actually taught in the lessons shown? Flag any question testing something never covered. Are distractors plausible? Is difficulty consistent?

For each problem, report an issue. Use severity honestly:
- critical: the course cannot ship — a lesson is empty, an objective is untaught, a quiz tests untaught material, or something is factually wrong.
- major: a learner would notice and be let down.
- minor: polish.

When an issue is confined to one lesson, set lessonTitle to that lesson's exact title and write a fixInstruction that a rewriter could follow verbatim.

Do not invent problems to seem thorough. If a dimension is genuinely strong, say so and score it high.

${jsonDiscipline()}`;

  return generateStructured({
    name: "course_review",
    description: "Quality review of the generated course.",
    schema: reviewSchema,
    system: DESIGNER_SYSTEM,
    tier: "reasoning",
    maxTokens: 6000,
    temperature: 0.35,
    prompt,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });
}

/* -------------------------------------------------------------------------- */
/*  Report assembly                                                           */
/* -------------------------------------------------------------------------- */

export function buildReport(
  structural: { score: number; issues: StructuralIssue[] },
  review: AIReview | null,
  course: Course,
): QualityReport {
  const aiIssues: StructuralIssue[] =
    review?.issues.map((issue) => ({
      severity: issue.severity,
      area: issue.area,
      detail: issue.detail,
      targetId: findLessonIdByTitle(course, issue.lessonTitle),
      fixed: false,
    })) ?? [];

  const issues = dedupeIssues([...structural.issues, ...aiIssues]);

  // Structure is scored by both; take the harsher view.
  const structureScore = review
    ? Math.round(Math.min(structural.score, review.structure.score) * 0.5 + structural.score * 0.5)
    : structural.score;

  const dimensions = {
    structure: {
      score: clamp(structureScore),
      notes: review?.structure.notes ?? structuralNote(structural.issues, "Structure"),
    },
    content: {
      score: clamp(review?.content.score ?? structural.score),
      notes: review?.content.notes ?? structuralNote(structural.issues, "Content"),
    },
    objectiveAlignment: {
      score: clamp(review?.objectiveAlignment.score ?? structural.score),
      notes: review?.objectiveAlignment.notes ?? structuralNote(structural.issues, "Objectives"),
    },
    assessment: {
      score: clamp(review?.assessment.score ?? structural.score),
      notes: review?.assessment.notes ?? structuralNote(structural.issues, "Assessment"),
    },
  };

  const weighted =
    dimensions.structure.score * 0.2 +
    dimensions.content.score * 0.4 +
    dimensions.objectiveAlignment.score * 0.2 +
    dimensions.assessment.score * 0.2;

  const unfixedCritical = issues.filter((issue) => issue.severity === "critical" && !issue.fixed).length;

  return {
    overall: clamp(Math.round(weighted - unfixedCritical * 6)),
    dimensions,
    issues,
    strengths: review?.strengths ?? [],
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function structuralNote(issues: StructuralIssue[], area: string): string {
  const relevant = issues.filter((issue) => issue.area === area);
  return relevant.length ? relevant[0].detail : "No structural problems detected.";
}

function dedupeIssues(issues: StructuralIssue[]): StructuralIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.area}|${issue.detail.slice(0, 80).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function findLessonIdByTitle(course: Course, title: string): string | undefined {
  if (!title.trim()) return undefined;
  const needle = title.trim().toLowerCase();
  for (const module of course.modules) {
    const match = module.lessons.find((lesson) => lesson.title.trim().toLowerCase() === needle);
    if (match) return match.id;
  }
  return undefined;
}

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Primitives                                                                */
/* -------------------------------------------------------------------------- */

export const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;
export const difficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof difficultySchema>;

export const TEACHING_STYLES = [
  "practical",
  "academic",
  "conversational",
  "socratic",
  "storytelling",
  "case-study",
] as const;
export const teachingStyleSchema = z.enum(TEACHING_STYLES);
export type TeachingStyle = z.infer<typeof teachingStyleSchema>;

export const QUESTION_TYPES = ["multiple-choice", "true-false", "multi-select", "short-answer"] as const;
export const questionTypeSchema = z.enum(QUESTION_TYPES);
export type QuestionType = z.infer<typeof questionTypeSchema>;

/* -------------------------------------------------------------------------- */
/*  Lesson content blocks                                                     */
/* -------------------------------------------------------------------------- */

const blockBase = { id: z.string() };

export const paragraphBlockSchema = z.object({
  ...blockBase,
  type: z.literal("paragraph"),
  text: z.string(),
});

export const headingBlockSchema = z.object({
  ...blockBase,
  type: z.literal("heading"),
  text: z.string(),
  level: z.union([z.literal(2), z.literal(3)]).default(2),
});

export const listBlockSchema = z.object({
  ...blockBase,
  type: z.literal("list"),
  ordered: z.boolean().default(false),
  items: z.array(z.string()),
});

export const calloutBlockSchema = z.object({
  ...blockBase,
  type: z.literal("callout"),
  variant: z.enum(["info", "tip", "warning", "key-concept"]).default("info"),
  title: z.string().optional(),
  text: z.string(),
});

export const codeBlockSchema = z.object({
  ...blockBase,
  type: z.literal("code"),
  language: z.string().default("text"),
  code: z.string(),
  caption: z.string().optional(),
});

export const exampleBlockSchema = z.object({
  ...blockBase,
  type: z.literal("example"),
  title: z.string(),
  scenario: z.string(),
  walkthrough: z.array(z.string()).default([]),
  outcome: z.string().optional(),
});

export const stepsBlockSchema = z.object({
  ...blockBase,
  type: z.literal("steps"),
  title: z.string().optional(),
  steps: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
    }),
  ),
});

export const tableBlockSchema = z.object({
  ...blockBase,
  type: z.literal("table"),
  caption: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const contentBlockSchema = z.discriminatedUnion("type", [
  paragraphBlockSchema,
  headingBlockSchema,
  listBlockSchema,
  calloutBlockSchema,
  codeBlockSchema,
  exampleBlockSchema,
  stepsBlockSchema,
  tableBlockSchema,
]);

export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type ContentBlockType = ContentBlock["type"];

/* -------------------------------------------------------------------------- */
/*  Assessment                                                                */
/* -------------------------------------------------------------------------- */

export const questionSchema = z.object({
  id: z.string(),
  type: questionTypeSchema,
  question: z.string(),
  /** Empty for short-answer. */
  options: z.array(z.string()).default([]),
  /** Indices into `options` for choice questions; free text for short-answer. */
  correctOptionIndexes: z.array(z.number().int()).default([]),
  sampleAnswer: z.string().optional(),
  explanation: z.string(),
  difficulty: difficultySchema,
  /** Which lesson taught this — keeps assessments grounded in real content. */
  sourceLessonId: z.string().optional(),
  points: z.number().int().min(1).default(1),
});
export type Question = z.infer<typeof questionSchema>;

export const quizSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  passingScore: z.number().int().min(0).max(100).default(70),
  questions: z.array(questionSchema),
});
export type Quiz = z.infer<typeof quizSchema>;

export const knowledgeCheckSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  answer: z.string(),
});
export type KnowledgeCheck = z.infer<typeof knowledgeCheckSchema>;

export const activitySchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["exercise", "reflection", "discussion", "project", "lab"]).default("exercise"),
  instructions: z.array(z.string()),
  estimatedMinutes: z.number().int().min(1).default(10),
  successCriteria: z.array(z.string()).default([]),
});
export type Activity = z.infer<typeof activitySchema>;

/* -------------------------------------------------------------------------- */
/*  Lesson / Module / Course                                                  */
/* -------------------------------------------------------------------------- */

export const lessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  durationMinutes: z.number().int().min(1).default(15),
  difficulty: difficultySchema,
  learningObjectives: z.array(z.string()).default([]),
  introduction: z.string().default(""),
  content: z.array(contentBlockSchema).default([]),
  activities: z.array(activitySchema).default([]),
  keyTakeaways: z.array(z.string()).default([]),
  knowledgeChecks: z.array(knowledgeCheckSchema).default([]),
  quiz: quizSchema.nullable().default(null),
  /** Populated during curriculum planning, consumed by the lesson writer. */
  outline: z.array(z.string()).default([]),
  status: z.enum(["planned", "generating", "ready", "failed"]).default("ready"),
});
export type Lesson = z.infer<typeof lessonSchema>;

export const moduleSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  learningObjectives: z.array(z.string()).default([]),
  lessons: z.array(lessonSchema).default([]),
  quiz: quizSchema.nullable().default(null),
});
export type Module = z.infer<typeof moduleSchema>;

export const qualityDimensionSchema = z.object({
  score: z.number().min(0).max(100),
  notes: z.string(),
});

export const qualityReportSchema = z.object({
  overall: z.number().min(0).max(100),
  dimensions: z.object({
    structure: qualityDimensionSchema,
    content: qualityDimensionSchema,
    objectiveAlignment: qualityDimensionSchema,
    assessment: qualityDimensionSchema,
  }),
  issues: z.array(
    z.object({
      severity: z.enum(["critical", "major", "minor"]),
      area: z.string(),
      detail: z.string(),
      targetId: z.string().optional(),
      fixed: z.boolean().default(false),
    }),
  ).default([]),
  strengths: z.array(z.string()).default([]),
});
export type QualityReport = z.infer<typeof qualityReportSchema>;

export const courseMetaSchema = z.object({
  topic: z.string(),
  language: z.string().default("English"),
  teachingStyle: teachingStyleSchema.default("practical"),
  sourceSummary: z.string().optional(),
  sourceNames: z.array(z.string()).default([]),
  generatedAt: z.string(),
  model: z.string().optional(),
});

export const courseSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().default(""),
  description: z.string(),
  audience: z.string(),
  difficulty: difficultySchema,
  duration: z.string(),
  estimatedHours: z.number().min(0).default(0),
  prerequisites: z.array(z.string()).default([]),
  learningObjectives: z.array(z.string()).default([]),
  outcomes: z.array(z.string()).default([]),
  modules: z.array(moduleSchema).default([]),
  finalAssessment: quizSchema.nullable().default(null),
  quality: qualityReportSchema.nullable().default(null),
  themeId: z.string().default("modern"),
  meta: courseMetaSchema,
  updatedAt: z.string(),
});
export type Course = z.infer<typeof courseSchema>;

/* -------------------------------------------------------------------------- */
/*  Generation request                                                        */
/* -------------------------------------------------------------------------- */

export const sourceMaterialSchema = z.object({
  id: z.string(),
  kind: z.enum(["file", "url", "youtube", "text"]),
  name: z.string(),
  charCount: z.number().int().min(0),
  text: z.string(),
});
export type SourceMaterial = z.infer<typeof sourceMaterialSchema>;

export const generationRequestSchema = z.object({
  topic: z.string().min(3, "Describe your course topic"),
  title: z.string().optional(),
  description: z.string().optional(),
  audience: z.string().min(2, "Who is this course for?"),
  difficulty: difficultySchema,
  duration: z.string().min(1),
  moduleCount: z.number().int().min(1).max(16),
  language: z.string().default("English"),
  teachingStyle: teachingStyleSchema,
  sources: z.array(sourceMaterialSchema).default([]),
  /** Depth of generated lessons. */
  depth: z.enum(["concise", "standard", "comprehensive"]).default("standard"),
  includeQuizzes: z.boolean().default(true),
  includeFinalAssessment: z.boolean().default(true),
});
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export const TEACHING_STYLE_LABEL: Record<TeachingStyle, string> = {
  practical: "Practical",
  academic: "Academic",
  conversational: "Conversational",
  socratic: "Socratic",
  storytelling: "Storytelling",
  "case-study": "Case study",
};

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  "multiple-choice": "Multiple choice",
  "true-false": "True / False",
  "multi-select": "Multiple select",
  "short-answer": "Short answer",
};

export function countLessons(course: Course): number {
  return course.modules.reduce((n, m) => n + m.lessons.length, 0);
}

export function countQuestions(course: Course): number {
  const inLessons = course.modules.reduce(
    (n, m) =>
      n +
      m.lessons.reduce((k, l) => k + (l.quiz?.questions.length ?? 0), 0) +
      (m.quiz?.questions.length ?? 0),
    0,
  );
  return inLessons + (course.finalAssessment?.questions.length ?? 0);
}

export function totalMinutes(course: Course): number {
  return course.modules.reduce(
    (n, m) => n + m.lessons.reduce((k, l) => k + l.durationMinutes, 0),
    0,
  );
}

export function findLesson(course: Course, lessonId: string): { module: Module; lesson: Lesson } | null {
  for (const module of course.modules) {
    const lesson = module.lessons.find((l) => l.id === lessonId);
    if (lesson) return { module, lesson };
  }
  return null;
}

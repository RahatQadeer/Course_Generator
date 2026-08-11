import type { Difficulty, GenerationRequest, SourceMaterial, TeachingStyle } from "@/lib/schema/course";

/* -------------------------------------------------------------------------- */
/*  Voice                                                                     */
/* -------------------------------------------------------------------------- */

export const DESIGNER_SYSTEM = `You are a senior instructional designer with 15 years of experience building professional curricula for universities and corporate academies. You have deep subject-matter fluency and you write like a great textbook author: precise, concrete, and free of filler.

Non-negotiable standards:
- Accuracy first. Never state something you are not confident is true. Prefer a narrower, correct claim over a broad, shaky one. Do not invent statistics, dates, citations, version numbers, quotes, or study results.
- Teach, don't summarise. Explain mechanisms and reasoning, not just definitions.
- Be specific. Real tools, real numbers, real scenarios, worked examples — never "various techniques" or "many benefits".
- No filler. Ban phrases like "In today's fast-paced world", "It is important to note", "Let's dive in", "In conclusion", "As we all know".
- No meta-commentary about being an AI or about the generation process.
- Every sentence must carry information a learner did not have before reading it.`;

export const DIFFICULTY_GUIDE: Record<Difficulty, string> = {
  beginner:
    "Assume no prior knowledge of the subject. Define every term the first time it appears. Use everyday analogies before formal definitions. Keep sentences short. One new idea at a time. Worked examples must be small and complete.",
  intermediate:
    "Assume the learner knows the fundamentals and can already perform basic tasks. Skip introductory definitions of core terms; focus on how pieces fit together, trade-offs, and common mistakes. Examples should be realistic, not toy-sized.",
  advanced:
    "Assume strong working knowledge. Go into mechanisms, edge cases, performance and failure modes, and the reasoning behind design choices. Compare competing approaches with concrete criteria. Examples should reflect production-grade situations.",
  expert:
    "Assume mastery of the standard material. Focus on frontier practice, subtle trade-offs, contested opinions in the field, and non-obvious failure modes. Reference the underlying theory precisely. Assume the reader can fill in routine steps.",
};

export const STYLE_GUIDE: Record<TeachingStyle, string> = {
  practical:
    "Hands-on and outcome-driven. Lead with what the learner will do, then the minimum theory needed to do it well. Favour step-by-step walkthroughs, checklists and real tooling.",
  academic:
    "Rigorous and structured. Define terms formally, state assumptions, build arguments in sequence, and distinguish established consensus from open questions.",
  conversational:
    "Warm, direct, second person. Short paragraphs, plain words, the occasional rhetorical question — but never chatty filler or emoji.",
  socratic:
    "Lead with a question that exposes the gap, let the learner predict, then resolve it. Each section should surface a misconception and correct it.",
  storytelling:
    "Anchor each concept in a continuing narrative — a person, project, or organisation facing a concrete problem. Ideas arrive when the story needs them.",
  "case-study":
    "Ground each lesson in a documented, realistic case. Present the situation, the constraints, the decision made, the outcome, and the transferable principle.",
};

export const DEPTH_GUIDE = {
  concise: { words: "450–650", blocks: "5–7", lessonMinutes: "8–14" },
  standard: { words: "800–1100", blocks: "7–10", lessonMinutes: "15–25" },
  comprehensive: { words: "1300–1800", blocks: "10–15", lessonMinutes: "25–45" },
} as const;

/* -------------------------------------------------------------------------- */
/*  Context blocks                                                            */
/* -------------------------------------------------------------------------- */

export function briefBlock(request: GenerationRequest): string {
  return [
    `TOPIC: ${request.topic}`,
    request.title ? `WORKING TITLE: ${request.title}` : null,
    request.description ? `CREATOR NOTES: ${request.description}` : null,
    `AUDIENCE: ${request.audience}`,
    `LEVEL: ${request.difficulty}`,
    `DURATION: ${request.duration}`,
    `MODULES REQUESTED: ${request.moduleCount}`,
    `LANGUAGE: ${request.language}`,
    `TEACHING STYLE: ${request.teachingStyle}`,
    `LESSON DEPTH: ${request.depth}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function calibrationBlock(request: GenerationRequest): string {
  return [
    `LEVEL CALIBRATION — ${request.difficulty}: ${DIFFICULTY_GUIDE[request.difficulty]}`,
    `STYLE — ${request.teachingStyle}: ${STYLE_GUIDE[request.teachingStyle]}`,
    request.language.toLowerCase().startsWith("english")
      ? null
      : `LANGUAGE: Write ALL learner-facing text in ${request.language}. Keep widely-used technical terms in their original form where translating them would confuse practitioners.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const SOURCE_BUDGET = 60_000;

/** Interleave source excerpts so no single document crowds out the others. */
export function sourceBlock(sources: SourceMaterial[], budget = SOURCE_BUDGET): string {
  if (!sources.length) return "";
  const perSource = Math.floor(budget / sources.length);
  const parts = sources.map((source, index) => {
    const text = source.text.length > perSource
      ? `${source.text.slice(0, perSource)}\n…[truncated, ${source.text.length - perSource} more characters]`
      : source.text;
    return `<source index="${index + 1}" name="${escapeAttr(source.name)}" kind="${source.kind}">\n${text}\n</source>`;
  });
  return `SOURCE MATERIAL — this is the authoritative basis for the course. Ground the curriculum in it: use its terminology, its examples, its structure and its emphasis. Where it is silent, you may add standard domain knowledge, but never contradict it.\n\n${parts.join("\n\n")}`;
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "'").replace(/[<>]/g, "");
}

export function jsonDiscipline(): string {
  return `Return your answer by calling the provided tool. Every string must be plain prose — no markdown headings, no bullet characters, no backticks except inside code blocks where the schema expects code.`;
}

/** Compact serialisation of already-generated lesson content, for grounding later stages. */
export function lessonDigest(lesson: {
  title: string;
  summary: string;
  learningObjectives: string[];
  introduction: string;
  content: { type: string; [key: string]: unknown }[];
  keyTakeaways: string[];
}): string {
  const body = lesson.content
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return block.text as string;
        case "heading":
          return `## ${block.text as string}`;
        case "list":
          return (block.items as string[]).map((item) => `• ${item}`).join("\n");
        case "callout":
          return `[${block.variant as string}] ${(block.title as string) ?? ""} ${block.text as string}`;
        case "code":
          return `\`\`\`${block.language as string}\n${block.code as string}\n\`\`\``;
        case "example": {
          const walkthrough = (block.walkthrough as string[]) ?? [];
          return `EXAMPLE — ${block.title as string}: ${block.scenario as string}\n${walkthrough.join("\n")}\n${(block.outcome as string) ?? ""}`;
        }
        case "steps": {
          const steps = (block.steps as { title: string; detail: string }[]) ?? [];
          return steps.map((step, index) => `${index + 1}. ${step.title}: ${step.detail}`).join("\n");
        }
        case "table": {
          const headers = (block.headers as string[]) ?? [];
          const rows = (block.rows as string[][]) ?? [];
          return [headers.join(" | "), ...rows.map((row) => row.join(" | "))].join("\n");
        }
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");

  return [
    `LESSON: ${lesson.title}`,
    `SUMMARY: ${lesson.summary}`,
    lesson.learningObjectives.length
      ? `OBJECTIVES:\n${lesson.learningObjectives.map((objective) => `- ${objective}`).join("\n")}`
      : null,
    lesson.introduction ? `INTRO: ${lesson.introduction}` : null,
    body,
    lesson.keyTakeaways.length
      ? `KEY TAKEAWAYS:\n${lesson.keyTakeaways.map((takeaway) => `- ${takeaway}`).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

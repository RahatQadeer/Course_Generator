import "server-only";

import { generateStructured, type Usage } from "@/lib/ai/client";
import {
  DESIGNER_SYSTEM,
  briefBlock,
  calibrationBlock,
  jsonDiscipline,
  sourceBlock,
} from "@/lib/ai/prompts";
import type { GenerationRequest } from "@/lib/schema/course";
import { difficultySchema } from "@/lib/schema/course";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Stage 1 — Analyse the brief and any source material                       */
/* -------------------------------------------------------------------------- */

export const blueprintSchema = z.object({
  title: z.string().describe("Specific, professional course title. No colons-with-buzzwords."),
  subtitle: z.string().describe("One line, max 14 words, stating the concrete outcome."),
  description: z
    .string()
    .describe("2–4 sentences. What the course covers, who it is for, what the learner can do afterwards."),
  audience: z.string().describe("Refined one-sentence description of the learner."),
  difficulty: difficultySchema,
  prerequisites: z.array(z.string()).max(6),
  estimatedHours: z.number().min(0.5).max(400),
  domainAnalysis: z
    .string()
    .describe(
      "150–250 words for internal use by later stages: the real structure of this subject, the concepts that must be taught and in what dependency order, the terminology practitioners actually use, and the mistakes learners typically make.",
    ),
  inScope: z.array(z.string()).min(3).max(12).describe("Concrete topics this course will cover."),
  outOfScope: z
    .array(z.string())
    .max(8)
    .describe("Adjacent topics deliberately excluded, so the scope stays honest."),
  sourceUsage: z
    .string()
    .describe(
      "How the provided source material maps onto the course. Empty string if no source was provided.",
    )
    .default(""),
  sourceSummary: z
    .string()
    .describe("2–3 sentence summary of the source material. Empty string if none was provided.")
    .default(""),
});

export type Blueprint = z.infer<typeof blueprintSchema>;

export async function analyzeBrief(
  request: GenerationRequest,
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<Blueprint> {
  const sources = sourceBlock(request.sources);

  const prompt = `Analyse this course brief before any content is written.

${briefBlock(request)}

${calibrationBlock(request)}

${sources ? `${sources}\n\n` : ""}Your job in this stage:
1. Sharpen the title, subtitle and description so they describe a real, specific course — not a generic overview.
2. Decide the honest difficulty level for the stated audience (you may correct the requested level if it is clearly mismatched, but only for a strong reason).
3. Map the actual conceptual structure of this subject: what must be understood before what.
4. Draw a firm scope boundary. A course that promises everything teaches nothing.
${request.sources.length ? "5. State how the source material maps onto the course, and summarise it." : "5. Leave sourceUsage and sourceSummary as empty strings."}

Estimate hours from the requested duration (${request.duration}) interpreted as realistic learner effort, not calendar time.

${jsonDiscipline()}`;

  return generateStructured({
    name: "course_blueprint",
    description: "Structured analysis of the course brief.",
    schema: blueprintSchema,
    system: DESIGNER_SYSTEM,
    tier: "reasoning",
    maxTokens: 4000,
    temperature: 0.6,
    prompt,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });
}

/* -------------------------------------------------------------------------- */
/*  Stage 2 — Learning objectives                                             */
/* -------------------------------------------------------------------------- */

export const objectivesSchema = z.object({
  learningObjectives: z
    .array(z.string())
    .min(4)
    .max(10)
    .describe(
      "Course-level objectives. Each starts with an observable Bloom verb (Explain, Build, Diagnose, Compare, Design…) and names a concrete artefact or capability. Never 'understand' or 'learn about'.",
    ),
  outcomes: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe("What the learner can point to after finishing — deliverables, skills, or decisions they can now make."),
});

export type Objectives = z.infer<typeof objectivesSchema>;

export async function generateObjectives(
  request: GenerationRequest,
  blueprint: Blueprint,
  opts: { signal?: AbortSignal; onUsage?: (usage: Usage) => void } = {},
): Promise<Objectives> {
  const prompt = `Write the course-level learning objectives.

COURSE: ${blueprint.title}
DESCRIPTION: ${blueprint.description}
AUDIENCE: ${blueprint.audience}
LEVEL: ${blueprint.difficulty}
IN SCOPE: ${blueprint.inScope.join("; ")}
OUT OF SCOPE: ${blueprint.outOfScope.join("; ") || "—"}

DOMAIN ANALYSIS:
${blueprint.domainAnalysis}

${calibrationBlock(request)}

Rules:
- One objective per major capability. ${request.moduleCount} modules will be built to serve these objectives, so there should be roughly that many — never more.
- Each objective must be assessable: you must be able to write a quiz question that proves it.
- Order them the way they will be taught.
- Objectives are promises. Do not promise anything the scope excludes.

${jsonDiscipline()}`;

  return generateStructured({
    name: "learning_objectives",
    description: "Course-level learning objectives and outcomes.",
    schema: objectivesSchema,
    system: DESIGNER_SYSTEM,
    tier: "reasoning",
    maxTokens: 2000,
    temperature: 0.6,
    prompt,
    signal: opts.signal,
    onUsage: opts.onUsage,
  });
}

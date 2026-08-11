import type { Usage } from "@/lib/ai/client-types";
import type { Course } from "@/lib/schema/course";

/**
 * Stage definitions and the streaming event protocol.
 * Client-safe: imported by both the progress UI and the server pipeline.
 */

export const STAGES = [
  { id: "analyze", label: "Analyzing course requirements", weight: 5 },
  { id: "objectives", label: "Defining learning objectives", weight: 4 },
  { id: "curriculum", label: "Designing the curriculum", weight: 8 },
  { id: "modules", label: "Structuring modules", weight: 11 },
  { id: "lessons", label: "Writing lesson content", weight: 40 },
  { id: "activities", label: "Creating examples and activities", weight: 11 },
  { id: "quizzes", label: "Building quizzes", weight: 13 },
  { id: "assessment", label: "Composing the final assessment", weight: 4 },
  { id: "quality", label: "Running the quality check", weight: 4 },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export type PipelineEvent =
  | {
      type: "stage";
      stage: StageId;
      status: "active" | "done" | "failed";
      detail?: string;
      progress?: number;
    }
  | { type: "skeleton"; course: Course }
  | { type: "done"; course: Course; usage: Usage; elapsedMs: number }
  | { type: "error"; message: string; code?: string };

export type Emit = (event: PipelineEvent) => void;

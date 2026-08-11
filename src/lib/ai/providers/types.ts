import type { Usage } from "@/lib/ai/client-types";

/**
 * The generation layer talks to exactly one interface. Adding a provider means
 * adding a file here — nothing in `services/ai` changes.
 */

export type Turn = { role: "user" | "assistant"; content: string };

export type JsonRequest = {
  model: string;
  system: string;
  messages: Turn[];
  /** JSON Schema (draft 2020-12) describing the expected object. */
  schema: Record<string, unknown>;
  /** Used as the tool name where the provider needs one. */
  name: string;
  description: string;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
};

export type JsonResponse = {
  /** Parsed object when the provider returned structured output directly. */
  value: unknown | null;
  /** Raw text, used to salvage JSON when `value` is null. */
  text: string;
  usage: Usage;
  truncated: boolean;
};

export type ProviderTiers = { reasoning: string; writing: string; fast: string };

/** What the client needs to know to react correctly to a failed call. */
export type ErrorInfo = {
  retryable: boolean;
  /** How long the provider asked us to wait, in milliseconds. */
  retryAfterMs?: number;
  /** The real per-minute ceiling, when the provider discloses it. */
  rpmLimit?: number;
  /** A per-day quota is spent; waiting inside this run cannot help. */
  dailyExhausted?: boolean;
  message: string;
};

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  readonly models: ProviderTiers;
  generateJson(request: JsonRequest): Promise<JsonResponse>;
  classifyError(error: unknown): ErrorInfo;
}

import "server-only";

import { z } from "zod";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";
import { limiterFor } from "./rate-limit";
import type { AIProvider, Turn } from "./providers/types";

export type { Usage } from "@/lib/ai/client-types";
import type { Usage } from "@/lib/ai/client-types";

/* -------------------------------------------------------------------------- */
/*  Provider selection                                                        */
/* -------------------------------------------------------------------------- */

export type ModelTier = "reasoning" | "writing" | "fast";

export class AIConfigError extends Error {
  readonly code = "ai_not_configured";
}

export class AIGenerationError extends Error {
  readonly code = "ai_generation_failed";
  constructor(
    message: string,
    readonly stage: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * A per-day quota is spent. Unlike a per-minute limit this cannot be waited
 * out, so callers abort the whole run rather than emitting a half-built course.
 */
export class AIQuotaError extends Error {
  readonly code = "ai_quota_exhausted";
  constructor(
    message: string,
    readonly model: string,
  ) {
    super(message);
  }
}

type Configured = { provider: "gemini" | "anthropic"; apiKey: string };

/**
 * Whichever key is present wins. Set COURSEGEN_PROVIDER to pick explicitly when
 * both are configured.
 */
function resolveConfig(): Configured | null {
  const forced = process.env.COURSEGEN_PROVIDER?.toLowerCase();
  const gemini = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;

  if (forced === "gemini") return gemini ? { provider: "gemini", apiKey: gemini } : null;
  if (forced === "anthropic") return anthropic ? { provider: "anthropic", apiKey: anthropic } : null;

  if (gemini) return { provider: "gemini", apiKey: gemini };
  if (anthropic) return { provider: "anthropic", apiKey: anthropic };
  return null;
}

let cached: { key: string; provider: AIProvider } | null = null;

export function getProvider(): AIProvider {
  const config = resolveConfig();
  if (!config) {
    throw new AIConfigError(
      "No AI key found. Add GEMINI_API_KEY (or ANTHROPIC_API_KEY) to .env.local and restart the dev server.",
    );
  }
  const cacheKey = `${config.provider}:${config.apiKey.slice(-8)}`;
  if (cached?.key !== cacheKey) {
    cached = {
      key: cacheKey,
      provider:
        config.provider === "gemini"
          ? createGeminiProvider(config.apiKey)
          : createAnthropicProvider(config.apiKey),
    };
  }
  return cached.provider;
}

export function isAIConfigured(): boolean {
  return resolveConfig() !== null;
}

/** Model ids in use, for display and for stamping onto generated courses. */
export function activeModels(): { provider: string; reasoning: string; writing: string; fast: string } {
  const provider = getProvider();
  const primary = (tier: ModelTier) => provider.models[tier].split(",")[0].trim();
  return {
    provider: provider.id,
    reasoning: primary("reasoning"),
    writing: primary("writing"),
    fast: primary("fast"),
  };
}

/* -------------------------------------------------------------------------- */
/*  Usage accounting                                                          */
/* -------------------------------------------------------------------------- */

export function emptyUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, calls: 0 };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    calls: a.calls + b.calls,
  };
}

/* -------------------------------------------------------------------------- */
/*  Structured generation                                                     */
/* -------------------------------------------------------------------------- */

export type StructuredOptions<T extends z.ZodType> = {
  /** Used for the tool name and in error messages. */
  name: string;
  description: string;
  schema: T;
  system: string;
  prompt: string;
  tier?: ModelTier;
  maxTokens?: number;
  temperature?: number;
  /** Total attempts including repair passes. */
  attempts?: number;
  signal?: AbortSignal;
  onUsage?: (usage: Usage) => void;
};

type Json = Record<string, unknown>;

function jsonSchemaOf(schema: z.ZodType): Json {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Json;
  delete json.$schema;
  // Providers require an object at the root.
  if (json.type !== "object") {
    return { type: "object", properties: { value: json }, required: ["value"] };
  }
  return json;
}

function isWrapped(schema: z.ZodType): boolean {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Json;
  return json.type !== "object";
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

/** Pull the first balanced JSON value out of a text response. */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in response");

  const opening = candidate[start];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = start; index < candidate.length; index++) {
    const char = candidate[index];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === opening) depth++;
    else if (char === closing) {
      depth--;
      if (depth === 0) return JSON.parse(candidate.slice(start, index + 1));
    }
  }
  throw new Error("Unbalanced JSON in response");
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 25)
    .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 400);
}

/** Models whose per-day quota ran out; skipped for the rest of the process. */
const exhausted = new Set<string>();

/** Models that actually produced output, so a course records what wrote it. */
const used = new Set<string>();

export function modelsUsed(): string[] {
  return [...used];
}

/** Each tier may list fallbacks, best first: "gemini-3.6-flash,gemini-3.5-flash". */
function candidatesFor(provider: AIProvider, tier: ModelTier): string[] {
  return provider.models[tier]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Ask the model for data matching a Zod schema.
 *
 * Reliability strategy, in order:
 *   1. Provider-native structured output (forced tool use / JSON schema mode).
 *   2. If that returns prose, salvage the JSON out of the text.
 *   3. If Zod rejects it, send the validation errors back for a repair pass.
 *   4. Transport failures retry with backoff, honouring the provider's own wait.
 *   5. If a model's daily quota is spent, fall through to the next model in the tier.
 */
export async function generateStructured<T extends z.ZodType>(
  options: StructuredOptions<T>,
): Promise<z.infer<T>> {
  const provider = getProvider();
  const candidates = candidatesFor(provider, options.tier ?? "writing");
  const usable = candidates.filter((model) => !exhausted.has(model));
  const queue = usable.length ? usable : candidates.slice(-1);

  let quotaError: AIQuotaError | null = null;

  for (const model of queue) {
    try {
      const result = await generateOnModel(options, provider, model);
      used.add(model);
      return result;
    } catch (error) {
      if (error instanceof AIQuotaError) {
        exhausted.add(model);
        quotaError = error;
        console.warn(`[ai] ${model} is out of quota — falling back`);
        continue;
      }
      throw error;
    }
  }

  throw (
    quotaError ??
    new AIGenerationError(`${options.name}: no usable model configured`, options.name)
  );
}

async function generateOnModel<T extends z.ZodType>(
  options: StructuredOptions<T>,
  provider: AIProvider,
  model: string,
): Promise<z.infer<T>> {
  const {
    name,
    description,
    schema,
    system,
    prompt,
    maxTokens = 8000,
    temperature = 1,
    attempts = 3,
    signal,
    onUsage,
  } = options;

  const toolName = sanitizeName(name);
  const wrapped = isWrapped(schema);
  const inputSchema = jsonSchemaOf(schema);

  const messages: Turn[] = [{ role: "user", content: prompt }];
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    let response;
    try {
      response = await withBackoff(
        () =>
          provider.generateJson({
            model,
            system,
            messages,
            schema: inputSchema,
            name: toolName,
            description,
            maxTokens,
            temperature,
            signal,
          }),
        provider,
        model,
        signal,
      );
    } catch (error) {
      if (error instanceof AIQuotaError) throw error;
      throw new AIGenerationError(
        `${name}: ${provider.classifyError(error).message}`,
        name,
        error,
      );
    }

    onUsage?.(response.usage);

    let raw = response.value;
    if (raw === null || raw === undefined) {
      try {
        raw = extractJsonObject(response.text);
      } catch (error) {
        lastError = response.truncated
          ? new Error(`${name}: response hit the ${maxTokens}-token limit before any JSON completed.`)
          : error;
        messages.push(
          { role: "assistant", content: response.text.slice(0, 2000) || "(empty)" },
          {
            role: "user",
            content: `That response contained no usable JSON. Reply with a single JSON object matching the schema, and nothing else.`,
          },
        );
        continue;
      }
    }

    if (wrapped && raw && typeof raw === "object" && "value" in (raw as Json)) {
      raw = (raw as Json).value;
    }

    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;

    lastError = response.truncated
      ? new Error(`${name}: response was truncated at ${maxTokens} tokens before valid JSON completed.`)
      : parsed.error;

    messages.push(
      { role: "assistant", content: JSON.stringify(raw).slice(0, 12000) },
      {
        role: "user",
        content:
          `That output failed validation:\n${formatIssues(parsed.error)}\n\n` +
          `Return the SAME content again, corrected to satisfy the schema. ` +
          `Do not shorten or drop material — only fix the structural problems. ` +
          `Keep it compact enough to finish within the token budget.`,
      },
    );
  }

  throw new AIGenerationError(
    `${name}: could not produce valid output after ${attempts} attempts` +
      (lastError instanceof z.ZodError ? `\n${formatIssues(lastError)}` : ""),
    name,
    lastError,
  );
}

const MAX_ATTEMPTS = 5;

/**
 * Paces requests against the model's limiter, then retries transport failures.
 * A 429 is not treated as a generic error: the provider's stated wait is
 * honoured exactly and applied to every other caller of the same model, and any
 * disclosed rate ceiling permanently lowers the limiter for the rest of the run.
 */
async function withBackoff<T>(
  fn: () => Promise<T>,
  provider: AIProvider,
  model: string,
  signal?: AbortSignal,
): Promise<T> {
  const limiter = limiterFor(model);
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new Error("aborted");
    await limiter.acquire(signal);

    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;

      const info = provider.classifyError(error);
      if (info.dailyExhausted) throw new AIQuotaError(info.message, model);
      if (info.rpmLimit) limiter.learnLimit(info.rpmLimit);
      if (info.retryAfterMs) limiter.penalize(info.retryAfterMs);
      if (!info.retryable || attempt === MAX_ATTEMPTS - 1) throw error;

      const wait = info.retryAfterMs ?? retryDelay(attempt);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}

/* -------------------------------------------------------------------------- */
/*  Concurrency                                                               */
/* -------------------------------------------------------------------------- */

/** Run tasks with a bounded number in flight, preserving input order. */
export async function mapLimit<In, Out>(
  items: In[],
  limit: number,
  worker: (item: In, index: number) => Promise<Out>,
): Promise<Out[]> {
  const results = new Array<Out>(items.length);
  let cursor = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

import "server-only";

import { GoogleGenAI, type Content } from "@google/genai";
import { toGeminiSchema } from "./gemini-schema";
import type { AIProvider, ErrorInfo, JsonRequest, JsonResponse } from "./types";

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);

/**
 * Gemini 2.5 models spend part of their output budget on thinking tokens, which
 * count against `maxOutputTokens`. Without headroom, long lessons get truncated
 * mid-JSON.
 */
const THINKING_HEADROOM = 1.8;

export function createGeminiProvider(apiKey: string): AIProvider {
  const client = new GoogleGenAI({ apiKey });

  return {
    id: "gemini",
    label: "Google Gemini",
    // Best model first, then fallbacks the client drops to when a per-day quota
    // runs out. Flash leads because the Pro tier is unavailable on free keys;
    // with a billed key, COURSEGEN_MODEL_REASONING=gemini-3.1-pro-preview is a
    // clear upgrade for planning and review.
    models: {
      reasoning:
        process.env.COURSEGEN_MODEL_REASONING ??
        "gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite",
      writing:
        process.env.COURSEGEN_MODEL_WRITING ??
        "gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite",
      fast: process.env.COURSEGEN_MODEL_FAST ?? "gemini-3.1-flash-lite,gemini-3.5-flash",
    },

    async generateJson(request: JsonRequest): Promise<JsonResponse> {
      const contents: Content[] = request.messages.map((turn) => ({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }],
      }));

      const response = await client.models.generateContent({
        model: request.model,
        contents,
        config: {
          systemInstruction: request.system,
          temperature: request.temperature,
          maxOutputTokens: Math.round(request.maxTokens * THINKING_HEADROOM),
          responseMimeType: "application/json",
          responseJsonSchema: toGeminiSchema(request.schema),
          abortSignal: request.signal,
        },
      });

      const text = response.text ?? "";
      const finish = response.candidates?.[0]?.finishReason;

      let value: unknown = null;
      if (text.trim()) {
        try {
          value = JSON.parse(text);
        } catch {
          // Left to the caller's salvage + repair path.
        }
      }

      const usage = response.usageMetadata;
      return {
        value,
        text,
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
          calls: 1,
        },
        truncated: finish === "MAX_TOKENS",
      };
    },

    classifyError(error: unknown): ErrorInfo {
      const candidate = error as { status?: number; code?: number; message?: string };
      const message = candidate?.message ?? String(error);
      const status = candidate?.status ?? candidate?.code;

      // The SDK stringifies the API's JSON error into `message`.
      const payload = parseApiError(message);
      const code = payload?.error?.code ?? (typeof status === "number" ? status : undefined);

      if (code === 429) {
        const details = payload?.error?.details ?? [];
        let retryAfterMs: number | undefined;
        let rpmLimit: number | undefined;
        let dailyExhausted = false;

        for (const detail of details) {
          if (typeof detail.retryDelay === "string") {
            const seconds = Number.parseFloat(detail.retryDelay.replace("s", ""));
            if (Number.isFinite(seconds)) retryAfterMs = Math.ceil(seconds * 1000) + 500;
          }
          for (const violation of detail.violations ?? []) {
            const quotaId = violation.quotaId ?? "";
            const value = Number(violation.quotaValue);
            if (/PerDay/i.test(quotaId)) dailyExhausted = true;
            else if (/PerMinute/i.test(quotaId) && Number.isFinite(value)) rpmLimit = value;
          }
        }

        return {
          retryable: !dailyExhausted,
          retryAfterMs,
          rpmLimit,
          dailyExhausted,
          message: dailyExhausted
            ? `Your Gemini daily free-tier quota for this model is used up. Wait for the daily reset, switch models with COURSEGEN_MODEL_WRITING, or use a billed key.`
            : payload?.error?.message ?? message,
        };
      }

      if (code === 404 && /no longer available|not found/i.test(message)) {
        return {
          retryable: false,
          message: `${payload?.error?.message ?? message} Set COURSEGEN_MODEL_* in .env.local to a model your key can use.`,
        };
      }

      if (typeof code === "number") {
        return { retryable: RETRYABLE.has(code), message: payload?.error?.message ?? message };
      }
      return {
        retryable: /overloaded|unavailable|deadline|ECONNRESET|fetch failed/i.test(message),
        message,
      };
    },
  };
}

type ApiErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    details?: {
      retryDelay?: string;
      violations?: { quotaId?: string; quotaValue?: string }[];
    }[];
  };
};

/** The SDK throws with the raw API JSON embedded in the message. */
function parseApiError(message: string): ApiErrorPayload | null {
  const start = message.indexOf("{");
  if (start === -1) return null;
  try {
    return JSON.parse(message.slice(start)) as ApiErrorPayload;
  } catch {
    return null;
  }
}

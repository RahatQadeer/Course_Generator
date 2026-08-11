import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, ErrorInfo, JsonRequest, JsonResponse } from "./types";

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

export function createAnthropicProvider(apiKey: string): AIProvider {
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  return {
    id: "anthropic",
    label: "Anthropic Claude",
    models: {
      reasoning: process.env.COURSEGEN_MODEL_REASONING ?? "claude-sonnet-5",
      writing: process.env.COURSEGEN_MODEL_WRITING ?? "claude-sonnet-5",
      fast: process.env.COURSEGEN_MODEL_FAST ?? "claude-haiku-4-5-20251001",
    },

    async generateJson(request: JsonRequest): Promise<JsonResponse> {
      const response = await client.messages.create(
        {
          model: request.model,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          system: request.system,
          messages: request.messages.map((turn) => ({
            role: turn.role,
            content: turn.content,
          })),
          tools: [
            {
              name: request.name,
              description: request.description,
              input_schema: request.schema as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: "tool", name: request.name },
        },
        { signal: request.signal },
      );

      const toolBlock = response.content.find((block) => block.type === "tool_use");
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      return {
        value: toolBlock && toolBlock.type === "tool_use" ? toolBlock.input : null,
        text,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          calls: 1,
        },
        truncated: response.stop_reason === "max_tokens",
      };
    },

    classifyError(error: unknown): ErrorInfo {
      const candidate = error as {
        status?: number;
        message?: string;
        headers?: Record<string, string> | Headers;
      };
      const status = candidate?.status;
      const message = candidate?.message ?? String(error);

      const header =
        candidate.headers instanceof Headers
          ? candidate.headers.get("retry-after")
          : candidate.headers?.["retry-after"];
      const retryAfterMs = header ? Number(header) * 1000 : undefined;

      if (status === 404) {
        return {
          retryable: false,
          message: `${message} Set COURSEGEN_MODEL_* in .env.local to a model your key can use.`,
        };
      }

      return {
        retryable: status === undefined || RETRYABLE.has(status),
        retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
        message,
      };
    },
  };
}

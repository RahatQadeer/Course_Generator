import { AIQuotaError, isAIConfigured } from "@/lib/ai/client";
import { aiOperationSchema, runOperation } from "@/lib/ai/operations";
import type { PipelineEvent } from "@/lib/ai/pipeline";
import { courseSchema } from "@/lib/schema/course";
import type { NextRequest } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  course: courseSchema,
  operation: aiOperationSchema,
});

export async function POST(req: NextRequest) {
  if (!isAIConfigured()) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured.", code: "ai_not_configured" },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const controller = new AbortController();
  req.signal.addEventListener("abort", () => controller.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      let closed = false;
      const send = (event: PipelineEvent) => {
        if (closed) return;
        try {
          streamController.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const heartbeat = setInterval(() => {
        if (!closed) {
          try {
            streamController.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            closed = true;
          }
        }
      }, 15_000);

      try {
        const course = await runOperation(parsed.data.course, parsed.data.operation, {
          signal: controller.signal,
          emit: send,
        });
        send({
          type: "done",
          course: { ...course, updatedAt: new Date().toISOString() },
          usage: { inputTokens: 0, outputTokens: 0, calls: 0 },
          elapsedMs: 0,
        });
      } catch (error) {
        console.error("[api/ai]", error);
        send({
          type: "error",
          code: error instanceof AIQuotaError ? "ai_quota_exhausted" : "generation_failed",
          message: error instanceof Error ? error.message : "The request failed.",
        });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          streamController.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

import { AIConfigError, AIQuotaError, isAIConfigured } from "@/lib/ai/client";
import { runPipeline, type PipelineEvent } from "@/lib/ai/pipeline";
import { generationRequestSchema } from "@/lib/schema/course";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 800;

export async function POST(req: NextRequest) {
  if (!isAIConfigured()) {
    return Response.json(
      {
        error: "ANTHROPIC_API_KEY is not configured. Add it to .env.local and restart the server.",
        code: "ai_not_configured",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = generationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues.map((issue) => issue.message) },
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

      // Keep intermediaries from buffering the stream during long stages.
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
        await runPipeline(parsed.data, send, controller.signal);
      } catch (error) {
        console.error("[api/generate]", error);
        const code =
          error instanceof AIConfigError
            ? "ai_not_configured"
            : error instanceof AIQuotaError
              ? "ai_quota_exhausted"
              : "generation_failed";
        send({
          type: "error",
          code,
          message: error instanceof Error ? error.message : "Generation failed unexpectedly.",
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

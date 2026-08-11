"use client";

import type { PipelineEvent } from "@/lib/ai/stages";

/**
 * POST a JSON body and consume the `text/event-stream` response.
 * Returns when the stream ends; throws on transport or server errors.
 */
export async function streamPost(
  url: string,
  body: unknown,
  onEvent: (event: PipelineEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  if (!response.body) throw new Error("The server returned an empty response.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      const line = chunk.split("\n").find((entry) => entry.startsWith("data:"));
      if (!line) continue; // heartbeat comment
      try {
        onEvent(JSON.parse(line.slice(5).trim()) as PipelineEvent);
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}

import "server-only";

import { extractDocx } from "./docx";
import { extractPdf } from "./pdf";
import { extractPptx } from "./pptx";
import { extractUrl } from "./url";
import { extractYouTube } from "./youtube";

export type Extracted = {
  name: string;
  text: string;
  kind: "file" | "url" | "youtube" | "text";
  meta?: Record<string, string>;
};

export class IngestError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Anything beyond this adds cost without improving the course. */
export const MAX_CHARS = 220_000;

export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+| [ \t]+$/gm, "")
    .trim()
    .slice(0, MAX_CHARS);
}

const EXTENSION_HANDLERS: Record<string, (buffer: Buffer, name: string) => Promise<string>> = {
  pdf: (buffer) => extractPdf(buffer),
  docx: (buffer) => extractDocx(buffer),
  pptx: (buffer) => extractPptx(buffer),
  txt: async (buffer) => buffer.toString("utf8"),
  md: async (buffer) => buffer.toString("utf8"),
  markdown: async (buffer) => buffer.toString("utf8"),
  csv: async (buffer) => buffer.toString("utf8"),
  json: async (buffer) => buffer.toString("utf8"),
  html: async (buffer) => stripHtml(buffer.toString("utf8")),
  htm: async (buffer) => stripHtml(buffer.toString("utf8")),
};

export const ACCEPTED_EXTENSIONS = Object.keys(EXTENSION_HANDLERS);

export async function ingestFile(file: File): Promise<Extracted> {
  if (file.size > MAX_FILE_BYTES) {
    throw new IngestError(
      `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
      `Files must be under ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
    );
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const handler = EXTENSION_HANDLERS[extension];
  if (!handler) {
    throw new IngestError(
      `${file.name} is not a supported file type.`,
      `Supported: ${ACCEPTED_EXTENSIONS.join(", ")}`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = normalizeText(await handler(buffer, file.name));

  if (text.length < 40) {
    throw new IngestError(
      `No readable text was found in ${file.name}.`,
      extension === "pdf"
        ? "This PDF is probably a scan. Run OCR on it first, or paste the text directly."
        : "Try pasting the content directly instead.",
    );
  }

  return { name: file.name, text, kind: "file" };
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]);

export async function ingestUrl(input: string): Promise<Extracted> {
  let url: URL;
  try {
    url = new URL(input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`);
  } catch {
    throw new IngestError(`"${input}" is not a valid URL.`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new IngestError("Only http and https URLs are supported.");
  }

  if (YOUTUBE_HOSTS.has(url.hostname)) {
    return extractYouTube(url);
  }
  return extractUrl(url);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

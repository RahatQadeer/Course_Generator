import { IngestError, ingestFile, ingestUrl, normalizeText } from "@/lib/ingest";
import { id } from "@/lib/utils";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
      if (!files.length) return Response.json({ error: "No files were uploaded." }, { status: 400 });

      const results = await Promise.all(
        files.map(async (file) => {
          try {
            const extracted = await ingestFile(file);
            return {
              ok: true as const,
              source: {
                id: id("src"),
                kind: extracted.kind,
                name: extracted.name,
                charCount: extracted.text.length,
                text: extracted.text,
              },
            };
          } catch (error) {
            return { ok: false as const, name: file.name, ...describe(error) };
          }
        }),
      );

      return Response.json({ results });
    }

    const body = (await req.json().catch(() => null)) as {
      url?: string;
      text?: string;
      name?: string;
    } | null;

    if (body?.url) {
      const extracted = await ingestUrl(body.url);
      return Response.json({
        results: [
          {
            ok: true,
            source: {
              id: id("src"),
              kind: extracted.kind,
              name: extracted.name,
              charCount: extracted.text.length,
              text: normalizeText(extracted.text),
            },
          },
        ],
      });
    }

    if (body?.text) {
      const text = normalizeText(body.text);
      if (text.length < 40) {
        return Response.json({ error: "That text is too short to be useful." }, { status: 400 });
      }
      return Response.json({
        results: [
          {
            ok: true,
            source: {
              id: id("src"),
              kind: "text",
              name: body.name?.trim() || "Pasted text",
              charCount: text.length,
              text,
            },
          },
        ],
      });
    }

    return Response.json({ error: "Provide files, a url, or text." }, { status: 400 });
  } catch (error) {
    console.error("[api/ingest]", error);
    const described = describe(error);
    return Response.json(described, { status: error instanceof IngestError ? 422 : 500 });
  }
}

function describe(error: unknown): { error: string; hint?: string } {
  if (error instanceof IngestError) return { error: error.message, hint: error.hint };
  return { error: error instanceof Error ? error.message : "Extraction failed." };
}

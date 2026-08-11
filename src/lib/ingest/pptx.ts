import "server-only";

/**
 * A .pptx is a zip of slide XML. Pull the text runs out of each slide in
 * order, plus speaker notes, which are usually where the real teaching is.
 */
export async function extractPptx(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const parts: string[] = [];

  for (const path of slidePaths) {
    const index = slideNumber(path);
    const xml = await zip.files[path].async("string");
    const text = textRuns(xml);

    const notesPath = `ppt/notesSlides/notesSlide${index}.xml`;
    const notesFile = zip.files[notesPath];
    const notes = notesFile ? textRuns(await notesFile.async("string")) : "";

    if (!text && !notes) continue;
    parts.push(
      [`--- Slide ${index} ---`, text, notes ? `Speaker notes: ${notes}` : ""]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return parts.join("\n\n");
}

function slideNumber(path: string): number {
  return Number(path.match(/(\d+)\.xml$/)?.[1] ?? 0);
}

/** `<a:t>` holds the visible text of every run. Paragraph breaks become newlines. */
function textRuns(xml: string): string {
  const paragraphs = xml.split(/<a:p[\s>]/).slice(1);
  return paragraphs
    .map((paragraph) =>
      [...paragraph.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
        .map((match) => decodeXml(match[1]))
        .join("")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

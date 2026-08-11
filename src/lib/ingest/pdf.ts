import "server-only";

/** PDF text extraction via unpdf, which bundles a serverless-safe pdf.js build. */
export async function extractPdf(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const document = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(document, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

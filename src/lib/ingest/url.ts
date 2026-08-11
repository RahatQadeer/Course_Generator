import "server-only";

import { IngestError, type Extracted } from "./index";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Fetch a page and reduce it to readable article text. */
export async function extractUrl(url: URL): Promise<Extracted> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain" },
    });
  } catch (error) {
    throw new IngestError(
      `Could not reach ${url.hostname}.`,
      error instanceof Error && error.name === "AbortError"
        ? "The page took too long to respond."
        : "Check the URL, or paste the text directly.",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new IngestError(
      `${url.hostname} returned ${response.status}.`,
      response.status === 403 || response.status === 401
        ? "The site blocks automated access. Paste the text directly instead."
        : undefined,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (contentType.includes("text/plain") || contentType.includes("application/json")) {
    return { name: url.hostname + url.pathname, text: body, kind: "url" };
  }

  const cheerio = await import("cheerio");
  const $ = cheerio.load(body);

  $("script, style, noscript, iframe, svg, nav, header, footer, aside, form, button").remove();
  $("[aria-hidden='true'], [role='navigation'], [role='banner'], [role='contentinfo']").remove();

  const title = ($("meta[property='og:title']").attr("content") || $("title").text() || url.hostname).trim();

  // Prefer a real article container; fall back to the densest block on the page.
  const candidates = ["article", "main", "[role='main']", ".post-content", ".entry-content", "#content"];
  let rootSelector = "body";
  let best = 0;
  for (const selector of candidates) {
    const node = $(selector).first();
    if (!node.length) continue;
    const length = node.text().trim().length;
    if (length > best) {
      best = length;
      rootSelector = selector;
    }
  }
  const root = $(rootSelector).first();

  const lines: string[] = [];
  root.find("h1, h2, h3, h4, p, li, pre, blockquote, td, th, dd, dt, figcaption").each((_, element) => {
    const tag = (element as { tagName?: string }).tagName?.toLowerCase() ?? "";
    const text = $(element).text().replace(/\s+/g, " ").trim();
    if (!text || text.length < 2) return;
    if (/^h[1-4]$/.test(tag)) lines.push(`\n## ${text}`);
    else if (tag === "li") lines.push(`• ${text}`);
    else lines.push(text);
  });

  const text = dedupeLines(lines).join("\n");

  if (text.length < 200) {
    throw new IngestError(
      `Very little readable text was found at ${url.hostname}.`,
      "The page may render its content with JavaScript. Paste the text directly instead.",
    );
  }

  return { name: title.slice(0, 120), text: `Source: ${url.href}\n\n${text}`, kind: "url" };
}

/** Nav menus and boilerplate repeat; article prose does not. */
function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = line.trim().toLowerCase();
    if (key.length < 60 && seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

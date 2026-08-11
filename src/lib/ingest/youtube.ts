import "server-only";

import { IngestError, type Extracted } from "./index";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string };
};

export async function extractYouTube(url: URL): Promise<Extracted> {
  const videoId = parseVideoId(url);
  if (!videoId) throw new IngestError("That does not look like a YouTube video URL.");

  const watch = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
  }).catch(() => null);

  if (!watch?.ok) {
    throw new IngestError("Could not load the video page.", "Check the link, or paste the transcript directly.");
  }

  const html = await watch.text();
  const player = extractPlayerResponse(html);

  const title: string = player?.videoDetails?.title ?? `YouTube video ${videoId}`;
  const author: string = player?.videoDetails?.author ?? "";
  const description: string = player?.videoDetails?.shortDescription ?? "";

  const tracks: CaptionTrack[] =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  if (!tracks.length) {
    if (description.length > 400) {
      return {
        name: title,
        kind: "youtube",
        text: header(title, author, url.href) + description,
        meta: { note: "no-captions" },
      };
    }
    throw new IngestError(
      `"${title}" has no captions available.`,
      "Only videos with captions can be used as source material. Paste a transcript directly instead.",
    );
  }

  // Prefer a human-written English track, then any human track, then auto-generated.
  const track =
    tracks.find((entry) => entry.languageCode.startsWith("en") && entry.kind !== "asr") ??
    tracks.find((entry) => entry.kind !== "asr") ??
    tracks.find((entry) => entry.languageCode.startsWith("en")) ??
    tracks[0];

  const transcript = await fetchTranscript(track.baseUrl);
  if (!transcript) {
    throw new IngestError(
      `The captions for "${title}" could not be downloaded.`,
      "YouTube sometimes blocks caption downloads. Paste the transcript directly instead.",
    );
  }

  const body = [
    header(title, author, url.href),
    description ? `DESCRIPTION:\n${description.slice(0, 3000)}\n` : "",
    "TRANSCRIPT:",
    transcript,
  ]
    .filter(Boolean)
    .join("\n");

  return { name: title, kind: "youtube", text: body };
}

function header(title: string, author: string, href: string): string {
  return `Video: ${title}${author ? `\nChannel: ${author}` : ""}\nURL: ${href}\n\n`;
}

export function parseVideoId(url: URL): string | null {
  if (url.hostname.endsWith("youtu.be")) return url.pathname.slice(1).split("/")[0] || null;
  const param = url.searchParams.get("v");
  if (param) return param;
  const match = url.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{6,})/);
  return match?.[2] ?? null;
}

type PlayerResponse = {
  videoDetails?: { title?: string; author?: string; shortDescription?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
};

/** The watch page embeds the player response as a JS object literal. */
function extractPlayerResponse(html: string): PlayerResponse | null {
  const marker = "ytInitialPlayerResponse";
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const brace = html.indexOf("{", start);
  if (brace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = brace; index < html.length; index++) {
    const char = html[index];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(brace, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function fetchTranscript(baseUrl: string): Promise<string | null> {
  const response = await fetch(`${baseUrl}&fmt=json3`, {
    headers: { "User-Agent": USER_AGENT },
  }).catch(() => null);

  if (!response?.ok) return null;

  const payload = (await response.json().catch(() => null)) as {
    events?: { segs?: { utf8?: string }[] }[];
  } | null;

  if (!payload?.events) return null;

  const text = payload.events
    .flatMap((event) => event.segs ?? [])
    .map((segment) => segment.utf8 ?? "")
    .join("")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (text.length < 100) return null;

  // Captions arrive as one long run-on line; break it into readable paragraphs.
  const sentences = text.match(/[^.!?]+[.!?]+|\S+$/g) ?? [text];
  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += 5) {
    paragraphs.push(sentences.slice(index, index + 5).join(" ").trim());
  }
  return paragraphs.join("\n\n");
}

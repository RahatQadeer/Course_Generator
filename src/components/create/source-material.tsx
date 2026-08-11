"use client";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/primitives";
import type { SourceMaterial } from "@/lib/schema/course";
import { cn } from "@/lib/utils";
import {
  FileText,
  Globe,
  Loader2,
  Paperclip,
  Plus,
  Type,
  Upload,
  X,
  MonitorPlay,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

type IngestResult =
  | { ok: true; source: SourceMaterial }
  | { ok: false; name?: string; error: string; hint?: string };

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.markdown,.csv,.json,.html,.htm";

const KIND_ICON = {
  file: FileText,
  url: Globe,
  youtube: MonitorPlay,
  text: Type,
} as const;

export function SourceMaterialPanel({
  sources,
  onChange,
  disabled,
}: {
  sources: SourceMaterial[];
  onChange: (sources: SourceMaterial[]) => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = React.useState<"none" | "link" | "text">("none");
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [link, setLink] = React.useState("");
  const [pasted, setPasted] = React.useState("");
  const fileInput = React.useRef<HTMLInputElement>(null);

  const add = React.useCallback(
    (results: IngestResult[]) => {
      const good = results.filter((result): result is Extract<IngestResult, { ok: true }> => result.ok);
      const bad = results.filter((result): result is Extract<IngestResult, { ok: false }> => !result.ok);

      for (const failure of bad) {
        toast.error(failure.error, { description: failure.hint });
      }
      if (good.length) {
        onChange([...sources, ...good.map((result) => result.source)]);
        toast.success(
          good.length === 1
            ? `Added “${good[0].source.name}”`
            : `Added ${good.length} sources`,
          {
            description: `${good
              .reduce((sum, result) => sum + result.source.charCount, 0)
              .toLocaleString()} characters extracted`,
          },
        );
      }
    },
    [onChange, sources],
  );

  const uploadFiles = React.useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      setBusy(true);
      try {
        const form = new FormData();
        for (const file of list) form.append("files", file);
        const response = await fetch("/api/ingest", { method: "POST", body: form });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Upload failed");
        add(payload.results as IngestResult[]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [add],
  );

  const submitLink = React.useCallback(async () => {
    if (!link.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not read that link", { description: payload.hint });
        return;
      }
      add(payload.results as IngestResult[]);
      setLink("");
      setMode("none");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that link");
    } finally {
      setBusy(false);
    }
  }, [add, link]);

  const submitText = React.useCallback(async () => {
    if (pasted.trim().length < 40) {
      toast.error("That text is too short to be useful.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasted, name: "Pasted text" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not use that text");
      add(payload.results as IngestResult[]);
      setPasted("");
      setMode("none");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not use that text");
    } finally {
      setBusy(false);
    }
  }, [add, pasted]);

  const totalChars = sources.reduce((sum, source) => sum + source.charCount, 0);

  return (
    <div className="space-y-3">
      {sources.length > 0 && (
        <ul className="space-y-1.5">
          {sources.map((source) => {
            const Icon = KIND_ICON[source.kind];
            return (
              <li
                key={source.id}
                className="animate-fade-in flex items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-muted)] py-2 pr-2 pl-3"
              >
                <Icon className="size-4 shrink-0 text-[var(--ink-faint)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[var(--ink)]">{source.name}</p>
                  <p className="text-[11.5px] text-[var(--ink-faint)]">
                    {source.charCount.toLocaleString()} characters
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="iconSm"
                  disabled={disabled}
                  onClick={() => onChange(sources.filter((entry) => entry.id !== source.id))}
                  aria-label={`Remove ${source.name}`}
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {mode === "none" && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!disabled && event.dataTransfer.files.length) void uploadFiles(event.dataTransfer.files);
          }}
          className={cn(
            "rounded-[var(--radius)] border border-dashed px-4 py-4 transition-colors",
            dragging
              ? "border-[var(--brand)] bg-[var(--brand-soft)]"
              : "border-[var(--line-strong)] bg-[var(--surface-muted)]/60",
          )}
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled || busy}
              onClick={() => fileInput.current?.click()}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload files
            </Button>
            <Button variant="ghost" size="sm" disabled={disabled || busy} onClick={() => setMode("link")}>
              <Globe />
              Website or YouTube
            </Button>
            <Button variant="ghost" size="sm" disabled={disabled || busy} onClick={() => setMode("text")}>
              <Type />
              Paste text
            </Button>
          </div>
          <p className="mt-2.5 text-center text-[11.5px] text-[var(--ink-faint)]">
            {sources.length
              ? `${sources.length} source${sources.length > 1 ? "s" : ""} · ${totalChars.toLocaleString()} characters will ground the course`
              : "PDF, DOCX, PPTX, TXT, MD, CSV — or drop files here"}
          </p>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void uploadFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      )}

      {mode === "link" && (
        <div className="animate-fade-in flex gap-2">
          <Input
            autoFocus
            value={link}
            onChange={(event) => setLink(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitLink();
              }
              if (event.key === "Escape") setMode("none");
            }}
            placeholder="https://example.com/article or a YouTube link"
            disabled={busy}
          />
          <Button variant="primary" size="md" onClick={submitLink} loading={busy}>
            {!busy && <Plus />}
            Add
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMode("none")} aria-label="Cancel">
            <X />
          </Button>
        </div>
      )}

      {mode === "text" && (
        <div className="animate-fade-in space-y-2">
          <Textarea
            autoFocus
            rows={7}
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder="Paste notes, an outline, a transcript, documentation…"
            disabled={busy}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] text-[var(--ink-faint)]">
              {pasted.length.toLocaleString()} characters
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setMode("none")}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={submitText} loading={busy}>
                <Paperclip />
                Add source
              </Button>
            </div>
          </div>
        </div>
      )}

      {sources.length > 0 && mode === "none" && (
        <Badge tone="brand">
          <FileText className="size-3" />
          The AI will treat these as the authoritative source
        </Badge>
      )}
    </div>
  );
}

"use client";

import type { ContentBlock } from "@/lib/schema/course";
import { cn } from "@/lib/utils";
import { Info, Lightbulb, Key, TriangleAlert } from "lucide-react";
import * as React from "react";

/**
 * The single renderer for lesson content. Everything is styled from the
 * `--ct-*` theme variables, so the workspace, the preview and the HTML export
 * all produce identical output.
 */

const CALLOUT = {
  info: { icon: Info, label: "Note" },
  tip: { icon: Lightbulb, label: "Tip" },
  warning: { icon: TriangleAlert, label: "Watch out" },
  "key-concept": { icon: Key, label: "Key concept" },
} as const;

export function ContentBlocks({ blocks, className }: { blocks: ContentBlock[]; className?: string }) {
  return (
    <div className={cn("space-y-5", className)}>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </div>
  );
}

export function BlockView({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="text-[15.5px] leading-[1.75] text-[var(--ct-text)]">{block.text}</p>
      );

    case "heading":
      return block.level === 3 ? (
        <h4 className="ct-display pt-2 text-[15.5px] font-semibold">{block.text}</h4>
      ) : (
        <h3 className="ct-display pt-3 text-[19px] font-semibold">{block.text}</h3>
      );

    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={cn("space-y-2 pl-1", block.ordered && "counter-reset-list")}>
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-3 text-[15.5px] leading-[1.7] text-[var(--ct-text)]">
              {block.ordered ? (
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--ct-accent-soft)] text-[11.5px] font-semibold text-[var(--ct-primary)] tabular-nums">
                  {index + 1}
                </span>
              ) : (
                <span className="mt-[0.65em] size-1.5 shrink-0 rounded-full bg-[var(--ct-primary)]" />
              )}
              <span>{item}</span>
            </li>
          ))}
        </Tag>
      );
    }

    case "callout": {
      const { icon: Icon, label } = CALLOUT[block.variant];
      return (
        <aside
          className="print-avoid-break flex gap-3 rounded-[var(--ct-radius)] border-l-[3px] border-[var(--ct-primary)] bg-[var(--ct-accent-soft)] px-4 py-3.5"
          style={{ borderLeftColor: "var(--ct-primary)" }}
        >
          <Icon className="mt-0.5 size-4 shrink-0 text-[var(--ct-primary)]" />
          <div className="min-w-0 space-y-1">
            <p className="text-[12px] font-semibold tracking-[0.04em] text-[var(--ct-primary)] uppercase">
              {block.title || label}
            </p>
            <p className="text-[14.5px] leading-[1.65] text-[var(--ct-text)]">{block.text}</p>
          </div>
        </aside>
      );
    }

    case "code":
      return (
        <figure className="print-avoid-break space-y-1.5">
          <div className="overflow-hidden rounded-[var(--ct-radius)] border border-[var(--ct-line)] bg-[var(--ct-surface-alt)]">
            <div className="flex items-center justify-between border-b border-[var(--ct-line)] px-3.5 py-1.5">
              <span className="font-[family-name:var(--ct-font-mono)] text-[11px] tracking-[0.04em] text-[var(--ct-muted)] uppercase">
                {block.language}
              </span>
            </div>
            <pre className="scroll-thin overflow-x-auto px-3.5 py-3">
              <code className="font-[family-name:var(--ct-font-mono)] text-[13px] leading-[1.65] whitespace-pre text-[var(--ct-text)]">
                {block.code}
              </code>
            </pre>
          </div>
          {block.caption && (
            <figcaption className="text-[12.5px] text-[var(--ct-muted)]">{block.caption}</figcaption>
          )}
        </figure>
      );

    case "example":
      return (
        <section className="ct-card print-avoid-break overflow-hidden">
          <div className="border-b border-[var(--ct-line)] bg-[var(--ct-surface-alt)] px-4 py-2.5">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--ct-primary)] uppercase">
              Example
            </p>
            <p className="ct-display mt-0.5 text-[15px] font-semibold">{block.title}</p>
          </div>
          <div className="space-y-3 px-4 py-4">
            <p className="text-[15px] leading-[1.7] text-[var(--ct-text)]">{block.scenario}</p>
            {block.walkthrough.length > 0 && (
              <ol className="space-y-2">
                {block.walkthrough.map((step, index) => (
                  <li key={index} className="flex gap-3 text-[14.5px] leading-[1.65] text-[var(--ct-text)]">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--ct-accent-soft)] text-[11.5px] font-semibold text-[var(--ct-primary)] tabular-nums">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
            {block.outcome && (
              <p className="border-t border-[var(--ct-line)] pt-3 text-[14.5px] leading-[1.65] text-[var(--ct-text)]">
                <span className="font-semibold text-[var(--ct-primary)]">Result — </span>
                {block.outcome}
              </p>
            )}
          </div>
        </section>
      );

    case "steps":
      return (
        <section className="print-avoid-break space-y-3">
          {block.title && <h4 className="ct-display text-[15.5px] font-semibold">{block.title}</h4>}
          <ol className="space-y-3">
            {block.steps.map((step, index) => (
              <li key={index} className="flex gap-3.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--ct-primary)] text-[12px] font-semibold text-[var(--ct-primary-contrast)] tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0 space-y-0.5 pb-1">
                  <p className="text-[15px] font-semibold text-[var(--ct-heading)]">{step.title}</p>
                  <p className="text-[14.5px] leading-[1.65] text-[var(--ct-text)]">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      );

    case "table":
      return (
        <figure className="print-avoid-break space-y-1.5">
          <div className="scroll-thin overflow-x-auto rounded-[var(--ct-radius)] border border-[var(--ct-line)]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[var(--ct-surface-alt)]">
                  {block.headers.map((header, index) => (
                    <th
                      key={index}
                      className="border-b border-[var(--ct-line)] px-3.5 py-2.5 text-[12.5px] font-semibold tracking-[0.02em] text-[var(--ct-heading)]"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-[var(--ct-line)] last:border-0">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="px-3.5 py-2.5 align-top text-[14px] leading-[1.6] text-[var(--ct-text)]"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && (
            <figcaption className="text-[12.5px] text-[var(--ct-muted)]">{block.caption}</figcaption>
          )}
        </figure>
      );
  }
}

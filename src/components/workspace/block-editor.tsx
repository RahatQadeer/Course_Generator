"use client";

import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu";
import { AutoTextarea, EditableList } from "@/components/workspace/editable";
import type { ContentBlock, ContentBlockType } from "@/lib/schema/course";
import { cn, id } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Code2,
  Heading2,
  List,
  ListOrdered,
  Plus,
  Quote,
  Rows3,
  Table2,
  Text,
  Trash2,
} from "lucide-react";
import * as React from "react";

const BLOCK_META: Record<ContentBlockType, { label: string; icon: React.ReactNode }> = {
  paragraph: { label: "Paragraph", icon: <Text /> },
  heading: { label: "Heading", icon: <Heading2 /> },
  list: { label: "List", icon: <List /> },
  callout: { label: "Callout", icon: <Quote /> },
  code: { label: "Code", icon: <Code2 /> },
  example: { label: "Example", icon: <ListOrdered /> },
  steps: { label: "Steps", icon: <Rows3 /> },
  table: { label: "Table", icon: <Table2 /> },
};

export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}) {
  const update = (index: number, next: ContentBlock) => {
    const copy = [...blocks];
    copy[index] = next;
    onChange(copy);
  };

  const remove = (index: number) => onChange(blocks.filter((_, entry) => entry !== index));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const copy = [...blocks];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onChange(copy);
  };

  const insert = (index: number, type: ContentBlockType) => {
    const copy = [...blocks];
    copy.splice(index + 1, 0, blankBlock(type));
    onChange(copy);
  };

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className="group/block relative rounded-[var(--radius)] border border-transparent px-3 py-2 transition-colors hover:border-[var(--line)] hover:bg-[var(--surface)]"
        >
          <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100">
            <span className="mr-1 rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium tracking-[0.04em] text-[var(--ink-faint)] uppercase">
              {BLOCK_META[block.type].label}
            </span>
            <Button
              variant="ghost"
              size="iconSm"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              aria-label="Move up"
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              disabled={index === blocks.length - 1}
              onClick={() => move(index, 1)}
              aria-label="Move down"
            >
              <ArrowDown />
            </Button>
            <AddBlockMenu onSelect={(type) => insert(index, type)} />
            <Button
              variant="dangerGhost"
              size="iconSm"
              onClick={() => remove(index)}
              aria-label="Delete block"
            >
              <Trash2 />
            </Button>
          </div>

          <BlockFields block={block} onChange={(next) => update(index, next)} />
        </div>
      ))}

      <div className="pt-1">
        <AddBlockMenu
          onSelect={(type) => insert(blocks.length - 1, type)}
          trigger={
            <Button variant="secondary" size="sm">
              <Plus />
              Add block
            </Button>
          }
        />
      </div>
    </div>
  );
}

function AddBlockMenu({
  onSelect,
  trigger,
}: {
  onSelect: (type: ContentBlockType) => void;
  trigger?: React.ReactElement<{ onClick?: (event: React.MouseEvent) => void }>;
}) {
  return (
    <Menu
      width={180}
      align="end"
      trigger={
        trigger ?? (
          <Button variant="ghost" size="iconSm" aria-label="Insert block below">
            <Plus />
          </Button>
        )
      }
    >
      <MenuLabel>Insert block</MenuLabel>
      {(Object.keys(BLOCK_META) as ContentBlockType[]).map((type) => (
        <MenuItem key={type} icon={BLOCK_META[type].icon} onSelect={() => onSelect(type)}>
          {BLOCK_META[type].label}
        </MenuItem>
      ))}
    </Menu>
  );
}

const fieldClass = "text-[15px] leading-[1.7] text-[var(--ink)]";
const labelClass =
  "text-[10.5px] font-semibold tracking-[0.07em] text-[var(--ink-faint)] uppercase";

function BlockFields({
  block,
  onChange,
}: {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
}) {
  switch (block.type) {
    case "paragraph":
      return (
        <AutoTextarea
          className={cn(fieldClass, "pr-24")}
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          placeholder="Write a paragraph…"
        />
      );

    case "heading":
      return (
        <div className="flex items-center gap-2 pr-24">
          <select
            value={block.level}
            onChange={(event) =>
              onChange({ ...block, level: Number(event.target.value) === 3 ? 3 : 2 })
            }
            className="focus-ring shrink-0 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1 text-[11px] text-[var(--ink-soft)]"
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <AutoTextarea
            className="text-[18px] leading-snug font-semibold text-[var(--ink)]"
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
            placeholder="Section heading"
          />
        </div>
      );

    case "list":
      return (
        <div className="space-y-1.5 pr-24">
          <label className="flex items-center gap-1.5 text-[11.5px] text-[var(--ink-faint)]">
            <input
              type="checkbox"
              checked={block.ordered}
              onChange={(event) => onChange({ ...block, ordered: event.target.checked })}
            />
            Numbered
          </label>
          <EditableList
            items={block.items}
            onChange={(items) => onChange({ ...block, items })}
            placeholder="Add a list item"
          />
        </div>
      );

    case "callout":
      return (
        <div className="space-y-1.5 pr-24">
          <div className="flex items-center gap-2">
            <select
              value={block.variant}
              onChange={(event) =>
                onChange({ ...block, variant: event.target.value as typeof block.variant })
              }
              className="focus-ring rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1 text-[11px] text-[var(--ink-soft)]"
            >
              <option value="info">Info</option>
              <option value="tip">Tip</option>
              <option value="warning">Warning</option>
              <option value="key-concept">Key concept</option>
            </select>
            <AutoTextarea
              className="text-[13.5px] font-medium text-[var(--ink)]"
              value={block.title ?? ""}
              onChange={(title) => onChange({ ...block, title })}
              placeholder="Callout title (optional)"
            />
          </div>
          <AutoTextarea
            className={fieldClass}
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
            placeholder="Callout text"
          />
        </div>
      );

    case "code":
      return (
        <div className="space-y-1.5 pr-24">
          <input
            value={block.language}
            onChange={(event) => onChange({ ...block, language: event.target.value })}
            placeholder="language"
            className="focus-ring w-32 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1 font-mono text-[11px] text-[var(--ink-soft)]"
          />
          <AutoTextarea
            className="rounded-[6px] border-[var(--line)] bg-[var(--surface-muted)] font-mono text-[13px] leading-[1.6]"
            value={block.code}
            onChange={(code) => onChange({ ...block, code })}
            placeholder="Code…"
          />
          <AutoTextarea
            className="text-[12.5px] text-[var(--ink-faint)]"
            value={block.caption ?? ""}
            onChange={(caption) => onChange({ ...block, caption })}
            placeholder="Caption (optional)"
          />
        </div>
      );

    case "example":
      return (
        <div className="space-y-2 pr-24">
          <AutoTextarea
            className="text-[15px] font-semibold text-[var(--ink)]"
            value={block.title}
            onChange={(title) => onChange({ ...block, title })}
            placeholder="Example title"
          />
          <AutoTextarea
            className={fieldClass}
            value={block.scenario}
            onChange={(scenario) => onChange({ ...block, scenario })}
            placeholder="The scenario"
          />
          <div>
            <p className={labelClass}>Walkthrough</p>
            <EditableList
              items={block.walkthrough}
              onChange={(walkthrough) => onChange({ ...block, walkthrough })}
              placeholder="Add a step"
            />
          </div>
          <AutoTextarea
            className="text-[14px] text-[var(--ink-soft)]"
            value={block.outcome ?? ""}
            onChange={(outcome) => onChange({ ...block, outcome })}
            placeholder="Outcome (optional)"
          />
        </div>
      );

    case "steps":
      return (
        <div className="space-y-2 pr-24">
          <AutoTextarea
            className="text-[15px] font-semibold text-[var(--ink)]"
            value={block.title ?? ""}
            onChange={(title) => onChange({ ...block, title })}
            placeholder="Steps title (optional)"
          />
          {block.steps.map((step, index) => (
            <div key={index} className="group/step flex gap-2">
              <span className="mt-2 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[11px] font-semibold text-[var(--ink-faint)] tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <AutoTextarea
                  className="text-[14.5px] font-semibold text-[var(--ink)]"
                  value={step.title}
                  onChange={(title) => {
                    const steps = [...block.steps];
                    steps[index] = { ...step, title };
                    onChange({ ...block, steps });
                  }}
                  placeholder="Step title"
                />
                <AutoTextarea
                  className="text-[14px] text-[var(--ink-soft)]"
                  value={step.detail}
                  onChange={(detail) => {
                    const steps = [...block.steps];
                    steps[index] = { ...step, detail };
                    onChange({ ...block, steps });
                  }}
                  placeholder="What to do"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...block, steps: block.steps.filter((_, entry) => entry !== index) })
                }
                className="focus-ring mt-2 rounded px-1 text-[11px] text-[var(--ink-faint)] opacity-0 group-hover/step:opacity-100 hover:text-[var(--danger)]"
              >
                Remove
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onChange({ ...block, steps: [...block.steps, { title: "", detail: "" }] })}
          >
            <Plus />
            Add step
          </Button>
        </div>
      );

    case "table":
      return (
        <div className="space-y-2 pr-24">
          <div className="scroll-thin overflow-x-auto rounded-[6px] border border-[var(--line)]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[var(--surface-muted)]">
                  {block.headers.map((header, index) => (
                    <th key={index} className="border-b border-[var(--line)] p-1">
                      <input
                        value={header}
                        onChange={(event) => {
                          const headers = [...block.headers];
                          headers[index] = event.target.value;
                          onChange({ ...block, headers });
                        }}
                        className="focus-ring w-full rounded bg-transparent px-1.5 py-1 text-[12.5px] font-semibold text-[var(--ink)]"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-[var(--line)] last:border-0">
                    {block.headers.map((_, cellIndex) => (
                      <td key={cellIndex} className="p-1">
                        <input
                          value={row[cellIndex] ?? ""}
                          onChange={(event) => {
                            const rows = block.rows.map((entry) => [...entry]);
                            while (rows[rowIndex].length < block.headers.length) rows[rowIndex].push("");
                            rows[rowIndex][cellIndex] = event.target.value;
                            onChange({ ...block, rows });
                          }}
                          className="focus-ring w-full rounded bg-transparent px-1.5 py-1 text-[13px] text-[var(--ink)]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              onClick={() =>
                onChange({
                  ...block,
                  headers: [...block.headers, `Column ${block.headers.length + 1}`],
                  rows: block.rows.map((row) => [...row, ""]),
                })
              }
            >
              <Plus />
              Column
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() =>
                onChange({ ...block, rows: [...block.rows, block.headers.map(() => "")] })
              }
            >
              <Plus />
              Row
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={block.rows.length <= 1}
              onClick={() => onChange({ ...block, rows: block.rows.slice(0, -1) })}
            >
              Remove row
            </Button>
          </div>
        </div>
      );
  }
}

export function blankBlock(type: ContentBlockType): ContentBlock {
  const base = { id: id("block") };
  switch (type) {
    case "paragraph":
      return { ...base, type, text: "" };
    case "heading":
      return { ...base, type, text: "", level: 2 };
    case "list":
      return { ...base, type, ordered: false, items: [""] };
    case "callout":
      return { ...base, type, variant: "info", text: "" };
    case "code":
      return { ...base, type, language: "text", code: "" };
    case "example":
      return { ...base, type, title: "", scenario: "", walkthrough: [] };
    case "steps":
      return { ...base, type, steps: [{ title: "", detail: "" }] };
    case "table":
      return { ...base, type, headers: ["Column 1", "Column 2"], rows: [["", ""]] };
  }
}

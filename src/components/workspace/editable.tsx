"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

/** A textarea that grows with its content. */
export function AutoTextarea({
  value,
  onChange,
  className,
  minRows = 1,
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const resize = React.useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, []);

  React.useLayoutEffect(resize, [value, resize]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
        resize();
      }}
      className={cn(
        "focus-ring w-full resize-none rounded-[6px] border border-transparent bg-transparent px-2 py-1.5 leading-relaxed transition-colors hover:border-[var(--line)] focus:border-[var(--line-strong)] focus:bg-[var(--surface)]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Click-to-edit text. Renders as prose until focused, so the page reads like a
 * document rather than a form.
 */
export function EditableText({
  value,
  onCommit,
  className,
  placeholder = "Empty",
  multiline = true,
  disabled,
  as: Tag = "div",
}: {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  as?: "div" | "h1" | "h2" | "h3" | "p";
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  // The draft is seeded when editing starts, so an external change to `value`
  // while the field is idle is picked up without a syncing effect.
  const startEditing = () => {
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== value) onCommit(next);
  };

  if (disabled) {
    return <Tag className={className}>{value || placeholder}</Tag>;
  }

  if (editing) {
    return multiline ? (
      <AutoTextarea
        autoFocus
        value={draft}
        onChange={setDraft}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) commit();
        }}
        className={cn(className, "border-[var(--line-strong)] bg-[var(--surface)]")}
      />
    ) : (
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
          if (event.key === "Enter") commit();
        }}
        className={cn(
          "focus-ring w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--surface)] px-2 py-1.5",
          className,
        )}
      />
    );
  }

  return (
    <Tag
      tabIndex={0}
      role="button"
      onClick={startEditing}
      onFocus={startEditing}
      className={cn(
        "focus-ring -mx-2 cursor-text rounded-[6px] border border-transparent px-2 py-1.5 transition-colors hover:border-[var(--line)] hover:bg-black/[0.02]",
        !value && "text-[var(--ink-faint)] italic",
        className,
      )}
    >
      {value || placeholder}
    </Tag>
  );
}

/** An editable list of short strings — objectives, takeaways, criteria. */
export function EditableList({
  items,
  onChange,
  placeholder = "Add an item",
  disabled,
  className,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = React.useState("");

  return (
    <ul className={cn("space-y-1", className)}>
      {items.map((item, index) => (
        <li key={index} className="group/item flex items-start gap-2">
          <span className="mt-[0.85em] size-1 shrink-0 rounded-full bg-[var(--ink-faint)]" />
          <EditableText
            className="min-w-0 flex-1 text-[14px] leading-relaxed"
            value={item}
            disabled={disabled}
            onCommit={(next) => {
              const copy = [...items];
              if (!next) copy.splice(index, 1);
              else copy[index] = next;
              onChange(copy);
            }}
          />
          {!disabled && (
            <button
              type="button"
              aria-label="Remove"
              onClick={() => onChange(items.filter((_, entry) => entry !== index))}
              className="focus-ring mt-1 rounded px-1 text-[11px] text-[var(--ink-faint)] opacity-0 transition-opacity group-hover/item:opacity-100 hover:text-[var(--danger)]"
            >
              Remove
            </button>
          )}
        </li>
      ))}
      {!disabled && (
        <li className="flex items-start gap-2">
          <span className="mt-[0.85em] size-1 shrink-0 rounded-full bg-[var(--line-strong)]" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && draft.trim()) {
                onChange([...items, draft.trim()]);
                setDraft("");
              }
            }}
            onBlur={() => {
              if (draft.trim()) {
                onChange([...items, draft.trim()]);
                setDraft("");
              }
            }}
            placeholder={placeholder}
            className="focus-ring min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-2 py-1.5 text-[14px] placeholder:text-[var(--ink-faint)] hover:border-[var(--line)] focus:border-[var(--line-strong)] focus:bg-[var(--surface)]"
          />
        </li>
      )}
    </ul>
  );
}

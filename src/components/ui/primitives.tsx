"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

/* -------------------------------------------------------------------------- */
/*  Card                                                                      */
/* -------------------------------------------------------------------------- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[calc(var(--radius)+4px)] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-16px_rgb(16_24_40/0.16)]",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Badge                                                                     */
/* -------------------------------------------------------------------------- */

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium tracking-[0.01em] whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-[var(--line-strong)] bg-[var(--surface-muted)] text-[var(--ink-soft)]",
        brand: "border-transparent bg-[var(--brand-soft)] text-[var(--brand)]",
        positive: "border-transparent bg-[var(--positive-soft)] text-[var(--positive)]",
        warn: "border-transparent bg-[var(--warn-soft)] text-[var(--warn)]",
        danger: "border-transparent bg-[var(--danger-soft)] text-[var(--danger)]",
        outline: "border-[var(--line-strong)] bg-transparent text-[var(--ink-soft)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/*  Section label                                                             */
/* -------------------------------------------------------------------------- */

export function SectionLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "text-[11px] font-semibold tracking-[0.09em] text-[var(--ink-faint)] uppercase",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton                                                                  */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/*  Switch                                                                    */
/* -------------------------------------------------------------------------- */

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "focus-ring mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked
            ? "border-[var(--brand)] bg-[var(--brand)]"
            : "border-[var(--line-strong)] bg-[var(--surface-muted)]",
        )}
      >
        <span
          className={cn(
            "block size-3.5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4.5" : "translate-x-[3px]",
          )}
        />
      </button>
      <span className="space-y-0.5">
        <span className="block text-[13.5px] font-medium text-[var(--ink)]">{label}</span>
        {description && (
          <span className="block text-[12.5px] leading-snug text-[var(--ink-faint)]">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/*  Segmented control                                                         */
/* -------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface-muted)] p-0.5",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "focus-ring inline-flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius)-3px)] font-medium transition-colors",
            size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]",
            value === option.value
              ? "bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_2px_rgb(16_24_40/0.10)]"
              : "text-[var(--ink-soft)] hover:text-[var(--ink)]",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                               */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      {icon && (
        <div className="mb-4 flex size-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-faint)]">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-medium text-[var(--ink)]">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-[var(--ink-faint)]">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Progress bar                                                              */
/* -------------------------------------------------------------------------- */

export function Progress({
  value,
  className,
  tone = "brand",
}: {
  value: number;
  className?: string;
  tone?: "brand" | "positive" | "warn";
}) {
  const color =
    tone === "positive"
      ? "var(--positive)"
      : tone === "warn"
        ? "var(--warn)"
        : "var(--brand)";
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]", className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tooltip (CSS-only)                                                        */
/* -------------------------------------------------------------------------- */

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 -translate-x-1/2 scale-95 rounded-md bg-[var(--ink)] px-2 py-1 text-[11.5px] whitespace-nowrap text-white opacity-0 transition-all duration-150 group-hover/tt:scale-100 group-hover/tt:opacity-100">
        {label}
      </span>
    </span>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import * as React from "react";

const controlBase =
  "focus-ring w-full rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] transition-colors hover:border-[#bfbfba] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--ink-faint)]";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlBase, "h-10 px-3", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(controlBase, "min-h-24 resize-y px-3 py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlBase, "h-10 cursor-pointer appearance-none pr-9 pl-3", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[var(--ink-faint)]" />
    </div>
  );
});

export function Field({
  label,
  hint,
  error,
  optional,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-[13px] font-medium tracking-[0.01em] text-[var(--ink)]"
        >
          {label}
          {optional && (
            <span className="ml-1.5 text-[12px] font-normal text-[var(--ink-faint)]">optional</span>
          )}
        </label>
        {hint && <span className="text-[12px] text-[var(--ink-faint)]">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-[12.5px] text-[var(--danger)]">{error}</p>}
    </div>
  );
}

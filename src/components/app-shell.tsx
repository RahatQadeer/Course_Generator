"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)}>
      <span className="flex size-7 items-center justify-center rounded-[7px] bg-[var(--brand)] text-white shadow-[0_1px_2px_rgb(16_24_40/0.2)]">
        <Sparkles className="size-3.5" strokeWidth={2.4} />
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
        CourseGen
      </span>
    </Link>
  );
}

export function TopBar({
  left,
  center,
  right,
  className,
}: {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-[var(--line)] bg-[var(--surface)]/85 px-4 backdrop-blur-md sm:px-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">{left ?? <Wordmark />}</div>
      {center && <div className="hidden min-w-0 flex-1 justify-center md:flex">{center}</div>}
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </header>
  );
}

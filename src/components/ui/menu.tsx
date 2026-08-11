"use client";

import { cn } from "@/lib/utils";
import * as React from "react";
import { createPortal } from "react-dom";

type Align = "start" | "end";

type MenuContext = {
  close: () => void;
};
const Ctx = React.createContext<MenuContext>({ close: () => {} });

export function Menu({
  trigger,
  children,
  align = "end",
  width = 224,
  className,
}: {
  trigger: React.ReactElement<{ onClick?: (event: React.MouseEvent) => void; ref?: unknown }>;
  children: React.ReactNode;
  align?: Align;
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const place = React.useCallback(() => {
    const node = anchorRef.current?.firstElementChild ?? anchorRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const left = align === "end" ? rect.right - width : rect.left;
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimated = panelRef.current?.offsetHeight ?? 280;
    const top = spaceBelow < estimated + 16 ? rect.top - Math.min(estimated, rect.top - 8) - 6 : rect.bottom + 6;
    setCoords({
      top,
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
    });
  }, [align, width]);

  React.useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (
        !panelRef.current?.contains(event.target as Node) &&
        !anchorRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <span
        ref={anchorRef}
        className="contents"
        onClickCapture={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        {trigger}
      </span>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ top: coords.top, left: coords.left, width }}
            className={cn(
              "animate-fade-in fixed z-[100] overflow-hidden rounded-[calc(var(--radius)+2px)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[0_12px_32px_-8px_rgb(16_24_40/0.24)]",
              className,
            )}
          >
            <Ctx.Provider value={{ close: () => setOpen(false) }}>{children}</Ctx.Provider>
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({
  icon,
  children,
  onSelect,
  danger,
  disabled,
  shortcut,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}) {
  const { close } = React.useContext(Ctx);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        close();
        onSelect?.();
      }}
      className={cn(
        "focus-ring flex w-full items-center gap-2.5 rounded-[calc(var(--radius)-3px)] px-2.5 py-[7px] text-left text-[13px] transition-colors disabled:pointer-events-none disabled:opacity-45",
        danger
          ? "text-[var(--danger)] hover:bg-[var(--danger-soft)]"
          : "text-[var(--ink)] hover:bg-[var(--surface-muted)]",
      )}
    >
      {icon && <span className="text-[var(--ink-faint)] [&_svg]:size-4">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <span className="text-[11px] text-[var(--ink-faint)]">{shortcut}</span>}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.08em] text-[var(--ink-faint)] uppercase">
      {children}
    </div>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-[var(--line)]" />;
}

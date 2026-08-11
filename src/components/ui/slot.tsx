"use client";

import * as React from "react";

/** Minimal `asChild` implementation — merges props onto a single child element. */
export const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  function Slot({ children, ...props }, ref) {
    if (!React.isValidElement(children)) return null;
    const child = children as React.ReactElement<Record<string, unknown>>;
    const childProps = child.props;

    return React.cloneElement(child, {
      ...props,
      ...childProps,
      className: [props.className, childProps.className as string | undefined]
        .filter(Boolean)
        .join(" "),
      style: { ...(props.style ?? {}), ...((childProps.style as object) ?? {}) },
      ref,
    } as Record<string, unknown>);
  },
);

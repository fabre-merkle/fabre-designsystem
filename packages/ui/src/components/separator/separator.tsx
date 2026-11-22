"use client";
import "./separator.css";
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import type React from "react";

export type SeparatorVariant = "line" | "solid-text" | "underline" | "content";
export type SeparatorSize = "sm" | "md" | "lg";
export type SeparatorOrientation = "horizontal" | "vertical";

export interface SeparatorProps extends React.ComponentProps<typeof SeparatorPrimitive> {
  /**
   * Visual treatment: pure stroke, label on a stroke, label with an underline,
   * or label flanked by two strokes.
   * @default "line"
   */
  variant?: SeparatorVariant;
  /**
   * Label text size. Ignored on the `line` variant.
   * @default "md"
   */
  size?: SeparatorSize;
  /**
   * Axis of the separator. Vertical separators stretch to fill the cross axis
   * of a flex container.
   * @default "horizontal"
   */
  orientation?: SeparatorOrientation;
}

export function Separator({
  variant = "line",
  size = "md",
  orientation = "horizontal",
  children,
  ...props
}: SeparatorProps) {
  const hasContent = variant !== "line";
  return (
    <SeparatorPrimitive
      data-ui="separator"
      data-variant={variant}
      data-size={hasContent ? size : undefined}
      orientation={orientation}
      render={hasContent ? <div /> : undefined}
      {...props}
    >
      {hasContent ? <span>{children}</span> : null}
    </SeparatorPrimitive>
  );
}

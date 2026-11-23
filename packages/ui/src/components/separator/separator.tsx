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

/**
 * A divider between groups of content. By default it is decorative — Base UI gives it
 * `role="separator"`, and screen readers treat a plain rule as presentational — so reach
 * for it to show a boundary the layout alone does not, not to carry meaning.
 *
 * The labelled variants (`solid-text`, `underline`, `content`) put a word on the rule, for
 * a boundary that needs naming: "or", "Today", "Archived".
 */
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

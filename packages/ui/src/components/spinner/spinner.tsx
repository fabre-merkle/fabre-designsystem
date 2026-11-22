"use client";
import "./spinner.css";
import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import type React from "react";

/** Matches the `--control-icon-*` scale so a Spinner can stand in for an icon. */
export type SpinnerSize = "xs" | "sm" | "md" | "lg";
/** `current` inherits the text colour (inside a Button); `brand` paints the
 *  arc in `--color-primary-on-surface-subtle`, the theme-aware brand ink. */
export type SpinnerTone = "current" | "brand";

export type SpinnerProps = Omit<
  React.ComponentProps<typeof ProgressPrimitive.Root>,
  "value" | "children" | "min" | "max" | "format"
> & {
  /**
   * Diameter, from the control icon scale, so a spinner can stand in for an
   * icon inside a control.
   * @default "md"
   */
  size?: SpinnerSize;
  /**
   * Arc colour. `current` inherits the text colour; `brand` uses the theme-aware
   * brand ink. The track colour is fixed.
   * @default "current"
   */
  tone?: SpinnerTone;
  /**
   * Accessible name. Ignored when `aria-label` or `aria-labelledby` is supplied.
   * @default "Loading"
   */
  label?: string;
};

/**
 * Spinner — an indeterminate loading indicator. Composes Base UI Progress with
 * `value={null}`, so it carries `role="progressbar"` and an indeterminate
 * `aria-valuetext` for free.
 */
export function Spinner({
  size = "md",
  tone = "current",
  label = "Loading",
  ...rest
}: SpinnerProps) {
  const named = "aria-labelledby" in rest || "aria-label" in rest;
  return (
    <ProgressPrimitive.Root
      value={null}
      aria-label={named ? undefined : label}
      data-ui="spinner"
      data-size={size}
      data-tone={tone}
      {...rest}
    >
      <svg data-ui="spinner-svg" viewBox="0 0 24 24" aria-hidden="true">
        <circle data-ui="spinner-track" cx="12" cy="12" r="10" />
        <circle data-ui="spinner-arc" cx="12" cy="12" r="10" pathLength="100" />
      </svg>
    </ProgressPrimitive.Root>
  );
}

"use client";
import "./progress.css";
import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import React from "react";

type ProgressSize = "sm" | "md" | "lg";

const ProgressContext = React.createContext<{ size: ProgressSize }>({
  size: "md",
});

interface RootProps extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  /**
   * Track height: `sm` 4px, `md` 8px, `lg` 12px. Passed to the track through context.
   * @default "md"
   */
  size?: ProgressSize;
}

/**
 * How far along a task is, when the share done is known — an upload, an import, a
 * multi-step form. Use Spinner instead when the end is unknown, and Meter for a static
 * measurement such as disk usage, which is a level rather than progress.
 *
 * Compose it: `Progress.Root` takes `value` (0–100, or `null` for indeterminate) and holds
 * `Progress.Label`, `Progress.Value` and a `Progress.Track` wrapping `Progress.Indicator`.
 */
function Root({ size = "md", ...rest }: RootProps) {
  return (
    <ProgressContext.Provider value={{ size }}>
      <ProgressPrimitive.Root data-ui="progress" data-size={size} {...rest} />
    </ProgressContext.Provider>
  );
}

function Label(props: React.ComponentProps<typeof ProgressPrimitive.Label>) {
  return <ProgressPrimitive.Label data-ui="progress-label" {...props} />;
}

function Value(props: React.ComponentProps<typeof ProgressPrimitive.Value>) {
  return <ProgressPrimitive.Value data-ui="progress-value" {...props} />;
}

function Track(props: React.ComponentProps<typeof ProgressPrimitive.Track>) {
  const { size } = React.useContext(ProgressContext);
  return <ProgressPrimitive.Track data-ui="progress-track" data-size={size} {...props} />;
}

function Indicator(props: React.ComponentProps<typeof ProgressPrimitive.Indicator>) {
  return <ProgressPrimitive.Indicator data-ui="progress-indicator" {...props} />;
}

export const Progress = {
  Root,
  Label,
  Value,
  Track,
  Indicator,
};

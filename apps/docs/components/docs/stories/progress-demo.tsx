"use client";
import type { Progress } from "@workspace/ui/components/progress";
import type { ComponentProps } from "react";
import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
  ProgressValue,
} from "../progress-parts";

type ProgressRootProps = ComponentProps<typeof Progress.Root>;

/** Props of the demo: the Progress props it exposes, then the demo-only settings (see `demoArgs`). */
export type ProgressDemoProps = Pick<ProgressRootProps, "size"> & {
  /** Completion from 0 to 100. */
  value?: number;
  /** Render the indeterminate bar, which has no known value. */
  indeterminate?: boolean;
  /** The label above the track. */
  label?: string;
  /** Show the formatted value beside the label. */
  showValue?: boolean;
};

/** A progress bar, determinate or indeterminate. */
export function ProgressDemo({
  size = "md",
  value = 60,
  indeterminate = false,
  label = "Uploading",
  showValue = true,
}: ProgressDemoProps) {
  return (
    <div data-focus-island>
      <ProgressRoot size={size} value={indeterminate ? null : value} style={{ width: 280 }}>
        <ProgressLabel>{label}</ProgressLabel>
        {showValue && !indeterminate ? <ProgressValue /> : null}
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </ProgressRoot>
    </div>
  );
}

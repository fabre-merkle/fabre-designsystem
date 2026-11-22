"use client";
import type { Meter } from "@workspace/ui/components/meter";
import type { ComponentProps } from "react";
import { MeterIndicator, MeterLabel, MeterRoot, MeterTrack, MeterValue } from "../meter-parts";

type MeterRootProps = ComponentProps<typeof Meter.Root>;

/** Props of the demo: the Meter props it exposes, then the demo-only settings (see `demoArgs`). */
export type MeterDemoProps = Pick<MeterRootProps, "size" | "tone"> & {
  /** The measured value, 0 to 100. */
  value?: number;
  /** The label above the track. */
  label?: string;
};

/** A meter showing a measurement against a known range. */
export function MeterDemo({
  size = "md",
  tone = "neutral",
  value = 64,
  label = "Storage used",
}: MeterDemoProps) {
  return (
    <div data-focus-island>
      <MeterRoot size={size} tone={tone} value={value} style={{ width: 280 }}>
        <MeterLabel>{label}</MeterLabel>
        <MeterValue />
        <MeterTrack>
          <MeterIndicator />
        </MeterTrack>
      </MeterRoot>
    </div>
  );
}

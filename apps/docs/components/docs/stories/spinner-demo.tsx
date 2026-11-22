"use client";
import { Button } from "@workspace/ui/components/button";
import { Spinner, type SpinnerProps } from "@workspace/ui/components/spinner";

const SIZES = ["xs", "sm", "md", "lg"] as const;

/** Props of the demo: the Spinner props it exposes, then the demo-only settings (see `demoArgs`). */
export type SpinnerDemoProps = Pick<SpinnerProps, "size" | "tone" | "label"> & {
  /** Render the spinner inside a disabled Button, where `tone="current"` suits it. */
  inButton?: boolean;
  /** Render the four sizes side by side. */
  showAllSizes?: boolean;
};

/** A Spinner on its own, in a Button, or as the four sizes. */
export function SpinnerDemo({
  size = "md",
  tone = "current",
  label = "Loading",
  inButton = false,
  showAllSizes = false,
}: SpinnerDemoProps) {
  return (
    <div data-focus-island>
      <div style={{ display: "flex", gap: "var(--spacing-400)", alignItems: "center" }}>
        {inButton ? (
          <Button variant="primary" mode="filled" disabled>
            <Spinner size="xs" tone={tone} label={label} />
            Saving
          </Button>
        ) : (
          (showAllSizes ? SIZES : [size]).map((value) => (
            <Spinner key={value} size={value} tone={tone} label={label} />
          ))
        )}
      </div>
    </div>
  );
}

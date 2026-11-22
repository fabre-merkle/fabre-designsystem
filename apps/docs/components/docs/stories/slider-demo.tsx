"use client";
import { Slider } from "@workspace/ui/components/slider";

/** Props of the demo: the Slider props it exposes, then the demo-only settings (see `demoArgs`). */
export type SliderDemoProps = {
  /** Track and thumb scale. */
  size?: "sm" | "md" | "lg";
  /** Make the slider inert. */
  disabled?: boolean;
  /** The lowest value. */
  min?: number;
  /** The highest value. */
  max?: number;
  /** The granularity the value snaps to. */
  step?: number;
  /** Select a range with two thumbs instead of a single value. */
  range?: boolean;
  /** Show the current value above the track. */
  showValue?: boolean;
};

/** One Slider, keyed by `range` so switching between one thumb and two never keeps a stale value. */
export function SliderDemo({
  size,
  disabled,
  min,
  max,
  step,
  range = false,
  showValue = true,
}: SliderDemoProps) {
  return (
    <div data-focus-island>
      <Slider.Root
        key={range ? "range" : "single"}
        size={size}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        defaultValue={range ? [20, 80] : 40}
      >
        {showValue ? <Slider.Value /> : null}
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
            {range ? (
              <>
                <Slider.Thumb index={0} aria-label="Minimum" />
                <Slider.Thumb index={1} aria-label="Maximum" />
              </>
            ) : (
              <Slider.Thumb aria-label="Volume" />
            )}
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}

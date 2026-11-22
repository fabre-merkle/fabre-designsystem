"use client";
import { NumberField } from "@workspace/ui/components/number-field";

/** Props of the demo: the NumberField props it exposes, then the demo-only settings (see `demoArgs`). */
export type NumberFieldDemoProps = {
  /** Control height. */
  size?: "sm" | "md" | "lg";
  /** Make the field inert. */
  disabled?: boolean;
  /** Mark the field invalid for error styling. */
  invalid?: boolean;
  /** The lowest value. The decrement button disables at it. */
  min?: number;
  /** The highest value. The increment button disables at it. */
  max?: number;
  /** How much the buttons and arrow keys change the value. */
  step?: number;
  /** The value shown at first. */
  defaultValue?: number;
  /** Add a label the pointer can drag to change the value. */
  scrubArea?: boolean;
};

/** One NumberField. It is keyed by `defaultValue` and `scrubArea` so the controls reset it. */
export function NumberFieldDemo({
  size,
  disabled,
  invalid,
  min,
  max,
  step,
  defaultValue = 4,
  scrubArea = false,
}: NumberFieldDemoProps) {
  return (
    <div data-focus-island>
      <NumberField.Root
        key={`${defaultValue}-${scrubArea}`}
        size={size}
        disabled={disabled}
        invalid={invalid}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
      >
        {scrubArea ? (
          <NumberField.ScrubArea>
            <span style={{ paddingInlineEnd: "var(--spacing-200)" }}>Quantity</span>
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        ) : null}
        <NumberField.Group>
          <NumberField.Decrement aria-label="Decrease">−</NumberField.Decrement>
          <NumberField.Input aria-label="Quantity" />
          <NumberField.Increment aria-label="Increase">+</NumberField.Increment>
        </NumberField.Group>
      </NumberField.Root>
    </div>
  );
}

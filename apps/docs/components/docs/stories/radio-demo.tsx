"use client";
import { Radio, type RadioProps } from "@workspace/ui/components/radio";
import { RadioGroup } from "@workspace/ui/components/radio-group";

/** Props of the demo: the Radio props it exposes, then the demo-only settings (see `demoArgs`). */
export type RadioDemoProps = Pick<RadioProps, "disabled" | "readOnly" | "required"> & {
  /** Which radio is selected at first. */
  selected?: "monthly" | "yearly" | "none";
};

const labelStyle = {
  alignItems: "center",
  display: "inline-flex",
  gap: "var(--spacing-200)",
} as const;

/**
 * Two radios in a RadioGroup, which owns the selection. The `disabled`, `readOnly` and `required`
 * settings go on the second radio, so the first shows the regular state beside it. It is keyed by
 * `selected` so the control resets the group.
 */
export function RadioDemo({ disabled, readOnly, required, selected = "monthly" }: RadioDemoProps) {
  return (
    <div data-focus-island>
      <RadioGroup
        key={selected}
        aria-label="Billing period"
        defaultValue={selected === "none" ? undefined : selected}
      >
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the Base UI control renders its input inside the label. */}
        <label style={labelStyle}>
          <Radio value="monthly" />
          Monthly
        </label>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the Base UI control renders its input inside the label. */}
        <label style={labelStyle}>
          <Radio value="yearly" disabled={disabled} readOnly={readOnly} required={required} />
          Yearly
        </label>
      </RadioGroup>
    </div>
  );
}

"use client";
import { Checkbox, type CheckboxProps } from "@workspace/ui/components/checkbox";

export type CheckboxDemoProps = Pick<
  CheckboxProps,
  "defaultChecked" | "indeterminate" | "disabled" | "readOnly" | "required"
> & {
  /** The visible label beside the checkbox. */
  label?: string;
};

/** A Checkbox inside its label. It is keyed by `defaultChecked` so the control resets the state. */
export function CheckboxDemo({
  defaultChecked = false,
  indeterminate,
  disabled,
  readOnly,
  required,
  label = "Accept the terms",
}: CheckboxDemoProps) {
  return (
    <div data-focus-island>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the Base UI control renders its input inside the label. */}
      <label style={{ alignItems: "center", display: "inline-flex", gap: "var(--spacing-200)" }}>
        <Checkbox
          key={`${defaultChecked}`}
          defaultChecked={defaultChecked}
          indeterminate={indeterminate}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
        />
        {label}
      </label>
    </div>
  );
}

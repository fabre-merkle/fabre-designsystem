"use client";
import { Switch, type SwitchProps } from "@workspace/ui/components/switch";

export type SwitchDemoProps = Pick<
  SwitchProps,
  "defaultChecked" | "disabled" | "readOnly" | "required"
> & {
  /** The visible label beside the switch. */
  label?: string;
};

/** A Switch inside its label. It is keyed by `defaultChecked` so the control resets the state. */
export function SwitchDemo({
  defaultChecked = false,
  disabled,
  readOnly,
  required,
  label = "Email notifications",
}: SwitchDemoProps) {
  return (
    <div data-focus-island>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the Base UI control renders its input inside the label. */}
      <label style={{ alignItems: "center", display: "inline-flex", gap: "var(--spacing-200)" }}>
        <Switch
          key={`${defaultChecked}`}
          defaultChecked={defaultChecked}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
        />
        {label}
      </label>
    </div>
  );
}

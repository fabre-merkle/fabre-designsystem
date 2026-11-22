"use client";
import { Radio } from "@workspace/ui/components/radio";
import { RadioGroup } from "@workspace/ui/components/radio-group";

const OPTIONS = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push" },
] as const;

/** Props of the demo: the RadioGroup props it exposes, then the demo-only settings (see `demoArgs`). */
export type RadioGroupDemoProps = {
  /** The option selected at first. */
  defaultValue?: "email" | "sms" | "push";
  /** Make every option inert. */
  disabled?: boolean;
  /** Keep the selection readable and focusable, but not changeable. */
  readOnly?: boolean;
  /** Require an option before a form can submit. */
  required?: boolean;
  /** Disable the last option only, to show a single inert radio inside a live group. */
  disabledOption?: boolean;
};

/** A RadioGroup of three labelled radios. It is keyed by `defaultValue` so the control resets it. */
export function RadioGroupDemo({
  defaultValue = "email",
  disabled,
  readOnly,
  required,
  disabledOption = false,
}: RadioGroupDemoProps) {
  return (
    <div data-focus-island>
      <RadioGroup
        key={defaultValue}
        aria-label="Notification channel"
        defaultValue={defaultValue}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
      >
        {OPTIONS.map((option) => (
          // biome-ignore lint/a11y/noLabelWithoutControl: the Base UI control renders its input inside the label.
          <label
            key={option.value}
            style={{ alignItems: "center", display: "inline-flex", gap: "var(--spacing-200)" }}
          >
            <Radio value={option.value} disabled={disabledOption && option.value === "push"} />
            {option.label}
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

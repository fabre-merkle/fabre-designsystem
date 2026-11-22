"use client";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { CheckboxGroup, type CheckboxGroupProps } from "@workspace/ui/components/checkbox-group";

const OPTIONS = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push" },
] as const;

const ALL_VALUES = OPTIONS.map((option) => option.value);

/** Props of the demo: the CheckboxGroup props it exposes, then the demo-only settings (see `demoArgs`). */
export type CheckboxGroupDemoProps = Pick<CheckboxGroupProps, "disabled"> & {
  /** How many options start checked. */
  selected?: "none" | "some" | "all";
  /** Add a parent checkbox that checks and clears the whole set (passes `allValues`). */
  showParent?: boolean;
};

const labelStyle = {
  alignItems: "center",
  display: "inline-flex",
  gap: "var(--spacing-200)",
} as const;

/** A CheckboxGroup of three labelled checkboxes. It is keyed by its settings so the controls reset it. */
export function CheckboxGroupDemo({
  disabled,
  selected = "some",
  showParent = false,
}: CheckboxGroupDemoProps) {
  const defaultValue = selected === "all" ? ALL_VALUES : selected === "some" ? ["email"] : [];
  return (
    <div data-focus-island>
      <CheckboxGroup
        key={`${selected}-${showParent}`}
        aria-label="Notification channels"
        defaultValue={defaultValue}
        allValues={showParent ? ALL_VALUES : undefined}
        disabled={disabled}
      >
        {showParent ? (
          // biome-ignore lint/a11y/noLabelWithoutControl: the Base UI control renders its input inside the label.
          <label style={labelStyle}>
            <Checkbox parent />
            All channels
          </label>
        ) : null}
        {OPTIONS.map((option) => (
          // biome-ignore lint/a11y/noLabelWithoutControl: the Base UI control renders its input inside the label.
          <label
            key={option.value}
            style={{ ...labelStyle, paddingInlineStart: showParent ? "var(--spacing-400)" : 0 }}
          >
            <Checkbox name={option.value} />
            {option.label}
          </label>
        ))}
      </CheckboxGroup>
    </div>
  );
}

"use client";
import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import type { ComponentProps } from "react";

type FieldRootProps = ComponentProps<typeof Field.Root>;

/** Props of the demo: the Field props it exposes, then the demo-only settings (see `demoArgs`). */
export type FieldDemoProps = Pick<FieldRootProps, "disabled" | "invalid" | "validationMode"> & {
  /** The label above the control. */
  label?: string;
  /** Show the helper text under the control. */
  showDescription?: boolean;
  /** Mark the control required, so an empty value fails validation. */
  required?: boolean;
};

/** One Field around an email Input. It is keyed by its settings so the controls reset its validity. */
export function FieldDemo({
  disabled = false,
  invalid = false,
  validationMode = "onSubmit",
  label = "Work email",
  showDescription = true,
  required = false,
}: FieldDemoProps) {
  return (
    <div data-focus-island>
      <Field.Root
        key={`${invalid}-${validationMode}-${required}`}
        name="email"
        disabled={disabled}
        invalid={invalid}
        validationMode={validationMode}
        style={{ minWidth: "18rem" }}
      >
        <Field.Label>{label}</Field.Label>
        <Field.Control
          render={<Input type="email" placeholder="you@example.com" required={required} />}
        />
        {showDescription ? (
          <Field.Description>We only use this to send the invite.</Field.Description>
        ) : null}
        {invalid ? (
          <Field.Error match>That address is already registered.</Field.Error>
        ) : (
          <>
            <Field.Error match="valueMissing">An email is required.</Field.Error>
            <Field.Error match="typeMismatch">Enter a valid email address.</Field.Error>
          </>
        )}
      </Field.Root>
    </div>
  );
}

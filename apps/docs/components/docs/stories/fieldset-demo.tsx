"use client";
import { Field } from "@workspace/ui/components/field";
import { Fieldset } from "@workspace/ui/components/fieldset";
import { Input } from "@workspace/ui/components/input";
import type { ComponentProps } from "react";

type FieldsetRootProps = ComponentProps<typeof Fieldset.Root>;

/** Props of the demo: the Fieldset props it exposes, then the demo-only settings (see `demoArgs`). */
export type FieldsetDemoProps = Pick<FieldsetRootProps, "disabled"> & {
  /** The legend: the accessible name of the group. */
  legend?: string;
  /** Mark the email field invalid, to show a field error inside the group. */
  invalidEmail?: boolean;
};

/** A Fieldset grouping two Fields under a legend. */
export function FieldsetDemo({
  disabled = false,
  legend = "Billing contact",
  invalidEmail = false,
}: FieldsetDemoProps) {
  return (
    <div data-focus-island>
      <Fieldset.Root disabled={disabled} style={{ minWidth: "20rem" }}>
        <Fieldset.Legend>{legend}</Fieldset.Legend>
        <Field.Root name="name">
          <Field.Label>Full name</Field.Label>
          <Field.Control render={<Input placeholder="Ada Lovelace" />} />
        </Field.Root>
        <Field.Root name="email" invalid={invalidEmail}>
          <Field.Label>Email</Field.Label>
          <Field.Control render={<Input type="email" placeholder="ada@example.com" />} />
          <Field.Description>Receipts are sent here.</Field.Description>
          <Field.Error match>Enter a valid email address.</Field.Error>
        </Field.Root>
      </Fieldset.Root>
    </div>
  );
}

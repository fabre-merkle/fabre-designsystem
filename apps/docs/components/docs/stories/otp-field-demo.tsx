"use client";
import { Field } from "@workspace/ui/components/field";
import { OTPField } from "@workspace/ui/components/otp-field";
import { Fragment } from "react";

/** Props of the demo: the OTPField props it exposes, then the demo-only settings (see `demoArgs`). */
export type OTPFieldDemoProps = {
  /** The number of slots. */
  length?: number;
  /** Make every slot inert. */
  disabled?: boolean;
  /** Hide the characters as they are typed. */
  mask?: boolean;
  /** The code entered at first. */
  defaultValue?: string;
  /** Mark the field invalid for error styling. */
  invalid?: boolean;
  /** Split the slots into two groups with a separator. */
  separator?: boolean;
};

/** One OTPField inside a Field with a visible label. It is keyed by the settings that reset it. */
export function OTPFieldDemo({
  length = 6,
  disabled,
  mask,
  defaultValue = "",
  invalid,
  separator = false,
}: OTPFieldDemoProps) {
  const slots = Array.from({ length }, (_, index) => index);
  const middle = Math.floor(length / 2);
  return (
    <div data-focus-island>
      <Field.Root key={`${length}-${defaultValue}`} invalid={invalid}>
        <Field.Label>Verification code</Field.Label>
        <OTPField.Root length={length} disabled={disabled} mask={mask} defaultValue={defaultValue}>
          {slots.map((index) => (
            <Fragment key={index}>
              {separator && index === middle ? <OTPField.Separator /> : null}
              <OTPField.Input />
            </Fragment>
          ))}
        </OTPField.Root>
      </Field.Root>
    </div>
  );
}

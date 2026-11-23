"use client";
import "./otp-field.css";
import { OTPField as OTPFieldPrimitive } from "@base-ui/react/otp-field";
import type * as React from "react";

export type OTPFieldRootProps = React.ComponentProps<typeof OTPFieldPrimitive.Root>;

/**
 * A one-time code, split into one box per character. It is a single value behind the
 * scenes, so pasting a whole code fills every box at once and the caret moves on its own
 * as the user types.
 *
 * Compose it: `OTPField.Root` takes the `length` and holds that many `OTPField.Input`s,
 * with optional `OTPField.Separator`s between groups. Name the root, not the boxes — a
 * screen reader should hear one field, not six.
 */
export function Root({ children, ...props }: OTPFieldRootProps) {
  return (
    <OTPFieldPrimitive.Root {...props} data-ui="otp-field">
      {children}
    </OTPFieldPrimitive.Root>
  );
}

export type OTPFieldInputProps = React.ComponentProps<typeof OTPFieldPrimitive.Input>;

export function Input(props: OTPFieldInputProps) {
  return <OTPFieldPrimitive.Input {...props} data-ui="otp-field-input" />;
}

export type OTPFieldSeparatorProps = React.ComponentProps<typeof OTPFieldPrimitive.Separator>;

export function Separator(props: OTPFieldSeparatorProps) {
  return <OTPFieldPrimitive.Separator {...props} data-ui="otp-field-separator" />;
}

export const OTPField = { Root, Input, Separator };

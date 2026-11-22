"use client";
import "./otp-field.css";
import { OTPField as OTPFieldPrimitive } from "@base-ui/react/otp-field";
import type * as React from "react";

export type OTPFieldRootProps = React.ComponentProps<typeof OTPFieldPrimitive.Root>;

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

"use client";
import "./input.css";
import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends Omit<React.ComponentProps<typeof InputPrimitive>, "size"> {
  /** Control size — matches the Button of the same size. @default "md" */
  size?: InputSize;
}

/**
 * A single-line text control. Input renders the control ONLY — it has no built-in label,
 * description or error text, so pair it with Field (or your own `<label>`) for an
 * accessible name. Its `size` matches the Button of the same size, so the two line up on
 * one row. For a numeric stepper use NumberField; for a one-time code use OTPField.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", ...props },
  ref,
) {
  return <InputPrimitive ref={ref} {...props} data-ui="input" data-size={size} />;
});

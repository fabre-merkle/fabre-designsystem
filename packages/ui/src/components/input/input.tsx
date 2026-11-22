"use client";
import "./input.css";
import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends Omit<React.ComponentProps<typeof InputPrimitive>, "size"> {
  /** Control size — matches the Button of the same size. @default "md" */
  size?: InputSize;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", ...props },
  ref,
) {
  return <InputPrimitive ref={ref} {...props} data-ui="input" data-size={size} />;
});

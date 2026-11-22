"use client";
import "./radio.css";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import type * as React from "react";

export interface RadioProps<Value = unknown>
  extends React.ComponentProps<typeof RadioPrimitive.Root<Value>> {}

export function Radio<Value = unknown>(props: RadioProps<Value>) {
  return (
    <RadioPrimitive.Root {...props} data-ui="radio">
      <RadioPrimitive.Indicator data-ui="radio-indicator" keepMounted />
    </RadioPrimitive.Root>
  );
}

"use client";
import "./radio.css";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import type * as React from "react";

export interface RadioProps<Value = unknown>
  extends React.ComponentProps<typeof RadioPrimitive.Root<Value>> {}

/**
 * One option within a RadioGroup. A radio never stands alone: choosing between it and
 * nothing is a Checkbox, and a radio outside a group has no set to be exclusive within.
 *
 * It renders the circle only and takes no children, so each option needs an accessible
 * name from a wrapping `<label>` or `aria-label`. Note the asymmetry with Checkbox:
 * a radio cannot be unchosen once chosen, so offer an explicit "None" option whenever
 * clearing the answer must stay possible.
 */
export function Radio<Value = unknown>(props: RadioProps<Value>) {
  return (
    <RadioPrimitive.Root {...props} data-ui="radio">
      <RadioPrimitive.Indicator data-ui="radio-indicator" keepMounted />
    </RadioPrimitive.Root>
  );
}

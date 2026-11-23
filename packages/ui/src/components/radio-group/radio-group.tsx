"use client";
import "./radio-group.css";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import type * as React from "react";

export interface RadioGroupProps<Value = unknown>
  extends React.ComponentProps<typeof RadioGroupPrimitive<Value>> {}

/**
 * A set of mutually exclusive options, all visible at once. Use Select instead when the
 * list is long enough that showing it all is noise — the rough line is about five options.
 *
 * The group owns the value, so `defaultValue` and `onValueChange` go here rather than on
 * the individual Radios. Give the group an accessible name; each Radio is named
 * separately by its own label.
 */
export function RadioGroup<Value = unknown>(props: RadioGroupProps<Value>) {
  return <RadioGroupPrimitive {...props} data-ui="radio-group" />;
}

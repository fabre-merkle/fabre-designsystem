"use client";
import "./radio-group.css";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import type * as React from "react";

export interface RadioGroupProps<Value = unknown>
  extends React.ComponentProps<typeof RadioGroupPrimitive<Value>> {}

export function RadioGroup<Value = unknown>(props: RadioGroupProps<Value>) {
  return <RadioGroupPrimitive {...props} data-ui="radio-group" />;
}

"use client";
import "./checkbox-group.css";
import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";
import type * as React from "react";

export type CheckboxGroupProps = React.ComponentProps<typeof CheckboxGroupPrimitive>;

export function CheckboxGroup(props: CheckboxGroupProps) {
  return <CheckboxGroupPrimitive {...props} data-ui="checkbox-group" />;
}

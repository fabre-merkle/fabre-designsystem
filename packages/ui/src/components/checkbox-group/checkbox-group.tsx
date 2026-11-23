"use client";
import "./checkbox-group.css";
import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";
import type * as React from "react";

export type CheckboxGroupProps = React.ComponentProps<typeof CheckboxGroupPrimitive>;

/**
 * A set of related checkboxes that share one value — an array of the names checked. Use it
 * when the options belong together and are submitted as one answer; separate Checkboxes
 * are fine when each stands alone.
 *
 * Passing `allValues` turns the first child into a parent checkbox: it reads indeterminate
 * while some children are checked, and toggles all of them at once.
 */
export function CheckboxGroup(props: CheckboxGroupProps) {
  return <CheckboxGroupPrimitive {...props} data-ui="checkbox-group" />;
}

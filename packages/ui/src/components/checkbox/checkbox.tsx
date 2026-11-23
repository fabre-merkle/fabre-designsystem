"use client";
import "./checkbox.css";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check, Minus } from "@phosphor-icons/react";
import type * as React from "react";

export type CheckboxProps = Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, "children">;

/**
 * A box that is checked, unchecked, or indeterminate — for choices that are independent of
 * each other, where any number may be on at once. Use Switch instead when the control
 * takes effect immediately rather than on submit, and RadioGroup when exactly one of
 * several options may be chosen.
 *
 * Checkbox renders the box only and takes no children, so it needs an accessible name from
 * a wrapping `<label>`, `aria-label`, or a FieldLabel via CheckboxGroup. Pass
 * `indeterminate` for the mixed state of a parent whose children are partly checked.
 */
export function Checkbox(props: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root {...props} data-ui="checkbox">
      <CheckboxPrimitive.Indicator data-ui="checkbox-indicator" keepMounted>
        <Check weight="bold" data-ui="checkbox-check" />
        <Minus weight="bold" data-ui="checkbox-minus" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

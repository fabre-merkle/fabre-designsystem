"use client";
import "./checkbox.css";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check, Minus } from "@phosphor-icons/react";
import type * as React from "react";

export type CheckboxProps = Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, "children">;

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

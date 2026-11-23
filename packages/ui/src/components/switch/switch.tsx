"use client";
import "./switch.css";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import type * as React from "react";

export type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root>;

/**
 * An on/off toggle for a setting that takes effect IMMEDIATELY — no save step. Use a
 * Checkbox instead when the value is submitted with a form, and a ToggleGroup when the
 * choice is one of several mutually exclusive options.
 *
 * Switch renders the track and thumb only and takes no children, so it needs an accessible
 * name from a wrapping `<label>`, `aria-label`, or a FieldLabel.
 */
export function Switch(props: SwitchProps) {
  return (
    <SwitchPrimitive.Root {...props} data-ui="switch">
      <SwitchPrimitive.Thumb data-ui="switch-thumb" />
    </SwitchPrimitive.Root>
  );
}

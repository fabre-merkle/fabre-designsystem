"use client";
import "./switch.css";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import type * as React from "react";

export type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root>;

export function Switch(props: SwitchProps) {
  return (
    <SwitchPrimitive.Root {...props} data-ui="switch">
      <SwitchPrimitive.Thumb data-ui="switch-thumb" />
    </SwitchPrimitive.Root>
  );
}

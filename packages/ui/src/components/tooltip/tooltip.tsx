"use client";
import "./tooltip.css";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type * as React from "react";

function Root(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props} />;
}

function Provider(props: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider {...props} />;
}

function Trigger(props: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger {...props} data-slot="tooltip-trigger" />;
}

function Portal(props: React.ComponentProps<typeof TooltipPrimitive.Portal>) {
  return <TooltipPrimitive.Portal {...props} />;
}

function Positioner(props: React.ComponentProps<typeof TooltipPrimitive.Positioner>) {
  return <TooltipPrimitive.Positioner sideOffset={8} {...props} data-slot="tooltip-positioner" />;
}

function Popup(props: React.ComponentProps<typeof TooltipPrimitive.Popup>) {
  return <TooltipPrimitive.Popup {...props} data-ui="tooltip-popup" />;
}

function Arrow(props: React.ComponentProps<typeof TooltipPrimitive.Arrow>) {
  return <TooltipPrimitive.Arrow {...props} data-ui="tooltip-arrow" />;
}

export const Tooltip = {
  Root,
  Provider,
  Trigger,
  Portal,
  Positioner,
  Popup,
  Arrow,
};

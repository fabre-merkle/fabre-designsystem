"use client";
import "./tooltip.css";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type * as React from "react";

/**
 * A short label for a control whose purpose is not obvious — almost always an icon-only
 * button. A tooltip appears on hover and on keyboard focus, but never on touch, so it can
 * only ever REPEAT information available elsewhere. Never put instructions, a form, or
 * anything interactive in one: use Popover for that.
 *
 * It labels the trigger rather than describing it, so keep it to a couple of words and do
 * not duplicate the trigger's own `aria-label`.
 *
 * Compose it: `Tooltip.Root` holds a `Tooltip.Trigger` and a `Tooltip.Portal` containing
 * `Tooltip.Positioner` > `Tooltip.Popup`. Wrap a group in `Tooltip.Provider` so moving
 * between neighbouring triggers skips the delay.
 */
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

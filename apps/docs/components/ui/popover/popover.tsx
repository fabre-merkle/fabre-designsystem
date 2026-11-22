"use client";
import "./popover.css";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type * as React from "react";
import {
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  useElevation,
} from "../elevated/surface-level";

function Root(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root {...props} />;
}

function Trigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger {...props} data-slot="popover-trigger" />;
}

function Portal(props: React.ComponentProps<typeof PopoverPrimitive.Portal>) {
  return <PopoverPrimitive.Portal {...props} />;
}

function Backdrop(props: React.ComponentProps<typeof PopoverPrimitive.Backdrop>) {
  return <PopoverPrimitive.Backdrop {...props} data-slot="popover-backdrop" />;
}

function Positioner(props: React.ComponentProps<typeof PopoverPrimitive.Positioner>) {
  return <PopoverPrimitive.Positioner sideOffset={8} {...props} data-slot="popover-positioner" />;
}

function Popup(props: React.ComponentProps<typeof PopoverPrimitive.Popup>) {
  const level = useElevation(SURFACE_OFFSET.overlay);
  return (
    <SurfaceLevel level={level}>
      <PopoverPrimitive.Popup
        {...props}
        data-ui="popover-popup"
        data-surface-level={level}
        data-shadow-level={SHADOW_LEVEL.overlay}
      />
    </SurfaceLevel>
  );
}

function Arrow(props: React.ComponentProps<typeof PopoverPrimitive.Arrow>) {
  return <PopoverPrimitive.Arrow {...props} data-ui="popover-arrow" />;
}

function Title(props: React.ComponentProps<typeof PopoverPrimitive.Title>) {
  return <PopoverPrimitive.Title {...props} data-ui="popover-title" />;
}

function Description(props: React.ComponentProps<typeof PopoverPrimitive.Description>) {
  return <PopoverPrimitive.Description {...props} data-ui="popover-description" />;
}

function Close(props: React.ComponentProps<typeof PopoverPrimitive.Close>) {
  return <PopoverPrimitive.Close {...props} data-slot="popover-close" />;
}

export const Popover = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Positioner,
  Popup,
  Arrow,
  Title,
  Description,
  Close,
};

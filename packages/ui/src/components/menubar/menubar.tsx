"use client";
import "./menubar.css";
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar";
import type * as React from "react";
import { SHADOW_LEVEL, SURFACE_OFFSET, useElevation } from "../elevated/surface-level";
import { Menu } from "../menu/menu";

// The bar is raised one level above its substrate, like a card. It does not
// provide a SurfaceLevel itself, so its menus open at substrate + 2 (above it).
function Root(props: React.ComponentProps<typeof MenubarPrimitive>) {
  const level = useElevation(SURFACE_OFFSET.bar);
  return (
    <MenubarPrimitive
      data-ui="menubar-root"
      data-surface-level={level}
      data-shadow-level={SHADOW_LEVEL.card}
      {...props}
    />
  );
}

function Trigger(props: React.ComponentProps<typeof Menu.Trigger>) {
  return <Menu.Trigger data-ui="menubar-trigger" {...props} />;
}

export const Menubar = {
  Root,
  Trigger,
};

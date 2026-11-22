"use client";
import "./drawer.css";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import * as React from "react";
import {
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  useElevation,
} from "../elevated/surface-level";

type DrawerSide = "down" | "up" | "right" | "left";

const DrawerSideContext = React.createContext<DrawerSide>("down");

type DrawerRootProps = React.ComponentProps<typeof DrawerPrimitive.Root> & {
  /**
   * Viewport edge the drawer docks to. Sets `data-side` on the popup and the
   * matching Base UI `swipeDirection` (swipe toward the edge to dismiss).
   * Takes precedence over `swipeDirection`.
   * @default "down"
   */
  side?: DrawerSide;
};

function Root({ side, swipeDirection, ...props }: DrawerRootProps) {
  const resolved: DrawerSide = side ?? swipeDirection ?? "down";
  return (
    <DrawerSideContext.Provider value={resolved}>
      <DrawerPrimitive.Root {...props} swipeDirection={resolved} />
    </DrawerSideContext.Provider>
  );
}

function Provider(props: React.ComponentProps<typeof DrawerPrimitive.Provider>) {
  return <DrawerPrimitive.Provider {...props} />;
}

function Trigger(props: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger {...props} data-slot="drawer-trigger" />;
}

function Portal(props: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal {...props} />;
}

function Backdrop(props: React.ComponentProps<typeof DrawerPrimitive.Backdrop>) {
  return <DrawerPrimitive.Backdrop {...props} data-ui="drawer-backdrop" />;
}

function Popup(props: React.ComponentProps<typeof DrawerPrimitive.Popup>) {
  const side = React.useContext(DrawerSideContext);
  const level = useElevation(SURFACE_OFFSET.dialog);
  return (
    <SurfaceLevel level={level}>
      <DrawerPrimitive.Popup
        {...props}
        data-ui="drawer-popup"
        data-surface-level={level}
        data-shadow-level={SHADOW_LEVEL.dialog}
        data-side={side}
      />
    </SurfaceLevel>
  );
}

function Viewport(props: React.ComponentProps<typeof DrawerPrimitive.Viewport>) {
  return <DrawerPrimitive.Viewport {...props} data-ui="drawer-viewport" />;
}

function Content(props: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return <DrawerPrimitive.Content {...props} data-ui="drawer-content" />;
}

function Title(props: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title {...props} data-ui="drawer-title" />;
}

function Description(props: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return <DrawerPrimitive.Description {...props} data-ui="drawer-description" />;
}

function Close(props: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close {...props} data-slot="drawer-close" />;
}

function SwipeArea(props: React.ComponentProps<typeof DrawerPrimitive.SwipeArea>) {
  return <DrawerPrimitive.SwipeArea {...props} data-ui="drawer-swipe-area" />;
}

function Indent(props: React.ComponentProps<typeof DrawerPrimitive.Indent>) {
  return <DrawerPrimitive.Indent {...props} data-ui="drawer-indent" />;
}

function IndentBackground(props: React.ComponentProps<typeof DrawerPrimitive.IndentBackground>) {
  return <DrawerPrimitive.IndentBackground {...props} data-ui="drawer-indent-background" />;
}

export const Drawer = {
  Root,
  Provider,
  Trigger,
  Portal,
  Backdrop,
  Popup,
  Viewport,
  Content,
  Title,
  Description,
  Close,
  SwipeArea,
  Indent,
  IndentBackground,
  createHandle: DrawerPrimitive.createHandle,
};

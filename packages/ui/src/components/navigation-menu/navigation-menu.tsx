"use client";
import "./navigation-menu.css";
import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import type * as React from "react";
import {
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  useElevation,
} from "../elevated/surface-level";

function Root(props: React.ComponentProps<typeof NavigationMenuPrimitive.Root>) {
  return <NavigationMenuPrimitive.Root data-ui="navigation-menu-root" {...props} />;
}

function List(props: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return <NavigationMenuPrimitive.List data-ui="navigation-menu-list" {...props} />;
}

function Item(props: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return <NavigationMenuPrimitive.Item data-ui="navigation-menu-item" {...props} />;
}

function Trigger({
  children,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return (
    <NavigationMenuPrimitive.Trigger
      data-ui="navigation-menu-trigger"
      data-slot="navigation-menu-trigger"
      {...props}
    >
      {typeof children === "string" ? (
        <span data-ui="navigation-menu-trigger-label">{children}</span>
      ) : (
        children
      )}
    </NavigationMenuPrimitive.Trigger>
  );
}

function Content(props: React.ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return <NavigationMenuPrimitive.Content data-ui="navigation-menu-content" {...props} />;
}

function Portal(props: React.ComponentProps<typeof NavigationMenuPrimitive.Portal>) {
  return <NavigationMenuPrimitive.Portal {...props} />;
}

function Positioner(props: React.ComponentProps<typeof NavigationMenuPrimitive.Positioner>) {
  return <NavigationMenuPrimitive.Positioner data-slot="navigation-menu-positioner" {...props} />;
}

function Viewport(props: React.ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
  return <NavigationMenuPrimitive.Viewport data-ui="navigation-menu-viewport" {...props} />;
}

function Backdrop(props: React.ComponentProps<typeof NavigationMenuPrimitive.Backdrop>) {
  return <NavigationMenuPrimitive.Backdrop data-ui="navigation-menu-backdrop" {...props} />;
}

function Popup(props: React.ComponentProps<typeof NavigationMenuPrimitive.Popup>) {
  const level = useElevation(SURFACE_OFFSET.overlay);
  return (
    <SurfaceLevel level={level}>
      <NavigationMenuPrimitive.Popup
        data-ui="navigation-menu-popup"
        data-surface-level={level}
        data-shadow-level={SHADOW_LEVEL.overlay}
        {...props}
      />
    </SurfaceLevel>
  );
}

function Arrow(props: React.ComponentProps<typeof NavigationMenuPrimitive.Arrow>) {
  return <NavigationMenuPrimitive.Arrow data-ui="navigation-menu-arrow" {...props} />;
}

function Link({ children, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Link>) {
  return (
    <NavigationMenuPrimitive.Link data-ui="navigation-menu-link" {...props}>
      {typeof children === "string" ? (
        <span data-ui="navigation-menu-link-label">{children}</span>
      ) : (
        children
      )}
    </NavigationMenuPrimitive.Link>
  );
}

function Icon(props: React.ComponentProps<typeof NavigationMenuPrimitive.Icon>) {
  return <NavigationMenuPrimitive.Icon data-ui="navigation-menu-icon" {...props} />;
}

export const NavigationMenu = {
  Root,
  List,
  Item,
  Trigger,
  Content,
  Portal,
  Positioner,
  Viewport,
  Backdrop,
  Popup,
  Arrow,
  Link,
  Icon,
};

"use client";
import "./context-menu.css";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { CaretRight, Check } from "@phosphor-icons/react";
import type * as React from "react";
import {
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  useElevation,
} from "../elevated/surface-level";

function Root(props: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root {...props} />;
}

function Trigger(props: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />;
}

function Portal(props: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return <ContextMenuPrimitive.Portal {...props} />;
}

function Backdrop(props: React.ComponentProps<typeof ContextMenuPrimitive.Backdrop>) {
  return <ContextMenuPrimitive.Backdrop data-ui="context-menu-backdrop" {...props} />;
}

function Positioner(props: React.ComponentProps<typeof ContextMenuPrimitive.Positioner>) {
  return <ContextMenuPrimitive.Positioner data-slot="context-menu-positioner" {...props} />;
}

function Popup(props: React.ComponentProps<typeof ContextMenuPrimitive.Popup>) {
  const level = useElevation(SURFACE_OFFSET.overlay);
  return (
    <SurfaceLevel level={level}>
      <ContextMenuPrimitive.Popup
        data-ui="context-menu-popup"
        data-surface-level={level}
        data-shadow-level={SHADOW_LEVEL.overlay}
        {...props}
      />
    </SurfaceLevel>
  );
}

function Arrow(props: React.ComponentProps<typeof ContextMenuPrimitive.Arrow>) {
  return <ContextMenuPrimitive.Arrow data-ui="context-menu-arrow" {...props} />;
}

function Item(props: React.ComponentProps<typeof ContextMenuPrimitive.Item>) {
  return <ContextMenuPrimitive.Item data-ui="context-menu-item" {...props} />;
}

function LinkItem(props: React.ComponentProps<typeof ContextMenuPrimitive.LinkItem>) {
  return <ContextMenuPrimitive.LinkItem data-ui="context-menu-item" {...props} />;
}

function Group(props: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return <ContextMenuPrimitive.Group data-ui="context-menu-group" {...props} />;
}

function GroupLabel(props: React.ComponentProps<typeof ContextMenuPrimitive.GroupLabel>) {
  return <ContextMenuPrimitive.GroupLabel data-ui="context-menu-group-label" {...props} />;
}

function RadioGroup(props: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {
  return <ContextMenuPrimitive.RadioGroup data-ui="context-menu-radio-group" {...props} />;
}

function RadioItem(props: React.ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return <ContextMenuPrimitive.RadioItem data-ui="context-menu-radio-item" {...props} />;
}

function RadioItemIndicator(
  props: React.ComponentProps<typeof ContextMenuPrimitive.RadioItemIndicator>,
) {
  return (
    <ContextMenuPrimitive.RadioItemIndicator
      data-ui="context-menu-radio-item-indicator"
      {...props}
    />
  );
}

function CheckboxItem(props: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return <ContextMenuPrimitive.CheckboxItem data-ui="context-menu-checkbox-item" {...props} />;
}

function CheckboxItemIndicator({
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItemIndicator>) {
  return (
    <ContextMenuPrimitive.CheckboxItemIndicator
      data-ui="context-menu-checkbox-item-indicator"
      {...props}
    >
      {children ?? <Check weight="bold" />}
    </ContextMenuPrimitive.CheckboxItemIndicator>
  );
}

function Separator(props: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return <ContextMenuPrimitive.Separator data-ui="context-menu-separator" {...props} />;
}

function SubmenuRoot(props: React.ComponentProps<typeof ContextMenuPrimitive.SubmenuRoot>) {
  return <ContextMenuPrimitive.SubmenuRoot {...props} />;
}

function SubmenuTrigger({
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubmenuTrigger>) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      data-ui="context-menu-item"
      data-submenu-trigger=""
      {...props}
    >
      {children}
      <span data-ui="context-menu-submenu-icon" aria-hidden="true">
        <CaretRight />
      </span>
    </ContextMenuPrimitive.SubmenuTrigger>
  );
}

export const ContextMenu = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Positioner,
  Popup,
  Arrow,
  Item,
  LinkItem,
  Group,
  GroupLabel,
  RadioGroup,
  RadioItem,
  RadioItemIndicator,
  CheckboxItem,
  CheckboxItemIndicator,
  Separator,
  SubmenuRoot,
  SubmenuTrigger,
};

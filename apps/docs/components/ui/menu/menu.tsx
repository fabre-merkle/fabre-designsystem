"use client";
import "./menu.css";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { CaretRight, Check } from "@phosphor-icons/react";
import type * as React from "react";
import {
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  useElevation,
} from "../elevated/surface-level";

function Root(props: React.ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root {...props} />;
}

function Trigger(props: React.ComponentProps<typeof MenuPrimitive.Trigger>) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />;
}

function Portal(props: React.ComponentProps<typeof MenuPrimitive.Portal>) {
  return <MenuPrimitive.Portal {...props} />;
}

function Backdrop(props: React.ComponentProps<typeof MenuPrimitive.Backdrop>) {
  return <MenuPrimitive.Backdrop data-ui="menu-backdrop" {...props} />;
}

function Positioner(props: React.ComponentProps<typeof MenuPrimitive.Positioner>) {
  return <MenuPrimitive.Positioner data-slot="menu-positioner" {...props} />;
}

function Popup(props: React.ComponentProps<typeof MenuPrimitive.Popup>) {
  const level = useElevation(SURFACE_OFFSET.overlay);
  return (
    <SurfaceLevel level={level}>
      <MenuPrimitive.Popup
        data-ui="menu-popup"
        data-surface-level={level}
        data-shadow-level={SHADOW_LEVEL.overlay}
        {...props}
      />
    </SurfaceLevel>
  );
}

function Arrow(props: React.ComponentProps<typeof MenuPrimitive.Arrow>) {
  return <MenuPrimitive.Arrow data-ui="menu-arrow" {...props} />;
}

function Item(props: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return <MenuPrimitive.Item data-ui="menu-item" {...props} />;
}

function LinkItem(props: React.ComponentProps<typeof MenuPrimitive.LinkItem>) {
  return <MenuPrimitive.LinkItem data-ui="menu-item" {...props} />;
}

function Group(props: React.ComponentProps<typeof MenuPrimitive.Group>) {
  return <MenuPrimitive.Group data-ui="menu-group" {...props} />;
}

function GroupLabel(props: React.ComponentProps<typeof MenuPrimitive.GroupLabel>) {
  return <MenuPrimitive.GroupLabel data-ui="menu-group-label" {...props} />;
}

function RadioGroup(props: React.ComponentProps<typeof MenuPrimitive.RadioGroup>) {
  return <MenuPrimitive.RadioGroup data-ui="menu-radio-group" {...props} />;
}

function RadioItem(props: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return <MenuPrimitive.RadioItem data-ui="menu-radio-item" {...props} />;
}

function RadioItemIndicator(props: React.ComponentProps<typeof MenuPrimitive.RadioItemIndicator>) {
  return <MenuPrimitive.RadioItemIndicator data-ui="menu-radio-item-indicator" {...props} />;
}

function CheckboxItem(props: React.ComponentProps<typeof MenuPrimitive.CheckboxItem>) {
  return <MenuPrimitive.CheckboxItem data-ui="menu-checkbox-item" {...props} />;
}

function CheckboxItemIndicator({
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.CheckboxItemIndicator>) {
  return (
    <MenuPrimitive.CheckboxItemIndicator data-ui="menu-checkbox-item-indicator" {...props}>
      {children ?? <Check weight="bold" />}
    </MenuPrimitive.CheckboxItemIndicator>
  );
}

function Separator(props: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator data-ui="menu-separator" {...props} />;
}

function SubmenuRoot(props: React.ComponentProps<typeof MenuPrimitive.SubmenuRoot>) {
  return <MenuPrimitive.SubmenuRoot {...props} />;
}

function SubmenuTrigger({
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubmenuTrigger>) {
  return (
    <MenuPrimitive.SubmenuTrigger data-ui="menu-item" data-submenu-trigger="" {...props}>
      {children}
      <span data-ui="menu-submenu-icon" aria-hidden="true">
        <CaretRight />
      </span>
    </MenuPrimitive.SubmenuTrigger>
  );
}

export const Menu = {
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
  createHandle: MenuPrimitive.createHandle,
};

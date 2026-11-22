"use client";
import "./combobox.css";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import type * as React from "react";
import {
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  useElevation,
} from "../elevated/surface-level";

// Generic so `items`, `value` and `onValueChange` keep the item type, including
// collections from `createItems`.
function Root<Value, Multiple extends boolean | undefined = false, Item = Value>(
  props: ComboboxPrimitive.Root.Props<Value, Multiple, Item>,
) {
  return <ComboboxPrimitive.Root {...props} />;
}

function Label(props: React.ComponentProps<typeof ComboboxPrimitive.Label>) {
  return <ComboboxPrimitive.Label {...props} data-ui="combobox-label" />;
}

function Value(props: React.ComponentProps<typeof ComboboxPrimitive.Value>) {
  return <ComboboxPrimitive.Value {...props} />;
}

function Input(props: React.ComponentProps<typeof ComboboxPrimitive.Input>) {
  return <ComboboxPrimitive.Input {...props} data-ui="combobox-input" />;
}

function InputGroup(props: React.ComponentProps<typeof ComboboxPrimitive.InputGroup>) {
  return <ComboboxPrimitive.InputGroup {...props} data-ui="combobox-input-group" />;
}

function Trigger(props: React.ComponentProps<typeof ComboboxPrimitive.Trigger>) {
  return (
    <ComboboxPrimitive.Trigger {...props} data-ui="combobox-trigger" data-slot="combobox-trigger" />
  );
}

function List(props: React.ComponentProps<typeof ComboboxPrimitive.List>) {
  return <ComboboxPrimitive.List {...props} data-ui="combobox-list" />;
}

function Status(props: React.ComponentProps<typeof ComboboxPrimitive.Status>) {
  return <ComboboxPrimitive.Status {...props} data-ui="combobox-status" />;
}

function Portal(props: React.ComponentProps<typeof ComboboxPrimitive.Portal>) {
  return <ComboboxPrimitive.Portal {...props} />;
}

function Backdrop(props: React.ComponentProps<typeof ComboboxPrimitive.Backdrop>) {
  return <ComboboxPrimitive.Backdrop {...props} data-ui="combobox-backdrop" />;
}

function Positioner(props: React.ComponentProps<typeof ComboboxPrimitive.Positioner>) {
  return <ComboboxPrimitive.Positioner {...props} data-slot="combobox-positioner" />;
}

function Popup(props: React.ComponentProps<typeof ComboboxPrimitive.Popup>) {
  const level = useElevation(SURFACE_OFFSET.overlay);
  return (
    <SurfaceLevel level={level}>
      <ComboboxPrimitive.Popup
        {...props}
        data-ui="combobox-popup"
        data-surface-level={level}
        data-shadow-level={SHADOW_LEVEL.overlay}
      />
    </SurfaceLevel>
  );
}

function Arrow(props: React.ComponentProps<typeof ComboboxPrimitive.Arrow>) {
  return <ComboboxPrimitive.Arrow {...props} data-ui="combobox-arrow" />;
}

function Icon(props: React.ComponentProps<typeof ComboboxPrimitive.Icon>) {
  return <ComboboxPrimitive.Icon {...props} data-ui="combobox-icon" />;
}

function Group(props: React.ComponentProps<typeof ComboboxPrimitive.Group>) {
  return <ComboboxPrimitive.Group {...props} data-ui="combobox-group" />;
}

function GroupLabel(props: React.ComponentProps<typeof ComboboxPrimitive.GroupLabel>) {
  return <ComboboxPrimitive.GroupLabel {...props} data-ui="combobox-group-label" />;
}

function Item(props: React.ComponentProps<typeof ComboboxPrimitive.Item>) {
  return <ComboboxPrimitive.Item {...props} data-ui="combobox-item" />;
}

function ItemIndicator(props: React.ComponentProps<typeof ComboboxPrimitive.ItemIndicator>) {
  return <ComboboxPrimitive.ItemIndicator {...props} data-ui="combobox-item-indicator" />;
}

function Chips(props: React.ComponentProps<typeof ComboboxPrimitive.Chips>) {
  return <ComboboxPrimitive.Chips {...props} data-ui="combobox-chips" />;
}

function Chip(props: React.ComponentProps<typeof ComboboxPrimitive.Chip>) {
  return <ComboboxPrimitive.Chip {...props} data-ui="combobox-chip" />;
}

function ChipRemove(props: React.ComponentProps<typeof ComboboxPrimitive.ChipRemove>) {
  return <ComboboxPrimitive.ChipRemove {...props} data-ui="combobox-chip-remove" />;
}

function Row(props: React.ComponentProps<typeof ComboboxPrimitive.Row>) {
  return <ComboboxPrimitive.Row {...props} data-ui="combobox-row" />;
}

function Collection(props: React.ComponentProps<typeof ComboboxPrimitive.Collection>) {
  return <ComboboxPrimitive.Collection {...props} />;
}

function Empty(props: React.ComponentProps<typeof ComboboxPrimitive.Empty>) {
  return <ComboboxPrimitive.Empty {...props} data-ui="combobox-empty" />;
}

function Clear(props: React.ComponentProps<typeof ComboboxPrimitive.Clear>) {
  return <ComboboxPrimitive.Clear {...props} data-ui="combobox-clear" />;
}

function Separator(props: React.ComponentProps<typeof ComboboxPrimitive.Separator>) {
  return <ComboboxPrimitive.Separator {...props} data-ui="combobox-separator" />;
}

export const Combobox = {
  /** Builds the `items` collection for `Combobox.Root` from your own records. */
  createItems: ComboboxPrimitive.createItems,
  Root,
  Label,
  Value,
  Input,
  InputGroup,
  Trigger,
  List,
  Status,
  Portal,
  Backdrop,
  Positioner,
  Popup,
  Arrow,
  Icon,
  Group,
  GroupLabel,
  Item,
  ItemIndicator,
  Chips,
  Chip,
  ChipRemove,
  Row,
  Collection,
  Empty,
  Clear,
  Separator,
};

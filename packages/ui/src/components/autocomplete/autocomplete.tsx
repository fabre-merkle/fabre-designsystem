"use client";
import "./autocomplete.css";
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import type * as React from "react";
import {
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  useElevation,
} from "../elevated/surface-level";

function Root(props: React.ComponentProps<typeof AutocompletePrimitive.Root>) {
  return <AutocompletePrimitive.Root {...props} />;
}

function Value(props: React.ComponentProps<typeof AutocompletePrimitive.Value>) {
  return <AutocompletePrimitive.Value {...props} />;
}

function Trigger(props: React.ComponentProps<typeof AutocompletePrimitive.Trigger>) {
  return (
    <AutocompletePrimitive.Trigger
      data-ui="autocomplete-trigger"
      data-slot="autocomplete-trigger"
      {...props}
    />
  );
}

function Input(props: React.ComponentProps<typeof AutocompletePrimitive.Input>) {
  return <AutocompletePrimitive.Input data-ui="autocomplete-input" {...props} />;
}

function InputGroup(props: React.ComponentProps<typeof AutocompletePrimitive.InputGroup>) {
  return <AutocompletePrimitive.InputGroup data-ui="autocomplete-input-group" {...props} />;
}

function Icon(props: React.ComponentProps<typeof AutocompletePrimitive.Icon>) {
  return <AutocompletePrimitive.Icon data-ui="autocomplete-icon" {...props} />;
}

function Clear(props: React.ComponentProps<typeof AutocompletePrimitive.Clear>) {
  return <AutocompletePrimitive.Clear data-ui="autocomplete-clear" {...props} />;
}

function List(props: React.ComponentProps<typeof AutocompletePrimitive.List>) {
  return <AutocompletePrimitive.List data-ui="autocomplete-list" {...props} />;
}

function Status(props: React.ComponentProps<typeof AutocompletePrimitive.Status>) {
  return <AutocompletePrimitive.Status data-ui="autocomplete-status" {...props} />;
}

function Portal(props: React.ComponentProps<typeof AutocompletePrimitive.Portal>) {
  return <AutocompletePrimitive.Portal {...props} />;
}

function Backdrop(props: React.ComponentProps<typeof AutocompletePrimitive.Backdrop>) {
  return <AutocompletePrimitive.Backdrop data-ui="autocomplete-backdrop" {...props} />;
}

function Positioner(props: React.ComponentProps<typeof AutocompletePrimitive.Positioner>) {
  return <AutocompletePrimitive.Positioner data-slot="autocomplete-positioner" {...props} />;
}

function Popup(props: React.ComponentProps<typeof AutocompletePrimitive.Popup>) {
  const level = useElevation(SURFACE_OFFSET.overlay);
  return (
    <SurfaceLevel level={level}>
      <AutocompletePrimitive.Popup
        data-ui="autocomplete-popup"
        data-surface-level={level}
        data-shadow-level={SHADOW_LEVEL.overlay}
        {...props}
      />
    </SurfaceLevel>
  );
}

function Arrow(props: React.ComponentProps<typeof AutocompletePrimitive.Arrow>) {
  return <AutocompletePrimitive.Arrow data-ui="autocomplete-arrow" {...props} />;
}

function Group(props: React.ComponentProps<typeof AutocompletePrimitive.Group>) {
  return <AutocompletePrimitive.Group data-ui="autocomplete-group" {...props} />;
}

function GroupLabel(props: React.ComponentProps<typeof AutocompletePrimitive.GroupLabel>) {
  return <AutocompletePrimitive.GroupLabel data-ui="autocomplete-group-label" {...props} />;
}

function Item(props: React.ComponentProps<typeof AutocompletePrimitive.Item>) {
  return <AutocompletePrimitive.Item data-ui="autocomplete-item" {...props} />;
}

function Row(props: React.ComponentProps<typeof AutocompletePrimitive.Row>) {
  return <AutocompletePrimitive.Row data-ui="autocomplete-row" {...props} />;
}

function Collection(props: React.ComponentProps<typeof AutocompletePrimitive.Collection>) {
  return <AutocompletePrimitive.Collection {...props} />;
}

function Empty(props: React.ComponentProps<typeof AutocompletePrimitive.Empty>) {
  return <AutocompletePrimitive.Empty data-ui="autocomplete-empty" {...props} />;
}

function Separator(props: React.ComponentProps<typeof AutocompletePrimitive.Separator>) {
  return <AutocompletePrimitive.Separator data-ui="autocomplete-separator" {...props} />;
}

export const Autocomplete = {
  Root,
  Value,
  Trigger,
  Input,
  InputGroup,
  Icon,
  Clear,
  List,
  Status,
  Portal,
  Backdrop,
  Positioner,
  Popup,
  Arrow,
  Group,
  GroupLabel,
  Item,
  Row,
  Collection,
  Empty,
  Separator,
};

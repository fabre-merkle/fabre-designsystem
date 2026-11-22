"use client";
import "./collapsible.css";
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import type * as React from "react";

function Root(props: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root {...props} data-ui="collapsible-root" />;
}

function Trigger(props: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return <CollapsiblePrimitive.Trigger {...props} data-slot="collapsible-trigger" />;
}

function Panel(props: React.ComponentProps<typeof CollapsiblePrimitive.Panel>) {
  return <CollapsiblePrimitive.Panel {...props} data-ui="collapsible-panel" />;
}

export const Collapsible = {
  Root,
  Trigger,
  Panel,
};

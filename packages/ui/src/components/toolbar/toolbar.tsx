"use client";
import "../control/control.css";
import "./toolbar.css";
import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";
import type * as React from "react";

function Root(props: React.ComponentProps<typeof ToolbarPrimitive.Root>) {
  return <ToolbarPrimitive.Root {...props} data-ui="toolbar-root" />;
}

function Group(props: React.ComponentProps<typeof ToolbarPrimitive.Group>) {
  return <ToolbarPrimitive.Group {...props} data-ui="toolbar-group" />;
}

function Button({ children, ...props }: React.ComponentProps<typeof ToolbarPrimitive.Button>) {
  return (
    <ToolbarPrimitive.Button {...props} data-ui="toolbar-button" data-slot="toolbar-button">
      {typeof children === "string" ? (
        <span data-ui="toolbar-button-label">{children}</span>
      ) : (
        children
      )}
    </ToolbarPrimitive.Button>
  );
}

function Link({ children, ...props }: React.ComponentProps<typeof ToolbarPrimitive.Link>) {
  return (
    <ToolbarPrimitive.Link {...props} data-ui="toolbar-link">
      {typeof children === "string" ? (
        <span data-ui="toolbar-link-label">{children}</span>
      ) : (
        children
      )}
    </ToolbarPrimitive.Link>
  );
}

function Input(props: React.ComponentProps<typeof ToolbarPrimitive.Input>) {
  return <ToolbarPrimitive.Input {...props} data-ui="toolbar-input" />;
}

function Separator(props: React.ComponentProps<typeof ToolbarPrimitive.Separator>) {
  return <ToolbarPrimitive.Separator {...props} data-ui="toolbar-separator" />;
}

export const Toolbar = {
  Root,
  Group,
  Button,
  Link,
  Input,
  Separator,
};

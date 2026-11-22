"use client";
import "./alert-dialog.css";
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";
import {
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  useElevation,
} from "../elevated/surface-level";

/** Owns the open state of the alert dialog. */
function Root(props: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root {...props} />;
}

/** The button that opens the alert dialog. */
function Trigger(props: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger {...props} data-slot="alert-dialog-trigger" />;
}

/** Renders the alert dialog outside its parent in the document. */
function Portal(props: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal {...props} />;
}

/** The overlay behind the alert dialog. */
function Backdrop(props: React.ComponentProps<typeof AlertDialogPrimitive.Backdrop>) {
  return <AlertDialogPrimitive.Backdrop {...props} data-ui="alert-dialog-backdrop" />;
}

/** The alert dialog surface, raised to the dialog elevation level. */
function Popup(props: React.ComponentProps<typeof AlertDialogPrimitive.Popup>) {
  const level = useElevation(SURFACE_OFFSET.dialog);
  return (
    <SurfaceLevel level={level}>
      <AlertDialogPrimitive.Popup
        {...props}
        data-ui="alert-dialog-popup"
        data-surface-level={level}
        data-shadow-level={SHADOW_LEVEL.dialog}
      />
    </SurfaceLevel>
  );
}

/** The accessible title of the alert dialog. */
function Title(props: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title {...props} data-ui="alert-dialog-title" />;
}

/** The accessible description of the alert dialog. */
function Description(props: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description {...props} data-ui="alert-dialog-description" />;
}

/**
 * Groups the title and description into one block. Optional: without it they are
 * direct children of the popup. A plain `div`, since Base UI has no header
 * primitive.
 */
function Header({ render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      { "data-ui": "alert-dialog-header" } as React.ComponentProps<"div">,
      props,
    ),
  });
}

/**
 * Holds the actions, usually AlertDialog.Close buttons, in a row aligned to the end.
 * Put the primary action last: below the small breakpoint the row stacks in
 * reverse order, so the last action sits on top. A plain `div`, since Base UI
 * has no footer primitive.
 */
function Footer({ render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      { "data-ui": "alert-dialog-footer" } as React.ComponentProps<"div">,
      props,
    ),
  });
}

/** A button that closes the alert dialog. */
function Close(props: React.ComponentProps<typeof AlertDialogPrimitive.Close>) {
  return <AlertDialogPrimitive.Close {...props} data-slot="alert-dialog-close" />;
}

export const AlertDialog = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Popup,
  Title,
  Description,
  Header,
  Footer,
  Close,
};

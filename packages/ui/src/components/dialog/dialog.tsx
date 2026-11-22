"use client";
import "./dialog.css";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";
import {
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  useElevation,
} from "../elevated/surface-level";

/** Owns the open state of the dialog. */
function Root(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

/** The button that opens the dialog. */
function Trigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger {...props} data-slot="dialog-trigger" />;
}

/** Renders the dialog outside its parent in the document. */
function Portal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal {...props} />;
}

/** The overlay behind the dialog. */
function Backdrop(props: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return <DialogPrimitive.Backdrop {...props} data-ui="dialog-backdrop" />;
}

/** The dialog surface, raised to the dialog elevation level. */
function Popup(props: React.ComponentProps<typeof DialogPrimitive.Popup>) {
  const level = useElevation(SURFACE_OFFSET.dialog);
  return (
    <SurfaceLevel level={level}>
      <DialogPrimitive.Popup
        {...props}
        data-ui="dialog-popup"
        data-surface-level={level}
        data-shadow-level={SHADOW_LEVEL.dialog}
      />
    </SurfaceLevel>
  );
}

/** The accessible title of the dialog. */
function Title(props: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title {...props} data-ui="dialog-title" />;
}

/** The accessible description of the dialog. */
function Description(props: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description {...props} data-ui="dialog-description" />;
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
    props: mergeProps<"div">({ "data-ui": "dialog-header" } as React.ComponentProps<"div">, props),
  });
}

/**
 * Holds the actions, usually Dialog.Close buttons, in a row aligned to the end.
 * Put the primary action last: below the small breakpoint the row stacks in
 * reverse order, so the last action sits on top. A plain `div`, since Base UI
 * has no footer primitive.
 */
function Footer({ render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">({ "data-ui": "dialog-footer" } as React.ComponentProps<"div">, props),
  });
}

/** A button that closes the dialog. */
function Close(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close {...props} data-slot="dialog-close" />;
}

export const Dialog = {
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

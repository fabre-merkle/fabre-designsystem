"use client";
import "./toast.css";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import type * as React from "react";
import {
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  useElevation,
} from "../elevated/surface-level";

function Provider(props: React.ComponentProps<typeof ToastPrimitive.Provider>) {
  return <ToastPrimitive.Provider {...props} />;
}

function Viewport(props: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return <ToastPrimitive.Viewport {...props} data-ui="toast-viewport" />;
}

function Portal(props: React.ComponentProps<typeof ToastPrimitive.Portal>) {
  return <ToastPrimitive.Portal {...props} />;
}

function Positioner(props: React.ComponentProps<typeof ToastPrimitive.Positioner>) {
  return <ToastPrimitive.Positioner {...props} data-slot="toast-positioner" />;
}

function Root(props: React.ComponentProps<typeof ToastPrimitive.Root>) {
  const level = useElevation(SURFACE_OFFSET.dialog);
  return (
    <SurfaceLevel level={level}>
      <ToastPrimitive.Root
        {...props}
        data-ui="toast-root"
        data-surface-level={level}
        data-shadow-level={SHADOW_LEVEL.toast}
      />
    </SurfaceLevel>
  );
}

function Content(props: React.ComponentProps<typeof ToastPrimitive.Content>) {
  return <ToastPrimitive.Content {...props} data-ui="toast-content" />;
}

function Title(props: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return <ToastPrimitive.Title {...props} data-ui="toast-title" />;
}

function Description(props: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return <ToastPrimitive.Description {...props} data-ui="toast-description" />;
}

function Action(props: React.ComponentProps<typeof ToastPrimitive.Action>) {
  return <ToastPrimitive.Action {...props} data-slot="toast-action" />;
}

function Close(props: React.ComponentProps<typeof ToastPrimitive.Close>) {
  return <ToastPrimitive.Close {...props} data-slot="toast-close" />;
}

function Arrow(props: React.ComponentProps<typeof ToastPrimitive.Arrow>) {
  return <ToastPrimitive.Arrow {...props} data-ui="toast-arrow" />;
}

export const Toast = {
  Provider,
  Viewport,
  Portal,
  Positioner,
  Root,
  Content,
  Title,
  Description,
  Action,
  Close,
  Arrow,
  useToastManager: ToastPrimitive.useToastManager,
  createToastManager: ToastPrimitive.createToastManager,
};

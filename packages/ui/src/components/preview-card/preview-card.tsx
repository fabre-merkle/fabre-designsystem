"use client";
import "./preview-card.css";
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import type * as React from "react";
import {
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  useElevation,
} from "../elevated/surface-level";

function Root(props: React.ComponentProps<typeof PreviewCardPrimitive.Root>) {
  return <PreviewCardPrimitive.Root {...props} />;
}

function Trigger(props: React.ComponentProps<typeof PreviewCardPrimitive.Trigger>) {
  return <PreviewCardPrimitive.Trigger {...props} data-slot="preview-card-trigger" />;
}

function Portal(props: React.ComponentProps<typeof PreviewCardPrimitive.Portal>) {
  return <PreviewCardPrimitive.Portal {...props} />;
}

function Backdrop(props: React.ComponentProps<typeof PreviewCardPrimitive.Backdrop>) {
  return <PreviewCardPrimitive.Backdrop {...props} data-slot="preview-card-backdrop" />;
}

function Positioner(props: React.ComponentProps<typeof PreviewCardPrimitive.Positioner>) {
  return (
    <PreviewCardPrimitive.Positioner
      sideOffset={8}
      {...props}
      data-slot="preview-card-positioner"
    />
  );
}

function Popup(props: React.ComponentProps<typeof PreviewCardPrimitive.Popup>) {
  const level = useElevation(SURFACE_OFFSET.overlay);
  return (
    <SurfaceLevel level={level}>
      <PreviewCardPrimitive.Popup
        {...props}
        data-ui="preview-card-popup"
        data-surface-level={level}
        data-shadow-level={SHADOW_LEVEL.overlay}
      />
    </SurfaceLevel>
  );
}

function Arrow(props: React.ComponentProps<typeof PreviewCardPrimitive.Arrow>) {
  return <PreviewCardPrimitive.Arrow {...props} data-ui="preview-card-arrow" />;
}

export const PreviewCard = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Positioner,
  Popup,
  Arrow,
};

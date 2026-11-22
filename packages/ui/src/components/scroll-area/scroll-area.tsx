"use client";
import "./scroll-area.css";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type React from "react";

function Root(props: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return <ScrollAreaPrimitive.Root data-ui="scroll-area-root" {...props} />;
}

function Viewport(props: React.ComponentProps<typeof ScrollAreaPrimitive.Viewport>) {
  return <ScrollAreaPrimitive.Viewport data-ui="scroll-area-viewport" {...props} />;
}

function Content(props: React.ComponentProps<typeof ScrollAreaPrimitive.Content>) {
  return <ScrollAreaPrimitive.Content data-ui="scroll-area-content" {...props} />;
}

function Scrollbar({
  orientation = "vertical",
  ...rest
}: React.ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-ui="scroll-area-scrollbar"
      orientation={orientation}
      {...rest}
    />
  );
}

function Thumb(props: React.ComponentProps<typeof ScrollAreaPrimitive.Thumb>) {
  return <ScrollAreaPrimitive.Thumb data-ui="scroll-area-thumb" {...props} />;
}

function Corner(props: React.ComponentProps<typeof ScrollAreaPrimitive.Corner>) {
  return <ScrollAreaPrimitive.Corner data-ui="scroll-area-corner" {...props} />;
}

export const ScrollArea = {
  Root,
  Viewport,
  Content,
  Scrollbar,
  Thumb,
  Corner,
};

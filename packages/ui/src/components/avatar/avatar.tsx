"use client";
import "./avatar.css";
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import React from "react";

type AvatarSize = "sm" | "md" | "lg";
type AvatarShape = "circle" | "square";

interface AvatarContextValue {
  size: AvatarSize;
  shape: AvatarShape;
}

const AvatarContext = React.createContext<AvatarContextValue>({
  size: "md",
  shape: "circle",
});

export interface AvatarProps extends React.ComponentProps<typeof AvatarPrimitive.Root> {
  /**
   * Diameter: `sm` 24px, `md` 32px, `lg` 40px. Passed to the fallback through context.
   * @default "md"
   */
  size?: AvatarSize;
  /**
   * Corner treatment: pill-round or soft-cornered square.
   * @default "circle"
   */
  shape?: AvatarShape;
}

function Root({ size = "md", shape = "circle", ...rest }: AvatarProps) {
  // Memoise the context value so Fallback (the only consumer) doesn't
  // re-render on every parent render — only when size or shape change.
  const value = React.useMemo<AvatarContextValue>(() => ({ size, shape }), [size, shape]);
  return (
    <AvatarContext.Provider value={value}>
      <AvatarPrimitive.Root {...rest} data-ui="avatar" data-size={size} data-shape={shape} />
    </AvatarContext.Provider>
  );
}

function Image(props: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image {...props} data-ui="avatar-image" />;
}

function Fallback(props: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  const { size } = React.useContext(AvatarContext);
  return <AvatarPrimitive.Fallback {...props} data-ui="avatar-fallback" data-size={size} />;
}

export const Avatar = {
  Root,
  Image,
  Fallback,
};

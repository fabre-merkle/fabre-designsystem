"use client";
import "../control/control.css";
import "./toggle-group.css";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import React from "react";
import { ToggleGroupContext } from "../toggle/toggle";

type ToggleVariant = "primary" | "ghost";
type ToggleSize = "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon" | "icon-lg";
type ToggleGroupSpacing = "joined" | "gapped";

export interface ToggleGroupProps<Value extends string = string>
  extends ToggleGroupPrimitive.Props<Value> {
  /**
   * Visual treatment cascaded to child toggles.
   * @default "primary"
   */
  variant?: ToggleVariant;
  /**
   * Control size cascaded to child toggles, the `icon-*` sizes included (every item
   * becomes a square icon-only toggle and needs an accessible name).
   * @default "md"
   */
  size?: ToggleSize;
  /**
   * Picks the default `spacing`: `true` is `joined`, `false` is `gapped`.
   * The track follows `spacing`, not this prop.
   * @default true
   */
  grouped?: boolean;
  /**
   * How items sit next to each other. `joined` (no gap) always draws the segmented
   * track; `gapped` never does. Falls back to `joined` when `grouped`, else `gapped`.
   */
  spacing?: ToggleGroupSpacing;
}

/**
 * A set of toggles that share a variant and size, joined into a segmented track or spaced apart.
 */
export function ToggleGroup<Value extends string = string>({
  variant = "primary",
  size = "md",
  grouped = true,
  spacing,
  children,
  ...rest
}: ToggleGroupProps<Value>) {
  const resolvedSpacing = spacing ?? (grouped ? "joined" : "gapped");
  const contextValue = React.useMemo(() => ({ variant, size }), [variant, size]);

  return (
    <ToggleGroupContext.Provider value={contextValue}>
      <ToggleGroupPrimitive
        {...rest}
        data-ui="toggle-group"
        data-variant={variant}
        data-size={size}
        // `data-grouped` marks the segmented track: joined groups always have it, gapped never.
        data-grouped={resolvedSpacing === "joined" || undefined}
        data-spacing={resolvedSpacing}
      >
        {children}
      </ToggleGroupPrimitive>
    </ToggleGroupContext.Provider>
  );
}

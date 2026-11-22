"use client";
import "../control/control.css";
import "./toggle.css";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import React from "react";
import {
  hasAriaName,
  hasLeadingText,
  hasTextContent,
  iconSideOf,
  isIconChild,
  markIconChildren,
} from "../control/icon-only";

declare const process: { env: { NODE_ENV?: string } };

type ToggleVariant = "primary" | "ghost";
type ToggleSize = "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon" | "icon-lg";

interface ToggleGroupContextValue {
  variant: ToggleVariant;
  size: ToggleSize;
}

export const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null);

export interface ToggleProps<Value extends string = string> extends TogglePrimitive.Props<Value> {
  /**
   * Visual treatment when pressed. Inherited from the enclosing toggle group
   * when present.
   * @default "primary"
   */
  variant?: ToggleVariant;
  /**
   * Control size. Inherited from the enclosing toggle group when present. The
   * `icon-*` sizes make a square icon-only toggle at the matching height
   * (`icon-xs` = `xs`, `icon-sm` = `sm`, `icon` = `md`, `icon-lg` = `lg`) and need
   * an accessible name (`aria-label`, `aria-labelledby` or visually hidden text).
   * @default "md"
   */
  size?: ToggleSize;
}

/**
 * A two-state button that is pressed or not. Inherits variant and size from an enclosing toggle
 * group; an icon-only toggle needs an accessible name.
 */
export function Toggle<Value extends string = string>({
  variant,
  size,
  children,
  ...rest
}: ToggleProps<Value>) {
  const group = React.useContext(ToggleGroupContext);
  const resolvedVariant = variant ?? group?.variant ?? "primary";
  const resolvedSize = size ?? group?.size ?? "md";
  const hasText = hasTextContent(children);
  const hasIcon = React.Children.toArray(children).some(isIconChild);
  const isIconOnly = resolvedSize.startsWith("icon") || (hasIcon && !hasText);

  if (process.env.NODE_ENV === "development" && isIconOnly && !hasText && !hasAriaName(rest)) {
    throw new Error(
      'Toggle: an icon-only toggle (size="icon*" or an icon without text) requires aria-label, aria-labelledby or visually hidden text for an accessible name.',
    );
  }

  const hasChildren = children !== null && children !== undefined && children !== false;

  return (
    <TogglePrimitive
      {...rest}
      data-ui="toggle"
      data-variant={resolvedVariant}
      data-size={resolvedSize}
      data-has-icon={hasIcon ? "" : undefined}
      data-icon-only={isIconOnly ? "" : undefined}
      data-icon-side={isIconOnly ? undefined : iconSideOf(children)}
    >
      {hasChildren && (
        <span
          data-ui="toggle-label"
          data-has-text={hasText || undefined}
          data-leading-text={hasLeadingText(children) || undefined}
        >
          {markIconChildren(children, { "data-ui": "toggle-icon" })}
        </span>
      )}
    </TogglePrimitive>
  );
}

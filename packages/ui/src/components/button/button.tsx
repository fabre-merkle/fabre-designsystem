"use client";
import "../control/control.css";
import "./button.css";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
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

type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive" | "inverse";
type ButtonMode = "filled" | "stroke" | "lighter" | "ghost";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon" | "icon-lg";

export type ButtonProps = React.ComponentProps<typeof ButtonPrimitive> &
  Partial<{
    /**
     * Semantic colour role.
     * @default "primary"
     */
    variant: ButtonVariant;
    /**
     * Visual treatment: solid fill, family surface with border, tinted, or
     * transparent with a family wash.
     * @default "filled"
     */
    mode: ButtonMode;
    /**
     * Control size: height, padding, gap, icon and text. The `icon-*` sizes make
     * a square icon-only control at the matching height (`icon-xs` = `xs`,
     * `icon-sm` = `sm`, `icon` = `md`, `icon-lg` = `lg`) and need an accessible
     * name (`aria-label`, `aria-labelledby` or visually hidden text).
     * @default "md"
     */
    size: ButtonSize;
  }>;

/**
 * A button with a semantic colour role, a visual mode and a size. Icon-only sizes need an
 * accessible name.
 */
export function Button({
  variant = "primary",
  mode = "filled",
  size = "md",
  children,
  ...rest
}: ButtonProps) {
  const hasChildren = children !== null && children !== undefined && children !== false;
  const isIconOnly = size.startsWith("icon");
  const hasIcon = React.Children.toArray(children).some(isIconChild);
  if (
    process.env.NODE_ENV === "development" &&
    isIconOnly &&
    !hasTextContent(children) &&
    !hasAriaName(rest)
  ) {
    throw new Error(
      'Button: an icon-only button (size="icon*") requires aria-label, aria-labelledby or visually hidden text for an accessible name.',
    );
  }

  return (
    <ButtonPrimitive
      data-ui="button"
      data-variant={variant}
      data-mode={mode}
      data-size={size}
      data-icon-only={isIconOnly || undefined}
      data-has-icon={hasIcon || undefined}
      data-icon-side={isIconOnly ? undefined : iconSideOf(children)}
      {...rest}
    >
      {hasChildren && (
        <span
          data-ui="button-label"
          data-has-text={hasTextContent(children) || undefined}
          data-leading-text={hasLeadingText(children) || undefined}
        >
          {markIconChildren(children, { "data-ui": "button-icon" })}
        </span>
      )}
    </ButtonPrimitive>
  );
}

"use client";
import "./alert.css";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { CheckCircle, Info, Warning, WarningCircle } from "@phosphor-icons/react";
import type React from "react";

export type AlertIntent = "info" | "success" | "warning" | "error";

export type AlertProps = Omit<useRender.ComponentProps<"div">, "title"> & {
  /**
   * Colour role and live-region politeness. `error` renders `role="alert"`
   * (assertive); the others render `role="status"` (polite).
   * @default "info"
   */
  intent?: AlertIntent;
  /** Short headline. Rendered above the description. */
  title?: React.ReactNode;
  /** Trailing controls (e.g. Buttons), placed under the description. */
  actions?: React.ReactNode;
};

// Each default glyph carries its own part name so the Figma contract can show
// the right icon per intent (one anatomy node per part).
const DEFAULT_ICONS: Record<AlertIntent, React.ReactNode> = {
  info: <Info weight="fill" data-ui="alert-icon-info" />,
  success: <CheckCircle weight="fill" data-ui="alert-icon-success" />,
  warning: <Warning weight="fill" data-ui="alert-icon-warning" />,
  error: <WarningCircle weight="fill" data-ui="alert-icon-error" />,
};

/**
 * Alert — an inline status message. `error` announces assertively
 * (`role="alert"`); every other intent is polite (`role="status"`).
 * The description is the children. An icon as the first child (an `svg`, or any
 * element with `data-icon`) is laid out in the icon column by CSS and replaces the
 * intent's default icon; no element-type check is involved, so icon components work.
 */
export function Alert({ intent = "info", title, actions, children, render, ...rest }: AlertProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      // cast: HTMLAttributes has no data-* index signature outside JSX
      {
        "data-ui": "alert",
        "data-intent": intent,
        role: intent === "error" ? "alert" : "status",
        children: (
          <>
            <span data-ui="alert-icon" data-source="default" aria-hidden="true">
              {DEFAULT_ICONS[intent]}
            </span>
            <div data-ui="alert-content">
              {title ? <div data-ui="alert-title">{title}</div> : null}
              {children ? <div data-ui="alert-description">{children}</div> : null}
              {actions ? <div data-ui="alert-actions">{actions}</div> : null}
            </div>
          </>
        ),
      } as React.ComponentProps<"div">,
      rest,
    ),
  });
}

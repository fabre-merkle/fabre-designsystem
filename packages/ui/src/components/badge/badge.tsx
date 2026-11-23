"use client";
import "./badge.css";

type BadgeTone = "neutral" | "info" | "success" | "warning" | "critical";
type BadgeMode = "filled" | "light" | "stroke";
type BadgeSize = "sm" | "md" | "lg";

export type BadgeProps = React.ComponentProps<"span"> &
  Partial<{
    /**
     * Semantic colour. `critical` maps to the error token family.
     * @default "neutral"
     */
    tone: BadgeTone;
    /**
     * Visual treatment: solid fill, tinted container, or outlined.
     * @default "filled"
     */
    mode: BadgeMode;
    /**
     * Padding and font size.
     * @default "md"
     */
    size: BadgeSize;
  }>;

/**
 * A short, non-interactive status label — a count, a state, a category. Badge LABELS
 * something next to it; it is not a control, so it takes no click handler and no focus.
 * For a dismissible or selectable chip use a Button; for a standalone status message with
 * a headline use an Alert.
 */
export function Badge({ tone = "neutral", mode = "filled", size = "md", ...rest }: BadgeProps) {
  return <span data-ui="badge" data-tone={tone} data-mode={mode} data-size={size} {...rest} />;
}

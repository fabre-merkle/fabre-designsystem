"use client";
import { TextB } from "@phosphor-icons/react/dist/ssr";
import { Toggle, type ToggleProps } from "@workspace/ui/components/toggle";

export type ToggleDemoProps = Pick<
  ToggleProps,
  "variant" | "size" | "disabled" | "defaultPressed"
> & {
  /** The toggle label. An icon-only toggle uses it as its accessible name. */
  label?: string;
  /** Where the icon sits. */
  iconPlacement?: "none" | "start" | "icon-only";
};

const ICON_SIZE = { xs: "icon-xs", sm: "icon-sm", md: "icon", lg: "icon-lg" } as const;

/** The square icon-only size that matches a text size. */
function iconSize(size: ToggleDemoProps["size"] = "md") {
  return size in ICON_SIZE ? ICON_SIZE[size as keyof typeof ICON_SIZE] : size;
}

/**
 * One Toggle per story arguments. It is keyed by `defaultPressed` so changing the control
 * resets the pressed state instead of keeping a stale one.
 */
export function ToggleDemo({
  variant,
  size,
  disabled,
  defaultPressed = false,
  label = "Bold",
  iconPlacement = "none",
}: ToggleDemoProps) {
  // An emptied label control must not leave an icon-only toggle unnamed.
  const accessibleName = label.trim() || "Bold";
  const iconOnly = iconPlacement === "icon-only";
  const icon = <TextB weight="bold" />;
  return (
    <div data-focus-island>
      <Toggle
        key={`${defaultPressed}`}
        variant={variant}
        size={iconOnly ? iconSize(size) : size}
        disabled={disabled}
        defaultPressed={defaultPressed}
        aria-label={iconOnly ? accessibleName : undefined}
      >
        {iconPlacement === "none" ? null : icon}
        {iconOnly ? null : label}
      </Toggle>
    </div>
  );
}

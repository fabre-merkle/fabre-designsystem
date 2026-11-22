"use client";
import { Info } from "@phosphor-icons/react/dist/ssr";
import { Button, type ButtonProps } from "@workspace/ui/components/button";

const VARIANTS = ["primary", "secondary", "tertiary", "destructive"] as const;

export type ButtonDemoProps = Pick<ButtonProps, "variant" | "mode" | "size" | "disabled"> & {
  /** The button label. Icon-only buttons use it as the accessible name. */
  label?: string;
  /** Where the icon sits. `icon-only` renders a square icon size (see `size`). */
  icon?: "none" | "start" | "end" | "icon-only";
  /** Render the primary, secondary, tertiary and destructive variants side by side. */
  showAllVariants?: boolean;
  /** Render on the page or on a brand surface. */
  surface?: "default" | "brand";
};

/** The square icon size that matches each height, so the Size control still applies. */
const ICON_SIZE = {
  xs: "icon-xs",
  sm: "icon-sm",
  md: "icon",
  lg: "icon-lg",
} as const;

/**
 * One Button per story arguments, or the variant set when `showAllVariants` is on.
 * A client component: the docs story passes it to the controls panel.
 */
export function ButtonDemo({
  variant,
  mode,
  size,
  disabled,
  label = "Button",
  icon = "none",
  showAllVariants = false,
  surface = "default",
}: ButtonDemoProps) {
  // An emptied label control must not leave an icon-only button unnamed.
  const accessibleName = label.trim() || "Button";
  const sizeKey = size ?? "md";
  const isIconSize = sizeKey.startsWith("icon");
  const isIconOnly = icon === "icon-only" || isIconSize;
  const resolvedSize =
    isIconOnly && !isIconSize ? ICON_SIZE[sizeKey as keyof typeof ICON_SIZE] : size;
  const variants = showAllVariants ? VARIANTS : [variant];
  const buttons = variants.map((value) => (
    <Button
      key={value ?? "default"}
      variant={value}
      mode={mode}
      size={resolvedSize}
      disabled={disabled}
      aria-label={isIconOnly ? accessibleName : undefined}
    >
      {isIconOnly ? (
        <Info aria-hidden="true" weight="bold" />
      ) : (
        <>
          {icon === "start" && <Info data-icon="inline-start" aria-hidden="true" weight="bold" />}
          {label}
          {icon === "end" && <Info data-icon="inline-end" aria-hidden="true" weight="bold" />}
        </>
      )}
    </Button>
  ));
  return (
    <div data-focus-island>
      {surface === "default" ? (
        buttons
      ) : (
        <div
          data-finish="brand"
          data-brand-context
          style={{
            backgroundColor: "var(--color-primary-brand)",
            borderRadius: "var(--radius-default)",
            // Fill the stage, so the button reads as sitting on a brand surface rather than as a
            // light button with a coloured border.
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--spacing-200)",
            justifyContent: "center",
            minHeight: "8rem",
            padding: "var(--spacing-600)",
            width: "100%",
          }}
        >
          {buttons}
        </div>
      )}
    </div>
  );
}

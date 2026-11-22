"use client";
import { Separator, type SeparatorProps } from "@workspace/ui/components/separator";

/** Props of the demo: the Separator props it exposes, then the demo-only settings (see `demoArgs`). */
export type SeparatorDemoProps = Pick<SeparatorProps, "variant" | "size" | "orientation"> & {
  /** The label of the labelled variants. The line variant has no label. */
  label?: string;
};

/** A Separator between two pieces of content, in a column or, when vertical, in a row. */
export function SeparatorDemo({
  variant = "line",
  size = "md",
  orientation = "horizontal",
  label = "Section",
}: SeparatorDemoProps) {
  const text = variant === "line" ? undefined : label;
  return (
    <div data-focus-island>
      {orientation === "vertical" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-300)",
            height: 32,
            color: "var(--color-on-surface)",
          }}
        >
          <span>Profile</span>
          <Separator variant={variant} size={size} orientation="vertical">
            {text}
          </Separator>
          <span>Settings</span>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-300)",
            width: 320,
            color: "var(--color-on-surface)",
          }}
        >
          <span>Content above</span>
          <Separator variant={variant} size={size}>
            {text}
          </Separator>
          <span>Content below</span>
        </div>
      )}
    </div>
  );
}

"use client";
import { Badge, type BadgeProps } from "@workspace/ui/components/badge";

/** Props of the demo: the Badge props it exposes, then the demo-only settings (see `demoArgs`). */
export type BadgeDemoProps = Pick<BadgeProps, "tone" | "mode" | "size"> & {
  /** The text inside the badge. */
  label?: string;
};

/** One Badge. */
export function BadgeDemo({
  tone = "neutral",
  mode = "filled",
  size = "md",
  label = "Active",
}: BadgeDemoProps) {
  return (
    <div data-focus-island>
      <Badge tone={tone} mode={mode} size={size}>
        {label}
      </Badge>
    </div>
  );
}

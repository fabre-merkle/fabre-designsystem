"use client";
import type { ScrollArea } from "@workspace/ui/components/scroll-area";
import type { ComponentProps } from "react";
import {
  ScrollAreaContent,
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "../scroll-area-parts";

type ScrollbarProps = ComponentProps<typeof ScrollArea.Scrollbar>;

/** Props of the demo: the ScrollArea props it exposes, then the demo-only settings (see `demoArgs`). */
export type ScrollAreaDemoProps = Pick<ScrollbarProps, "keepMounted"> & {
  /** Which axes scroll: one scrollbar per axis, plus the corner when both show. */
  axes?: "vertical" | "horizontal" | "both";
};

const ROWS = Array.from({ length: 24 }, (_, index) => index + 1);

/** A fixed-size ScrollArea whose content overflows on the chosen axes. */
export function ScrollAreaDemo({ keepMounted = false, axes = "vertical" }: ScrollAreaDemoProps) {
  const vertical = axes !== "horizontal";
  const horizontal = axes !== "vertical";
  return (
    <div data-focus-island>
      <ScrollAreaRoot
        style={{
          height: 220,
          width: "100%",
          border: "1px solid var(--color-surface-border-1)",
          borderRadius: "var(--radius-default)",
        }}
      >
        <ScrollAreaViewport style={{ padding: "var(--spacing-300)" }}>
          <ScrollAreaContent>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-200)" }}>
              {(vertical ? ROWS : ROWS.slice(0, 3)).map((row) => (
                <div key={row} style={{ whiteSpace: horizontal ? "nowrap" : "normal" }}>
                  Row {row}
                  {horizontal
                    ? " — a line of content wide enough to require horizontal scrolling, so keep reading to the end of the row."
                    : " — a line of content tall enough to require vertical scrolling."}
                </div>
              ))}
            </div>
          </ScrollAreaContent>
        </ScrollAreaViewport>
        {vertical ? (
          <ScrollAreaScrollbar orientation="vertical" keepMounted={keepMounted}>
            <ScrollAreaThumb />
          </ScrollAreaScrollbar>
        ) : null}
        {horizontal ? (
          <ScrollAreaScrollbar orientation="horizontal" keepMounted={keepMounted}>
            <ScrollAreaThumb />
          </ScrollAreaScrollbar>
        ) : null}
        {vertical && horizontal ? <ScrollAreaCorner /> : null}
      </ScrollAreaRoot>
    </div>
  );
}

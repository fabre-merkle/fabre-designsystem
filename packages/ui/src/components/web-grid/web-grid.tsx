"use client";
import "./web-grid.css";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";

/**
 * Column layout. `1up` to `4up` are equal columns, `2-1` and `1-2` are a two-to-one split, and
 * `auto` fits as many columns as the width allows.
 */
export type GridVariant = "1up" | "2up" | "3up" | "4up" | "2-1" | "1-2" | "auto";

/** Space between cells: the spacing scale, or `gutter` for the breakpoint-aware web grid gutter. */
export type GridGap = "none" | "sm" | "base" | "lg" | "gutter";

/** Columns an item spans, or `full` for the whole row. */
export type GridItemSpan = 2 | 3 | 4 | "full";

export type GridProps = useRender.ComponentProps<"div"> & {
  /**
   * The column layout. Every variant except `auto` collapses as the web breakpoint narrows.
   * @default "2up"
   */
  variant?: GridVariant;
  /**
   * The space between cells.
   * @default "base"
   */
  gap?: GridGap;
  /** Insets the grid by the breakpoint-aware web grid margin. */
  margin?: boolean;
  /**
   * Collapses against the grid's own width instead of the page breakpoint, for a grid inside a
   * panel, sidebar or other region narrower than the page. Wraps the grid in one extra element.
   */
  container?: boolean;
};

export type GridItemProps = useRender.ComponentProps<"div"> & {
  /** How many columns the item spans. Leave unset for one column. */
  span?: GridItemSpan;
};

/**
 * A responsive grid. Columns come from the variant, space from `gap`, and the page inset from
 * `margin`. Columns collapse at the web breakpoints (`data-web` on the root element), so mount
 * `SurfaceProvider` once near the root of the app.
 */
function Root({ variant = "2up", gap = "base", margin, container, render, ...props }: GridProps) {
  const grid = useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        "data-ui": "grid",
        "data-variant": variant,
        "data-gap": gap,
        "data-margin": margin ? "" : undefined,
      } as React.ComponentProps<"div">,
      props,
    ),
  });
  return container ? <div data-ui="grid-container">{grid}</div> : grid;
}

/** A grid cell. A `div` by default; `span` lets it take more than one column. */
function Item({ span, render, ...props }: GridItemProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      { "data-ui": "grid-item", "data-span": span } as React.ComponentProps<"div">,
      props,
    ),
  });
}

export { Item, Root };

"use client";
import { Elevated } from "@workspace/ui/components/elevated";
import { Grid, type GridProps } from "@workspace/ui/components/web-grid";
import type { ReactNode } from "react";

/** Props of the demo: the Grid props it exposes, then the demo-only settings (see `demoArgs`). */
export type WebGridDemoProps = Pick<GridProps, "variant" | "gap" | "margin" | "container"> & {
  /** How many cells the grid holds. */
  cells?: number;
};

/**
 * Settings the presets set and no control draws. They are read from the arguments but are not part
 * of `WebGridDemoProps`, so the generated controls skip them.
 */
export type WebGridDemoPresetOnly = {
  /** Lay the cells out with `Grid.Item` spans instead of one cell per column. */
  showSpans?: boolean;
  /** Show a page-breakpoint grid and a container grid in the same narrow box. */
  compare?: boolean;
};

const CELL_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function Cell({ children }: { children: ReactNode }) {
  return (
    <Elevated
      style={{
        padding: "var(--spacing-300)",
        textAlign: "center",
        fontSize: "var(--typography-paragraph-sm-font-size)",
      }}
    >
      {children}
    </Elevated>
  );
}

/**
 * A Grid of Elevated cells. The preview is a plain stage, so the grid and its cells are the only
 * layers. The `compare` preset shows the same markup twice in a narrow box, with and without
 * `container`.
 */
export function WebGridDemo(args: WebGridDemoProps) {
  const { variant, gap, margin, container, cells = 6 } = args;
  const { showSpans = false, compare = false } = args as WebGridDemoProps & WebGridDemoPresetOnly;
  if (compare) {
    return (
      <div data-focus-island>
        <div
          style={{
            display: "grid",
            gap: "var(--spacing-500)",
            width: "100%",
            maxWidth: "calc(var(--spacing-1000) * 8)",
          }}
        >
          <Grid.Root variant={variant} gap={gap}>
            {CELL_NUMBERS.slice(0, 3).map((n) => (
              <Cell key={n}>{n === 1 ? "Page breakpoint" : `Cell ${n}`}</Cell>
            ))}
          </Grid.Root>
          <Grid.Root variant={variant} gap={gap} container>
            {CELL_NUMBERS.slice(0, 3).map((n) => (
              <Cell key={n}>{n === 1 ? "Container" : `Cell ${n}`}</Cell>
            ))}
          </Grid.Root>
        </div>
      </div>
    );
  }
  return (
    <div data-focus-island>
      <div style={{ width: "100%" }}>
        <Grid.Root variant={variant} gap={gap} margin={margin} container={container}>
          {showSpans ? (
            <>
              <Grid.Item span="full">
                <Cell>full</Cell>
              </Grid.Item>
              <Grid.Item span={2}>
                <Cell>span 2</Cell>
              </Grid.Item>
              <Cell>1</Cell>
            </>
          ) : (
            CELL_NUMBERS.slice(0, Math.max(1, cells)).map((n) => <Cell key={n}>{n}</Cell>)
          )}
        </Grid.Root>
      </div>
    </div>
  );
}

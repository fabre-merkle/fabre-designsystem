"use client";

// Elevated — a raised surface that sits `offset` levels above its substrate.
// Concept adapted from Fluid Functionalism's `Elevated`
// (https://github.com/mickadesign/fluid-functionalism, MIT, © 2026 Micka
// Touillaud) and Cubby UI's surfaces (https://github.com/joncoronel/cubby-ui,
// MIT, © 2026 joncoronel). Written fresh for this library, aligned with the MDS
// API; no code copied. Shadow recipe after Josh W. Comeau's Shadow Palette
// Generator (https://www.joshwcomeau.com/shadow-palette/).

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import {
  clampSurfaceLevel,
  exceedsShadowHeadroom,
  parseShadowHeadroom,
  SHADOW_HEADROOM_PROPERTY,
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  type SurfaceLevelValue,
  shadowHeadroomMessage,
  useSurfaceLevel,
} from "./surface-level";

declare const process: { env: { NODE_ENV?: string } };

export type ElevatedProps = useRender.ComponentProps<"div"> & {
  /**
   * Steps above the substrate, clamped to 8. A card on the page is level 3.
   * @default 2
   */
  offset?: number;
  /** Pin an absolute level instead of an offset. Prefer `offset`. */
  level?: SurfaceLevelValue;
  /**
   * Drop-shadow level from 1 to 8, independent of the surface level.
   * @default 1
   */
  shadowLevel?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /**
   * Paint the surface hover overlay over the fill on pointer hover. Automatic for
   * `<a href>` and `<button>` renders.
   */
  hoverable?: boolean;
};

export function Elevated({
  offset = SURFACE_OFFSET.card,
  level,
  shadowLevel = SHADOW_LEVEL.card,
  hoverable,
  render,
  ...props
}: ElevatedProps) {
  const substrate = useSurfaceLevel();
  const resolved = level ?? clampSurfaceLevel(substrate + offset);
  const surfaceRef = React.useRef<HTMLElement | null>(null);
  const warned = React.useRef(false);

  // Development only: warn once per mount when the shadow sits further above the surface than the
  // headroom allows. The headroom is the `elevation.shadowHeadroom` token, read from the element so
  // a brand or a local override applies; it falls back to 2.
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development" || warned.current) return;
    const node = surfaceRef.current;
    if (!node) return;
    const headroom = parseShadowHeadroom(
      getComputedStyle(node).getPropertyValue(SHADOW_HEADROOM_PROPERTY),
    );
    if (!exceedsShadowHeadroom(resolved, shadowLevel, headroom)) return;
    warned.current = true;
    console.warn(shadowHeadroomMessage(resolved, shadowLevel, headroom));
  }, [resolved, shadowLevel]);

  const element = useRender({
    defaultTagName: "div",
    render,
    ref: surfaceRef,
    props: mergeProps<"div">(
      {
        "data-ui": "elevated",
        "data-surface-level": resolved,
        "data-shadow-level": shadowLevel,
        "data-hoverable": hoverable ? "" : undefined,
      } as React.ComponentProps<"div">,
      props,
    ),
  });
  return <SurfaceLevel level={resolved}>{element}</SurfaceLevel>;
}

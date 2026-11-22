"use client";

// Surface-level context. The substrate + offset model is adapted from Fluid
// Functionalism (https://github.com/mickadesign/fluid-functionalism, MIT,
// © 2026 Micka Touillaud) and Cubby UI's per-component default levels
// (https://github.com/joncoronel/cubby-ui, MIT, © 2026 joncoronel). Written
// fresh for this library, aligned with the MDS API; no code copied. Shadow recipe
// after Josh W. Comeau's Shadow Palette Generator
// (https://www.joshwcomeau.com/shadow-palette/).
//
// Not to be confused with `SurfaceProvider`, which sets the viewport
// breakpoint (`data-web`) on <html>. This context only carries the elevation
// level of the surface a component renders on.

// Every surface that reads a level also needs the shared level paint.
import "./elevated.css";

import { createContext, type ReactNode, useContext } from "react";

/** Surface levels 1–8: 1 page · 3 card/popover · 5 dialog · 7 popover in a dialog. */
export type SurfaceLevelValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const MIN_SURFACE_LEVEL = 1;
export const MAX_SURFACE_LEVEL = 8;

/** Default offsets above the substrate, per surface kind. */
export const SURFACE_OFFSET = {
  /** Inline bars (menubar, toolbar): one step above the substrate. */
  bar: 1,
  card: 2,
  overlay: 2,
  dialog: 4,
} as const;

/** Default shadow level per surface kind. Independent of the surface level: nesting never raises it. */
export const SHADOW_LEVEL = {
  card: 1,
  tooltip: 2,
  overlay: 3,
  toast: 4,
  dialog: 5,
} as const;

/**
 * Largest gap, in levels, between a surface's shadow level and its surface level before `Elevated`
 * warns in development. The `elevation.shadowHeadroom` token (CSS `--elevation-shadow-headroom`)
 * overrides it.
 */
export const DEFAULT_SHADOW_HEADROOM = 2;

/**
 * A headroom of 8 turns the warning off: the gap between a shadow level and a surface level is at
 * most 7 (shadow 8 on level 1), so it can never exceed 8.
 */
export const SHADOW_HEADROOM_OFF = 8;

/** The custom property that carries the headroom (the `elevation.shadowHeadroom` token). */
export const SHADOW_HEADROOM_PROPERTY = "--elevation-shadow-headroom";

/**
 * Reads a headroom from a raw custom-property value. A whole number from 0 to 8 is kept;
 * anything else (missing, empty, fractional, out of range, not a number) falls back to the default.
 */
export function parseShadowHeadroom(raw: string | null | undefined): number {
  const text = raw?.trim();
  if (!text) return DEFAULT_SHADOW_HEADROOM;
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0 || value > SHADOW_HEADROOM_OFF) {
    return DEFAULT_SHADOW_HEADROOM;
  }
  return value;
}

/** True when the shadow level sits more than `headroom` levels above the surface level. */
export function exceedsShadowHeadroom(
  level: number,
  shadowLevel: number,
  headroom: number,
): boolean {
  return shadowLevel - level > headroom;
}

/** The development warning for a shadow that exceeds its headroom. */
export function shadowHeadroomMessage(
  level: number,
  shadowLevel: number,
  headroom: number,
): string {
  return `Elevated: shadowLevel ${shadowLevel} is ${shadowLevel - level} above surface level ${level}, more than the shadow headroom of ${headroom}. A shadow this heavy on a surface this low usually reads as floating. Set the elevation.shadowHeadroom token, or ${SHADOW_HEADROOM_PROPERTY}, to raise it; ${SHADOW_HEADROOM_OFF} turns the warning off.`;
}

const SurfaceLevelContext = createContext<SurfaceLevelValue>(1);

/** Clamp any number onto the 1–8 ladder. */
export function clampSurfaceLevel(level: number): SurfaceLevelValue {
  const rounded = Math.round(level);
  return Math.min(MAX_SURFACE_LEVEL, Math.max(MIN_SURFACE_LEVEL, rounded)) as SurfaceLevelValue;
}

/** The level of the surface this component renders on (its substrate). Defaults to 1, the page. */
export function useSurfaceLevel(): SurfaceLevelValue {
  return useContext(SurfaceLevelContext);
}

/** The level a surface lands on when raised `offset` steps above its substrate. */
export function useElevation(offset: number): SurfaceLevelValue {
  return clampSurfaceLevel(useSurfaceLevel() + offset);
}

export interface SurfaceLevelProps {
  /** The level descendants treat as their substrate. */
  level: SurfaceLevelValue;
  children?: ReactNode;
}

/**
 * Declares the surface level for everything inside it. Raised surfaces
 * (Elevated and the overlay popups) provide it for their own content, so a
 * menu opened in a dialog lands one level above the dialog with no props.
 * Context passes through portals, so popups keep the level of the tree they
 * were declared in.
 */
export function SurfaceLevel({ level, children }: SurfaceLevelProps) {
  return <SurfaceLevelContext.Provider value={level}>{children}</SurfaceLevelContext.Provider>;
}

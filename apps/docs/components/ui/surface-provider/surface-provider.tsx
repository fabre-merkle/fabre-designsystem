"use client";
import { useEffect } from "react";

// Fallback values — used only if brand token CSS vars can't be read (e.g. tokens not loaded).
// Kept in sync with --brand-breakpoint-sm-max / --brand-breakpoint-md-max in brand/fabre-designsystem.css.
// Note: the inline <script> in <head> also hardcodes these; it runs before CSS is computed
// so it cannot read CSS vars and must stay hardcoded.
const SM_MAX_FALLBACK = 767;
const MD_MAX_FALLBACK = 1023;

type WebBreakpoint = "sm" | "md" | "lg";

export interface SurfaceProviderProps {
  /**
   * Override the breakpoint thresholds (px) used to select the web token set.
   * Defaults are read from --brand-breakpoint-sm-max / --brand-breakpoint-md-max at runtime.
   */
  breakpoints?: { smMax?: number; mdMax?: number };
}

function readPx(property: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Sets data-web on <html> to activate the correct web breakpoint token set
 * (web/sm.css, web/md.css, web/lg.css) and keeps it in sync as the viewport changes.
 *
 * Place once near the root of your app. Pair with the inline script in your
 * <head> to prevent a flash of unstyled typography on first paint.
 *
 * The name "SurfaceProvider" reflects that this establishes the token context
 * for the rendering surface — web breakpoints today, kiosk or native surfaces
 * in the future (each with their own token set activated via a different data attribute).
 */
export function SurfaceProvider({ breakpoints }: SurfaceProviderProps = {}) {
  useEffect(() => {
    const smMax = breakpoints?.smMax ?? readPx("--brand-breakpoint-sm-max", SM_MAX_FALLBACK);
    const mdMax = breakpoints?.mdMax ?? readPx("--brand-breakpoint-md-max", MD_MAX_FALLBACK);

    const resolve = (width: number): WebBreakpoint => {
      if (width <= smMax) return "sm";
      if (width <= mdMax) return "md";
      return "lg";
    };
    const update = () => {
      document.documentElement.dataset.web = resolve(window.innerWidth);
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [breakpoints?.smMax, breakpoints?.mdMax]);

  return null;
}

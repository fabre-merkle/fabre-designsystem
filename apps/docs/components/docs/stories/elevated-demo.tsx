"use client";
import {
  clampSurfaceLevel,
  Elevated,
  type ElevatedProps,
  SurfaceLevel,
  useSurfaceLevel,
} from "@workspace/ui/components/elevated";

/**
 * Props of the demo: the Elevated props it exposes, then the demo-only setting (see `demoArgs`).
 * Every control has a value, so none of them offers an empty "Unset" entry.
 */
export type ElevatedDemoProps = {
  /**
   * Surface level of the surface, 1 to 8: its fill and edge. The demo pins it with `level` so every
   * level can be shown. In an app it comes from the surface it sits on, plus its offset.
   */
  level: NonNullable<ElevatedProps["level"]>;
  /** Drop-shadow level, 1 to 8. Independent of the surface level. */
  shadowLevel: NonNullable<ElevatedProps["shadowLevel"]>;
  /** Put a second `Elevated` inside. It lands two surface levels above, with its own shadow level of 1. */
  nested: boolean;
};

const box = {
  display: "grid",
  gap: "var(--spacing-300)",
  padding: "var(--spacing-400)",
  borderRadius: "var(--radius-default)",
  fontSize: "var(--typography-paragraph-sm-font-size)",
} as const;

/** The level the surface resolved to, read from the level context it provides. */
function Label({ shadow }: { shadow: number }) {
  return (
    <span>
      Level {useSurfaceLevel()}, shadow {shadow}
    </span>
  );
}

/**
 * A bare `Elevated` at a chosen surface level and shadow level, with a second one inside it when
 * `nested` is on. The whole preview area is painted at the level the surface would sit on by
 * default (two below, never below 1), so the layers are the stage, the surface and the nested one.
 */
export function ElevatedDemo({ level, shadowLevel, nested }: ElevatedDemoProps) {
  const stage = clampSurfaceLevel(level - 2);
  return (
    <div
      data-focus-island
      data-story-fill
      style={{
        backgroundColor: `var(--color-surface-level-${stage})`,
        padding: "var(--spacing-600) var(--spacing-400)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "26rem", margin: "0 auto" }}>
        <SurfaceLevel level={stage}>
          <Elevated level={level} shadowLevel={shadowLevel} style={box}>
            <Label shadow={shadowLevel} />
            {nested ? (
              <Elevated style={box}>
                <Label shadow={1} />
              </Elevated>
            ) : null}
          </Elevated>
        </SurfaceLevel>
      </div>
    </div>
  );
}

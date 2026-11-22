"use client";
import { Button } from "@workspace/ui/components/button";
import { Card, type CardProps } from "@workspace/ui/components/card";
import { clampSurfaceLevel, SurfaceLevel } from "@workspace/ui/components/elevated";

/**
 * Props of the demo: the Card props it exposes, then the demo-only settings (see `demoArgs`).
 * Every control has a value, so none of them offers an empty "Unset" entry.
 */
export type CardDemoProps = {
  /** Padding and gap for the whole card. The type does not change with size. */
  size: NonNullable<CardProps["size"]>;
  /**
   * Surface level of the card, 1 to 8: its fill and edge. The demo pins it with `level` so every
   * level can be shown. In an app it comes from the surface the card sits on, plus 2.
   */
  level: NonNullable<CardProps["level"]>;
  /** Drop-shadow level of the card, 1 to 8. Independent of the surface level. */
  shadowLevel: NonNullable<CardProps["shadowLevel"]>;
  /** Put a second, smaller Card inside the content. It lands two surface levels above the card. */
  nested: boolean;
  /** The card title. */
  title: string;
  /** The text under the title. */
  description: string;
};

/**
 * Settings the variant presets set and no control draws. They are read from the arguments but are
 * not part of `CardDemoProps`, so the generated controls skip them.
 */
export type CardDemoPresetOnly = { showAction?: boolean; showFooter?: boolean };

/**
 * One Card at a chosen surface level and shadow level, nested by default. The card takes Card's
 * real `level` and `shadowLevel` props, so Elevated paints its fill, edge and shadow exactly as it
 * does anywhere else. The nested card reads the card's level as its substrate and lands two above
 * it, clamped at 8, with its own shadow level of 1. The whole preview area is painted at the level a
 * card at this level would sit on by default (two below, never below 1), so there is no inner
 * stage box: stage, card and nested card are the only layers. Nothing else renders in
 * the preview: the annotated version is the `CardAnnotated` widget below the story.
 */
export function CardDemo(args: CardDemoProps) {
  const { size, level, shadowLevel, nested, title, description } = args;
  const { showAction = false, showFooter = false } = args as CardDemoProps & CardDemoPresetOnly;
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
          <div>
            <Card.Root size={size} level={level} shadowLevel={shadowLevel}>
              <Card.Header>
                <Card.Title>{title}</Card.Title>
                <Card.Description>{description}</Card.Description>
                {showAction ? (
                  <Card.Action>
                    <Button size="sm" variant="secondary" mode="ghost">
                      Edit
                    </Button>
                  </Card.Action>
                ) : null}
              </Card.Header>
              <Card.Content>
                {nested ? (
                  <Card.Root size="sm">
                    <Card.Header>
                      <Card.Title>Nested card</Card.Title>
                      <Card.Description>Raised on its own, no props.</Card.Description>
                    </Card.Header>
                  </Card.Root>
                ) : (
                  "Changes apply to everyone who can open this project."
                )}
              </Card.Content>
              {showFooter ? (
                <Card.Footer>
                  <Button size="sm" variant="secondary" mode="ghost">
                    Cancel
                  </Button>
                  <Button size="sm">Save</Button>
                </Card.Footer>
              ) : null}
            </Card.Root>
          </div>
        </SurfaceLevel>
      </div>
    </div>
  );
}

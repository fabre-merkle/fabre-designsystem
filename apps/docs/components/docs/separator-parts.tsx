"use client";
// Re-exported with `from`: a bare `export { Separator }` of the import below resolved to
// `undefined` in the production prerender of a scaffolded project.
export { Separator } from "@workspace/ui/components/separator";

import { Separator } from "@workspace/ui/components/separator";

export function SeparatorHeroDemo() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-400)",
        width: "100%",
        maxWidth: "320px",
        color: "var(--color-on-surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-100)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--typography-headline-sm-font-family)",
            fontSize: "var(--typography-headline-sm-font-size)",
            fontWeight: "var(--typography-headline-sm-font-weight)",
            lineHeight: "var(--typography-headline-sm-line-height)",
            letterSpacing: "var(--typography-headline-sm-letter-spacing)",
          }}
        >
          Acme
        </p>
        <p
          style={{
            margin: 0,
            color: "var(--color-on-surface-subtle)",
            fontSize: "var(--typography-paragraph-sm-font-size)",
          }}
        >
          A React design system built on Base UI.
        </p>
      </div>
      <Separator />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-300)",
          fontSize: "var(--typography-paragraph-sm-font-size)",
          color: "var(--color-on-surface-subtle)",
        }}
      >
        <span>Components</span>
        <Separator orientation="vertical" style={{ height: "1em" }} />
        <span>Tokens</span>
        <Separator orientation="vertical" style={{ height: "1em" }} />
        <span>Changelog</span>
      </div>
    </div>
  );
}

export function SeparatorLineDemo() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-300)",
        width: "100%",
        color: "var(--color-on-surface)",
      }}
    >
      <span>Content above</span>
      <Separator />
      <span>Content below</span>
    </div>
  );
}

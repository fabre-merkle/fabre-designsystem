/** The surface level a card lands on, the level of its edge, and its shadow level. */
export type CardLayer = { level: number; edge: number; shadow: number };

const clamp = (n: number) => Math.min(8, Math.max(1, Math.round(n)));

/**
 * The tokens Elevated applies to a card at `level` and to a card nested in it. The edge is the
 * surface border one level above the fill (clamped at 8), the nested card sits two levels above
 * the card, and nesting never raises the shadow level.
 */
export function cardLayers(
  level: number,
  shadowLevel: number,
): { card: CardLayer; nested: CardLayer } {
  const nestedLevel = clamp(level + 2);
  return {
    card: { level, edge: clamp(level + 1), shadow: shadowLevel },
    nested: { level: nestedLevel, edge: clamp(nestedLevel + 1), shadow: 1 },
  };
}

/** The custom properties each layer paints with, for a callout's token line. */
export const tokenNames = {
  fill: (level: number) => `--color-surface-level-${level}`,
  edge: (edge: number) => `--color-surface-border-${edge}`,
  shadow: (shadow: number) => `--shadow-level-${shadow}`,
} as const;

/** The annotated Card as Markdown: the same facts the callouts print, as a list. */
export function cardAnnotatedMarkdown(level = 3, shadowLevel = 1): string {
  const { card, nested } = cardLayers(level, shadowLevel);
  const layer = (name: string, l: CardLayer) =>
    `- ${name}: fill \`${tokenNames.fill(l.level)}\`, edge \`${tokenNames.edge(l.edge)}\`, shadow \`${tokenNames.shadow(l.shadow)}\``;
  return [
    "",
    `**Annotated card** (surface level ${card.level}, shadow level ${card.shadow}; the nested card is two surface levels higher with its own shadow level of 1)`,
    "",
    layer("Card", card),
    "- Card corner: `--radius-default`",
    layer("Nested card", nested),
    "- Nested card corner: `--inner-radius`, the card's radius minus its border and padding, never below `--radius-inset-minimum` and never above the card's own radius",
    "",
  ].join("\n");
}

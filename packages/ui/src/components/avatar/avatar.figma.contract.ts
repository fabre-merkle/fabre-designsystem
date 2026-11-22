import { defineFigmaContract } from "../figma-contract";

export const avatarFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "avatar",
  componentName: "Avatar",
  rootPart: "avatar",
  parts: ["avatar", "avatar-image", "avatar-fallback"],
  slots: [{ name: "initials", part: "avatar-fallback" }],
  anatomy: {
    part: "avatar",
    kind: "frame" as const,
    children: [
      {
        part: "avatar-image",
        kind: "image" as const,
        imageAssetPath: "avatar-placeholder.svg",
        when: { content: "image" },
      },
      {
        part: "avatar-fallback",
        kind: "text" as const,
        slots: ["initials"],
        when: { content: "fallback" },
      },
    ],
  },
  axes: [
    { prop: "shape", values: ["circle", "square"], default: "circle", attribute: "data-shape" },
    {
      prop: "content",
      values: ["image", "fallback"],
      default: "fallback",
      attribute: "data-content",
    },
  ],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Small circle",
        key: { size: "sm" },
        slots: { initials: "JD" },
      },
      {
        label: "Small square",
        key: { size: "sm", shape: "square" },
        slots: { initials: "JD" },
      },
      {
        label: "Medium circle",
        key: {},
        slots: { initials: "AB" },
      },
      {
        label: "Medium square",
        key: { shape: "square" },
        slots: { initials: "AB" },
      },
      {
        label: "Large circle",
        key: { size: "lg" },
        slots: { initials: "CD" },
      },
      {
        label: "Large square",
        key: { size: "lg", shape: "square" },
        slots: { initials: "CD" },
      },
      { label: "Medium circle, image", key: { content: "image" } },
      { label: "Medium square, image", key: { shape: "square", content: "image" } },
    ],
  },
  reactToFigmaNotes: [
    "`shape` reflects Avatar's real `data-shape` prop; it's declared as a design-only axis " +
      "here only because `shape` isn't in the CSS-resolver's auto-derived variant hint list " +
      "(`VARIANT_PROP_HINTS`) — the same reason Checkbox's `state`/`validity` are also declared " +
      "this way despite being real DOM attributes.",
    "`content` (`image` vs `fallback`) has no `data-content` attribute in the real DOM — Base " +
      "UI's Avatar mounts exactly one of `avatar-image`/`avatar-fallback` at runtime based on " +
      "whether the image loaded, never both. The axis exists purely so the anatomy can " +
      "materialize both branches as separate, deterministic documented examples.",
  ],
});

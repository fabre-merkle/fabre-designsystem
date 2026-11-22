import type { FigmaLayoutManifestEntry } from "./src/resolved-plan";

// Geometry per component part that the component's CSS cannot state: a size, an aspect ratio, or
// a sizing mode. An entry may carry only `width`, `height`, `aspectRatio` and `reason`; fills,
// strokes, text, spacing and radius always come from the CSS. Delete an entry, or this whole file,
// and the part is refused rather than guessed.
export const FIGMA_LAYOUT_MANIFEST: Record<string, Record<string, FigmaLayoutManifestEntry>> = {
  accordion: {
    "accordion-panel": {
      height: { kind: "hug" },
      reason:
        "accordion.css authors `height: var(--accordion-panel-height)`, a value Base UI measures " +
        "from the panel's content at runtime and exposes only so the open/close transition can " +
        "animate between 0 and that measurement. It is not a design token, so there is nothing to " +
        "bind, and any literal would be a guess. What the open state shows in the browser is the " +
        "panel at its content height, which is exactly what Figma's hug-content sizing does; the " +
        "closed (`data-ending-style`, height 0) state is an animation endpoint, not a state a " +
        "designer lays out. Supersedes only this refused height.",
    },
  },
  collapsible: {
    "collapsible-panel": {
      height: { kind: "hug" },
      reason:
        "collapsible.css authors `height: var(--collapsible-panel-height)`, a value Base UI " +
        "measures from the panel's content at runtime for the open/close transition. Not a design " +
        "token, so there is nothing to bind and any literal would be a guess. The open state in " +
        "the browser is the panel at its content height, which is Figma's hug-content sizing; the " +
        "height-0 `data-ending-style` state is an animation endpoint, not a laid-out state. " +
        "Supersedes only this refused height.",
    },
  },
  "number-field": {
    "number-field-input": {
      width: { kind: "hug" },
      reason:
        "number-field.css authors `inline-size: 8ch`. `ch` is the advance width of `0` in the " +
        "rendered font, which Figma has no unit for, and baking it to px would go stale on any " +
        "font change. The input's content in the documentation example is its value, so hugging " +
        "that value is the honest Figma equivalent: the field is as wide as the number it shows. " +
        "Supersedes only this refused width.",
    },
  },
  input: {
    input: {
      width: { kind: "literal", px: 240 },
      reason:
        "An HTML <input>'s width comes from the user agent, not this stylesheet — `input.css` " +
        "authors `width: 100%` (fill your container), which is honest CSS but has nothing to fill " +
        "when the input is generated as its OWN component-set root (never a real auto-layout FILL " +
        'child — see `applyAxisSizing`\'s "fill" branch). 240px approximates the ~20ch a browser ' +
        "gives a bare <input> and matches this design system's own documentation-preview scale " +
        "(cf. number-field's 8ch / otp-field's ch-based width, both refused as genuinely unsupported " +
        "CSS rather than declared, since THEY use a real ch value the resolver can at least report).",
    },
  },
  avatar: {
    "avatar-image": {
      width: { kind: "matchRoot" },
      height: { kind: "matchRoot" },
      reason:
        'avatar.css authors `inline-size/block-size: 100%` on avatar-image, meaning "exactly ' +
        'fill the avatar box" — honest CSS, but avatar-image is a real auto-layout FLOW child, ' +
        "not the component-set ROOT itself, and nothing this generator materializes is a genuine " +
        'FILL child at its own root (every root/overlay child fails `layoutSizing* = "FILL"` at ' +
        "materialize time). Unlike checkbox-indicator's `var(--spacing-500)` root, avatar's root " +
        "resolves to a LITERAL px per `data-size` value (24/32/40, hardcoded in avatar.css, not a " +
        "token) — `matchRoot` still applies: it copies whatever `ResolvedDimension` the root " +
        "carries, literal or variable, so this stays arithmetic on a value that's never guessed.",
    },
  },
  checkbox: {
    "checkbox-indicator": {
      width: { kind: "matchRoot" },
      height: { kind: "matchRoot" },
      reason:
        "checkbox.css authors `inline-size/block-size: 100%` on checkbox-indicator, meaning " +
        '"exactly fill the checkbox box" — honest CSS, but the indicator is an OVERLAY child ' +
        '(the contract\'s anatomy sets `layout: "overlay"` → `layoutMode = "NONE"` on the ' +
        'checkbox root), and Figma\'s `layoutSizing* = "FILL"` is only legal for a child of an ' +
        "auto-layout frame, so it fails there every time (the exact live-run symptom: " +
        '"checkbox-indicator width/height: 100% outside an auto-layout parent"). Since the ' +
        "checkbox root itself resolves to a KNOWN, already-fixed box (`inline-size: var(--spacing-500)`), " +
        "100% of it is arithmetic on a value that's never guessed, not an invented one — " +
        "`matchRoot` binds the indicator to the SAME token the root already carries.",
    },
  },
  separator: {
    separator: {
      // Only fills width where the resolved dimension is `fill`/`unsupported`/
      // undefined for that CELL — the `data-orientation="vertical"` cells
      // already resolve a real `var(--stroke-width-selected)` width and are
      // left untouched by `overridableByManifest`'s precedence.
      width: { kind: "literal", px: 320 },
      // NOT declaring a height here, though the `variant=content` +
      // `orientation=vertical` cells do refuse one at runtime (`height: 100%`,
      // 3 dimensions). An unconditional height entry lands on every cell the
      // resolver left undefined — measured: 21 of 24, including a horizontal
      // `underline` separator, which would generate 320px TALL. A `when` clause
      // scopes the WHOLE entry, and this entry's width is wanted on the
      // horizontal cells, so width-for-horizontal and height-for-vertical-content
      // cannot coexist in one entry. That is the one-entry-per-part limit; until
      // it lifts, the honest answer is to leave the 3 cells refused rather than
      // mis-size 18 others.
      reason:
        'separator.css authors `width: 100%` on the horizontal "line"/"content" variants and ' +
        '"solid-text" — meaning "span your container\'s width", which the CSS never actually has ' +
        "an answer for when Separator is generated as its OWN component-set root (never a real " +
        'auto-layout FILL child, the same "outside an auto-layout parent" failure as ' +
        "checkbox-indicator and input, and the live-run's third named symptom). 320px is a " +
        "documentation-preview width (this design system has no natural 'full width' value in " +
        "isolation — a form row, a docs grid column, and a modal footer are all different widths " +
        "in real usage); vertical-orientation cells resolve their own token-bound width already " +
        "and are unaffected.",
    },
  },
  progress: {
    progress: {
      width: { kind: "literal", px: 320 },
      reason:
        "progress.css authors `inline-size: 100%` on the root — a progress bar spans whatever " +
        "contains it. Generated as its OWN component-set root there is nothing to span, so it " +
        'refuses with "100% outside an auto-layout parent" (9 dimensions, one per size x status ' +
        "cell) and the frame keeps Figma's 100px default. Identical cause to `input`, `separator` " +
        "and `slider`, and 320px is the same documentation-preview width `separator` and `slider` " +
        "use — not a design value, a preview extent. The track's own height already resolves and " +
        "is untouched.",
    },
  },
  alert: {
    alert: {
      width: { kind: "literal", px: 480 },
      reason:
        "alert.css authors no width: Alert is a block-level flex row that spans whatever " +
        "contains it. Generated as its OWN component-set root there is nothing to span, so the " +
        "frame would keep Figma's 100px default and wrap the title a word per line. 480px is a " +
        "documentation-preview extent (the alert-dialog popup's cap), not a design value; " +
        "alert-content's `flex: 1` fills it and the height hugs the content.",
    },
  },
  spinner: {
    "spinner-track": {
      width: { kind: "matchRoot" },
      height: { kind: "matchRoot" },
      reason:
        "The track is an SVG `<circle>` inside an `<svg>` that fills the spinner root " +
        "(`inline-size/block-size: 100%`); the root is sized per `data-size` to the " +
        "`--control-icon-*` token. CSS gives the circle no box of its own, so the ring is " +
        "exactly the root's box. `matchRoot` copies that token, never a guessed px.",
    },
    "spinner-arc": {
      width: { kind: "matchRoot" },
      height: { kind: "matchRoot" },
      reason:
        "The arc is a second SVG `<circle>` with the track's own centre and radius, so it is " +
        "exactly the root's box too (`matchRoot`, as for the track); its sweep is the contract's `arc`.",
    },
  },
  meter: {
    meter: {
      width: { kind: "literal", px: 320 },
      reason:
        "meter.css authors `inline-size: 100%` on the root — a meter spans whatever contains it. " +
        "Generated as its OWN component-set root there is nothing to span, so it refuses with " +
        '"100% outside an auto-layout parent" (12 dimensions, one per size x tone cell) and the ' +
        "frame keeps Figma's 100px default. Identical cause to `input`, `separator`, `progress` " +
        "and `slider`, and 320px is the same documentation-preview width those use — not a design " +
        "value, a preview extent. The track's own per-size height already resolves and is untouched.",
    },
  },
  slider: {
    slider: {
      width: { kind: "literal", px: 320 },
      when: { orientation: "horizontal" },
      reason:
        "slider.css authors `inline-size: 100%` on the root — the same honest-but-unanswerable " +
        "CSS as `input` and `separator`, and the same failure when Slider is generated as its OWN " +
        'component-set root (the live-run symptom: "width: 100% outside an auto-layout parent", ' +
        "144 dimensions across the 96-cell matrix). Slider was previously EXCLUDED for this, with " +
        "a reason almost word-for-word `separator`'s — so the identical cause was being fixed for " +
        "two components and refused for a third. 320px is the same documentation-preview width " +
        "`separator` uses. Scoped to `orientation=horizontal`: the vertical cells author " +
        "`inline-size: auto; block-size: 100%`, so their unanswerable dimension is HEIGHT, not " +
        "width, and a `when` applies to a whole entry (one entry per part) — vertical stays " +
        "excluded below rather than being given a wrong width.",
    },
  },
  "scroll-area": {
    "scroll-area-viewport": {
      width: { kind: "literal", px: 320 },
      height: { kind: "literal", px: 220 },
      reason:
        "scroll-area.css authors `width: 100%; height: 100%` on the viewport: exactly fill the " +
        "root. The root is an overlay (Base UI places the scrollbar with runtime inline styles), " +
        "and Figma's FILL is only legal under an auto-layout parent, so the percentages refuse. " +
        "The root is sized by the contract's `literalGeometry` (320x220: the docs example's " +
        "`height: 220` and a documentation-preview width, since its `width: 100%` has nothing to " +
        "span), so the viewport carries the same box. Supersedes only these two refused sizes.",
    },
  },
  button: {
    button: {
      aspectRatio: 1,
      when: { content: "icon-only" },
      reason:
        "button.css:48 authors `aspect-ratio: 1` on `[data-icon-only]` — Figma has no `aspect-ratio` " +
        "property to bind. The root already hugs a real box via its padding (icon-only's padding-inline " +
        "is deliberately set equal to the size's own padding-block, per the CSS's own comment " +
        '"square using the block padding value for inline"), so this is belt-and-braces: the walker ' +
        "resizes the hugged box to be exactly square after normal sizing runs, rather than relying on " +
        "the padding trick alone to hold across every size/icon combination.",
    },
  },
};

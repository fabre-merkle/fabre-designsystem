import type { ComposedChildOverrideCell } from "../registry/resolver";

export const RESOLVED_PLAN_SCHEMA_VERSION = 3 as const;

/**
 * An intermediate on a `literal` dimension that CSS wrote as `calc(<whole> - <count> * <inset>)`:
 * the box is its parent's `whole` minus `count` insets. `fill-inset.ts` turns it into FILL when the
 * parent is exactly `whole` on that axis and pads it with that inset on every side the calc
 * counts, and drops it otherwise, keeping the computed px. Never in a compiled plan.
 */
export interface DimensionInset {
  /** The variable the parent's own size on this axis is bound to. */
  whole: string;
  /** The variable the parent pads this axis with. */
  inset: string;
  /** How many insets the calc subtracts (2: one per side). */
  count: number;
}

export type ResolvedDimension =
  | { kind: "variable"; variable: string }
  | { kind: "fill" }
  | { kind: "literal"; px: number; insetOf?: DimensionInset }
  | { kind: "hug" }
  | { kind: "unsupported"; value: string }
  | { kind: "runtime"; property: string };

/** Fill/text/stroke bindings, expressed as Figma variable NAMES (e.g. "color/primary-brand"). */
export interface ResolvedPlanBinding {
  fill?: string;
  /** The fill's strength as a fraction (the CSS mixes it with `transparent`); absent = opaque. */
  fillOpacity?: number;
  text?: string;
  stroke?: string;
  /** The stroke's strength as a fraction (the CSS mixes it with `transparent`); absent = opaque. */
  strokeOpacity?: number;
  effectStyle?: string;
  /** The stroke is `currentColor`: draw it in the node's resolved text colour (possibly inherited). */
  strokeFromText?: true;
}

/** Geometry bindings, also by variable name — never a resolved px/RGB value. */
export interface ResolvedPlanGeometry {
  paddingInline?: string;
  paddingBlock?: string;
  /**
   * One-sided padding, present only for a side that differs from its opposite
   * (`padding: A B C D`, `padding-top`, `padding-block-end`, …); a symmetric axis is
   * always `paddingInline`/`paddingBlock`. The two forms never coexist on one axis.
   */
  paddingLeft?: string;
  paddingRight?: string;
  paddingTop?: string;
  paddingBottom?: string;
  gap?: string;
  radius?: string;
  borderWidth?: string;
  /**
   * One-sided stroke weight, the bound width variable of that side (`border-bottom`,
   * `border-inline-start`, ...). Present only for a side that has a border; when any
   * is present and `borderWidth` is not, every other side has weight 0.
   */
  borderTopWidth?: string;
  borderRightWidth?: string;
  borderBottomWidth?: string;
  borderLeftWidth?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textStyle?: string;
  /** Node opacity — what distinguishes a disabled cell from its enabled twin. */
  opacity?: string;
  /** The node's box on each axis, by mechanism — see `ResolvedDimension`. */
  width?: ResolvedDimension;
  height?: ResolvedDimension;
  /**
   * `flex-grow` (directly, or via the `flex` shorthand) on a flex CHILD: "take
   * the free space on my parent's main axis", which is exactly Figma's
   * `layoutSizing* = "FILL"`.
   *
   * Carried as a parent-relative INTENT rather than a `width`/`height`, because
   * which axis it means depends on the parent's `flex-direction` and this
   * resolver only ever sees one part at a time. The anatomy walk resolves it —
   * it is the only place that knows a node's parent.
   *
   * Before this existed, `flex: 1 1 auto` produced NO dimension at all, so the
   * node fell through to Figma's 100px default frame: a Slider's track rendered
   * 100px wide inside a 292px control, and read as "the track does not fill".
   */
  growsOnMainAxis?: boolean;
  /**
   * Size limits (`min-width`/`max-width`/`min-height`/`max-height` and the logical `*-inline-size`
   * / `*-block-size` forms): Figma's own `minWidth`/`maxWidth`/`minHeight`/`maxHeight` on an
   * auto-layout frame. A plain variable name where the CSS binds one token: a limit is never
   * applied AS a box, so it needs no mechanism dispatch, and it is bound, never resolved to px.
   * A limit the CSS states as a px literal is the `*Px` number beside it. Anything else (`calc()`,
   * a viewport or percentage unit, `min()`/`max()`, a runtime value, `rem`) is refused and
   * reported in `refusedMargins` under `<part> <property>`. A zero lower bound and a `none` upper
   * bound state no limit and carry nothing.
   */
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  minWidthPx?: number;
  maxWidthPx?: number;
  minHeightPx?: number;
  maxHeightPx?: number;
  /**
   * `overflow: hidden | clip`: Figma's `clipsContent`. Only `true` is carried. Every other
   * `overflow` value clears it, including `visible`, `auto` and `scroll` (a scroll container is not
   * a clipping frame, so there is no Figma property to carry and nothing to refuse or report). A
   * single-axis longhand (`overflow-y`) neither sets nor clears it.
   */
  clipsContent?: true;
  /**
   * `flex-wrap: wrap` on a horizontal row: Figma's `layoutWrap`. `wrap-to-layout.ts` keeps it
   * only on a horizontal frame and refuses it elsewhere.
   */
  layoutWrap?: "WRAP";
  /** Figma's `counterAxisSpacing` (the gap between wrapped lines): the bound `row-gap` (or `gap`) variable. */
  counterAxisSpacing?: string;
  /**
   * `row-gap`, as a bound variable name. An intermediate only: `wrap-to-layout.ts` turns it into
   * `counterAxisSpacing` on a wrapping row and drops it elsewhere (no Figma property carries it).
   */
  rowGap?: string;
  /**
   * `transform: translateX(...)` resolved to px against the tokens in force. An intermediate only:
   * `translate-to-align.ts` turns an exact end-edge translation into the parent's
   * `primaryAxisAlignItems: "MAX"` and refuses every other one. Never in a compiled plan.
   */
  translateXPx?: number;
  /**
   * `position: absolute` with percentage insets (`top: 50%`, ...), per side, in percent. An
   * intermediate: `inset-constraints.ts` turns it into `constraints: SCALE` on a child of a
   * non-auto-layout parent (the percentages stay beside it, so the walker can place the child at
   * that fraction) and refuses it under an auto-layout parent, where it is dropped.
   */
  insetPercent?: { top?: number; right?: number; bottom?: number; left?: number };
  /**
   * Figma `constraints` for an absolutely positioned child of a non-auto-layout parent:
   * `SCALE` on each axis where the CSS insets are percentages.
   */
  constraints?: { horizontal?: "SCALE"; vertical?: "SCALE" };
  layoutMode?: "HORIZONTAL" | "VERTICAL";
  /** `justify-content` (primary/main axis) → Figma's `primaryAxisAlignItems`. */
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  /**
   * `align-items` (counter/cross axis) → Figma's `counterAxisAlignItems`.
   * `stretch` folds to `MIN` here (no `STRETCH` member on this container-level
   * enum) — see `alignItems` below for how `stretch` is still carried through.
   */
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX";
  /**
   * `align-self` on a flex child. An intermediate only: the plan layer moves it to the parent's
   * `counterAxisAlignItems` when that is exact and refuses it otherwise, so no compiled plan
   * carries it.
   */
  alignSelf?: "MIN" | "CENTER" | "MAX";
  /**
   * Margins per side, as bound variable names. An intermediate only: the plan layer
   * (`margins-to-layout.ts`) maps each margin to the parent's padding or gap when that is exact,
   * and otherwise refuses it and reports it in `refusedMargins`. A margin is never wrapped in a
   * frame, and no compiled plan carries one.
   */
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  alignItems?: "stretch";
  /** `text-align` → Figma's `textAlignHorizontal`. */
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  /** `text-transform` → Figma's `textCase`. */
  textCase?: "UPPER" | "LOWER" | "ORIGINAL";
  aspectRatio?: number;
  radiusPx?: number;
}

export type FigmaLayoutDimension =
  | {
      /** An intrinsic px value CSS never states (e.g. an `<input>`'s UA-default width). */
      kind: "literal";
      px: number;
    }
  | {
      /**
       * "Bind the SAME resolved dimension as this component's own root
       * part, on this same axis." Legitimate ONLY because it translates a
       * value already honestly present in the CSS (`100%` of a KNOWN,
       * already-fixed parent box is not a guess — it's arithmetic on a
       * value that is itself never guessed); it does not invent geometry
       * absent from the source. Scoped to the entry's OWN root — matching
       * a different sub-part isn't needed by any component today and would
       * require carrying that part's resolution through the merge, so it's
       * deliberately not supported (extend `applyLayoutManifest` in
       * `from-registry.ts` if a future component needs it).
       */
      kind: "matchRoot";
    }
  | {
      kind: "hug";
    };

export interface FigmaLayoutManifestEntry {
  width?: FigmaLayoutDimension;
  height?: FigmaLayoutDimension;
  /** `aspect-ratio` — see `ResolvedPlanGeometry.aspectRatio`. */
  aspectRatio?: number;
  /**
   * Apply this entry only when every axis/value pair matches the variant
   * cell's key. Omit to apply unconditionally to all cells for this part.
   * Use when a geometry declaration is correct for one variant value but
   * wrong for others (e.g. `aspect-ratio: 1` only on `content=icon-only`).
   */
  when?: Record<string, string>;
  reason: string;
}

/** One cell of the variant × mode × size × state matrix. */
export interface ResolvedPlanCell {
  /** One entry per axis, e.g. `{ variant: "primary", mode: "filled" }`. */
  key: Record<string, string>;
  label: string;
  bind: ResolvedPlanBinding;
  /** Icon name when this variant includes an icon node (lookup key into the icon registry). */
  iconName?: string;
  iconSvg?: string;
  /** Present when the cell's geometry differs from `baseGeometry` (e.g. a size axis). */
  geometry?: ResolvedPlanGeometry;
}

export interface ResolvedPlanAxis {
  prop: string;
  values: string[];
  default: string;
}

export interface ResolvedComponentPlan {
  schemaVersion: typeof RESOLVED_PLAN_SCHEMA_VERSION;
  component: string;
  /** Sub-part `data-ui` names (compound components only); empty for simple components. */
  parts: string[];
  variantAxes: ResolvedPlanAxis[];
  /** cartesian(variantAxes), stable order; each cell carries its resolved binding. */
  variantMatrix: ResolvedPlanCell[];
  /** Row/column axis labels for the variant grid, or `null` when there's nothing to grid. */
  gridLabels: { rows: string[]; cols: string[] } | null;
  /** Geometry shared by every cell unless overridden per-cell. */
  baseGeometry: ResolvedPlanGeometry;
  partBindings?: Record<string, ResolvedPlanCell[]>;
  refusedPseudoParts?: Record<string, string>;
  refusedNegations?: Record<string, string>;
  /**
   * Margins the CSS declares that cannot be carried as a bound token (`auto`, negative, `calc()`,
   * a literal), keyed `<part> <property>`, mapped to the refused declaration and reason. Named,
   * not dropped: the release bar fails on one unless the part has a reviewed layout exclusion.
   * A child's `align-self` the parent cannot carry exactly is reported here too, as `<part> align-self`.
   */
  refusedMargins?: Record<string, string>;
  /**
   * Corners whose radius is computed (`calc()`/`min()`/`max()`/`clamp()`, or a variable that only
   * resolves through one) and so cannot bind a single variable: keyed `<part> border-radius`,
   * mapped to the CSS and the fallback. Each is bound to the brand's default radius
   * (`radius/default`), consistently, rather than left square. Absent when no corner needed it.
   * A diagnostic, not a refusal: the corner is bound.
   */
  radiusFallbacks?: Record<string, string>;
  composedChildOverrides?: Record<string, ComposedChildOverrideCell[]>;
  /**
   * A descendant rule matched against a composed child that named a property
   * outside the bindable override vocabulary (radius/stroke/fill/effect), an
   * unresolvable radius value, or a positional pseudo richer than this
   * resolver understands — reported here (never silently dropped), same
   * "name it, don't drop it" contract as `refusedNegations`/
   * `refusedPseudoParts` above. `packages/ui/scripts/figma-coverage.ts` prints
   * this as REFUSED DESCENDANT OVERRIDES.
   */
  refusedDescendantOverrides?: Record<string, string>;
}

/** Re-exported so callers of `ResolvedComponentPlan` don't need a second import from `../registry/resolver`. */
export type {
  ComposedChildOverrideBinding,
  ComposedChildOverrideCell,
  ComposedChildRadiusValue,
} from "../registry/resolver";

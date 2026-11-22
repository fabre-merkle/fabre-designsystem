/**
 * Fixed first-wave icon whitelist for walker materialization (T2-3/T2-4).
 * Keys are the icon names carried in `ResolvedPlanCell.iconName`.
 * Values are the matching `@phosphor-icons/core` asset basenames. A basename
 * ending in `-fill` is read from the `fill` weight (the `weight="fill"` glyph a
 * component renders, e.g. Alert's intent icons); every other basename is read
 * from the `regular` weight.
 */
export const PHOSPHOR_ICON_WHITELIST = {
  CaretDown: "caret-down",
  CaretRight: "caret-right",
  Check: "check",
  CheckCircleFill: "check-circle-fill",
  InfoFill: "info-fill",
  Minus: "minus",
  WarningCircleFill: "warning-circle-fill",
  WarningFill: "warning-fill",
} as const;

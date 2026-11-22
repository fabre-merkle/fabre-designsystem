/**
 * Components intentionally outside the Figma coverage contract.
 *
 * Keep every exception documented. The coverage gate treats an unlisted UI
 * component as a regression until it receives a resolvable registry entry.
 *
 * An entry here means "no contract authored yet", NOT "cannot resolve" — a
 * component whose paint lives entirely on sub-parts resolves fine and belongs in
 * COVERAGE_REGISTRY (see the partBindings note in coverage-gate.test.ts). The two
 * lists are mutually exclusive and must together cover every component directory.
 */
export interface CoverageExclusion {
  reason: string;
}

export type CoverageExcludeMap = Record<string, CoverageExclusion>;

export const COVERAGE_EXCLUDE: CoverageExcludeMap = {
  control: {
    reason:
      "Shared Control stylesheet (touch-target height override) imported by each Control; it is not a component.",
  },
  "surface-provider": {
    reason: "Context provider only; it has no visual output or co-located stylesheet.",
  },
  "web-grid": {
    reason:
      "Layout utility with no paint and no Figma form; its stylesheet is a CSS grid on the web layer's grid tokens, including a container query the resolver does not read.",
  },
};

/** Reject malformed exceptions rather than silently treating them as covered. */
export function assertCoverageExclusions(value: unknown): asserts value is CoverageExcludeMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("COVERAGE_EXCLUDE must be an object keyed by component directory.");
  }

  for (const [component, exclusion] of Object.entries(value)) {
    if (component.trim().length === 0) {
      throw new Error("COVERAGE_EXCLUDE cannot contain an empty component directory.");
    }
    if (
      typeof exclusion !== "object" ||
      exclusion === null ||
      Array.isArray(exclusion) ||
      typeof (exclusion as { reason?: unknown }).reason !== "string" ||
      (exclusion as { reason: string }).reason.trim().length === 0
    ) {
      throw new Error(
        `COVERAGE_EXCLUDE["${component}"] must be an object with a non-empty reason string.`,
      );
    }
  }
}

export function coverageExclusionFor(component: string): CoverageExclusion | undefined {
  assertCoverageExclusions(COVERAGE_EXCLUDE);
  return COVERAGE_EXCLUDE[component];
}

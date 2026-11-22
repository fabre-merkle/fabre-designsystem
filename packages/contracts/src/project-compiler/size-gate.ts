/**
 * The sized-parts gate. A part whose width or height the compiler could not resolve is recorded in
 * the artifact as `unsupported`; the Figma plugin then refuses to size it and the shape keeps
 * Figma's creation default of 100 x 100. That must be a named failure at compile time, not a
 * surprise in the design file.
 *
 * Hug-sized and fill-sized parts are never reported: only a size the stylesheet states and the
 * compiler could not turn into a number, a variable or a fill.
 */
import { RefusalError, sizeUnderdeterminedDiagnostic } from "../generation-contract/diagnostics";
import type {
  ResolvedComponentPlan,
  ResolvedDimension,
  ResolvedPlanGeometry,
} from "../resolved-plan";

export interface UnsizedPartFinding {
  component: string;
  part: string;
  property: "width" | "height";
  value: string;
}

interface PlanHolder {
  resolvedPlan: ResolvedComponentPlan;
  contract: { rootPart: string };
}

function refused(dimension: ResolvedDimension | undefined): string | undefined {
  return dimension?.kind === "unsupported" ? dimension.value : undefined;
}

function geometryFindings(
  component: string,
  part: string,
  geometry: ResolvedPlanGeometry | undefined,
  seen: Set<string>,
  into: UnsizedPartFinding[],
): void {
  if (!geometry) return;
  for (const property of ["width", "height"] as const) {
    const value = refused(geometry[property]);
    if (value === undefined) continue;
    const key = `${part}\0${property}\0${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    into.push({ component, part, property, value });
  }
}

/** Every part of every component whose width or height is stated but unresolved. */
export function unsizedPartFindings(components: readonly PlanHolder[]): UnsizedPartFinding[] {
  const findings: UnsizedPartFinding[] = [];
  for (const { resolvedPlan: plan, contract } of components) {
    const seen = new Set<string>();
    geometryFindings(plan.component, contract.rootPart, plan.baseGeometry, seen, findings);
    for (const [part, cells] of Object.entries(plan.partBindings ?? {})) {
      for (const cell of cells)
        geometryFindings(plan.component, part, cell.geometry, seen, findings);
    }
    for (const cell of plan.variantMatrix ?? []) {
      geometryFindings(plan.component, contract.rootPart, cell.geometry, seen, findings);
    }
  }
  return findings;
}

/** Throws one refusal naming every unsized part and property, with the remedy. */
export function assertPartsSized(components: readonly PlanHolder[]): void {
  const findings = unsizedPartFindings(components);
  if (findings.length === 0) return;
  const lines = findings.map(
    (finding) =>
      `  ${finding.component}: part "${finding.part}" ${finding.property} is unresolved (${finding.value})`,
  );
  throw new RefusalError(
    "These parts would render at Figma's 100 x 100 default because their size could not be " +
      `resolved:\n${lines.join("\n")}\n` +
      "Check that your DTCG token folder holds every token the stylesheet references, or declare " +
      "the part's size in figma-layout.config.ts.",
    findings.map(sizeUnderdeterminedDiagnostic),
  );
}

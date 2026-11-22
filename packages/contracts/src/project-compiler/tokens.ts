/**
 * The token facts the resolver needs, read from a folder of raw DTCG token sets (the output of a
 * Tokens Studio raw pull): how each Figma variable name is spelled, which custom properties are
 * design tokens at all, and the numeric (px) value of every number token.
 *
 * The same functions serve the repository's own build and the compiler a project installs, so the
 * two environments cannot read tokens differently.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeVariableName } from "../registry/resolver";
import { loadDtcgModel, loadDtcgVariableNames } from "../variables/dtcg-model";
import type { TokenVariable } from "../variables/types";
import { MissingPrerequisiteError } from "./prerequisites";

const MAX_ALIAS_HOPS = 5;

/**
 * `normalizeVariableName(name) → name` for every variable name the DTCG defines. Throws when two
 * different spellings fold to the same key: the resolver could only pick one of them.
 */
export function loadVariableNameMap(dtcgDir: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of loadDtcgVariableNames(dtcgDir)) {
    const key = normalizeVariableName(name);
    const existing = map.get(key);
    if (existing && existing !== name) {
      throw new Error(
        `DTCG variables "${existing}" and "${name}" fold to the same name; the contract ` +
          "build cannot tell which one a CSS custom property means.",
      );
    }
    map.set(key, name);
  }
  return map;
}

function firstMode(variable: TokenVariable) {
  return variable.valuesByMode.default ?? Object.values(variable.valuesByMode)[0];
}

function resolveFloat(
  name: string,
  byName: Map<string, TokenVariable>,
  hop = 0,
): number | undefined {
  if (hop > MAX_ALIAS_HOPS) return undefined;
  const variable = byName.get(name);
  const mode = variable && firstMode(variable);
  if (!mode) return undefined;
  if (mode.kind === "float") return mode.value;
  if (mode.kind === "alias") return resolveFloat(mode.targetVar, byName, hop + 1);
  return undefined;
}

/**
 * `normalizeVariableName(custom property name without dashes) → px` for every number token that
 * resolves, following a bounded number of alias hops.
 */
export function loadTokenPxValues(
  dtcgDir: string,
  load: typeof loadDtcgModel = loadDtcgModel,
): Map<string, number> {
  const { model } = load(dtcgDir);
  const byName = new Map<string, TokenVariable>();
  for (const collection of model.collections) {
    for (const variable of collection.variables) {
      if (!byName.has(variable.name)) byName.set(variable.name, variable);
    }
  }
  const result = new Map<string, number>();
  for (const name of byName.keys()) {
    const value = resolveFloat(name, byName);
    if (value !== undefined) result.set(normalizeVariableName(name.replace(/\//g, "-")), value);
  }
  return result;
}

export interface ProjectTokens {
  variableNames: Map<string, string>;
  pxValues: Map<string, number>;
}

/**
 * Reads the project's DTCG folder. A missing or empty folder is refused with the remedy, never
 * degraded: without token values a size written as `calc()` cannot be resolved.
 */
export function loadProjectTokens(dtcgDir: string, displayDir: string = dtcgDir): ProjectTokens {
  if (!existsSync(join(dtcgDir, "$metadata.json"))) {
    throw new MissingPrerequisiteError(
      `No DTCG token sets in ${displayDir} (no $metadata.json). The compiler reads token values ` +
        "from the raw token export of your Tokens Studio project: run `bun --cwd packages/tokens run tokens:pull`, or " +
        "install the default theme's raw token item, or point `tokensDir` in contracts.config.ts " +
        "at the folder that holds them.",
      "tokens-missing",
      displayDir,
    );
  }
  const unreadable = (reason: string) =>
    new MissingPrerequisiteError(
      `The token sets in ${displayDir} cannot be read: ${reason}. Re-run the raw token pull, or ` +
        "point `tokensDir` in contracts.config.ts at a folder with a valid $metadata.json.",
      "tokens-missing",
      displayDir,
    );
  let metadata: unknown;
  try {
    metadata = JSON.parse(readFileSync(join(dtcgDir, "$metadata.json"), "utf8"));
  } catch (error) {
    throw unreadable(`$metadata.json is not valid JSON (${(error as Error).message})`);
  }
  const order = (metadata as { tokenSetOrder?: unknown } | null)?.tokenSetOrder;
  if (!Array.isArray(order) || order.some((entry) => typeof entry !== "string")) {
    throw unreadable("$metadata.json must hold a tokenSetOrder array of set names");
  }
  let variableNames: Map<string, string>;
  let pxValues: Map<string, number>;
  try {
    variableNames = loadVariableNameMap(dtcgDir);
    pxValues = loadTokenPxValues(dtcgDir);
  } catch (error) {
    throw unreadable((error as Error).message);
  }
  // Number tokens may be absent from a colour-only export: that is for the size gate to judge,
  // part by part, not a reason to refuse the whole project here.
  if (variableNames.size === 0) {
    throw new MissingPrerequisiteError(
      `${displayDir} holds no usable tokens. Re-run the raw token pull and check the token sets ` +
        "listed in $metadata.json exist.",
      "tokens-missing",
      displayDir,
    );
  }
  return { variableNames, pxValues };
}

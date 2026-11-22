/**
 * The package manifest: which base contract schema this copy of the package started from.
 *
 * A project owns its copy of the schema (it is editable source). The manifest records the base
 * schema version the package shipped with and a hash of that schema's JSON Schema, so a copy that
 * has since been edited can be told apart from the base: recompute the hash from the project's
 * own schema and compare it with the recorded one.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { authoredFigmaContractJsonSchema } from "../generation-contract/authored-schema";

/** The base contract schema version. Bump it when the authored schema changes meaning. */
export const BASE_SCHEMA_VERSION = "1.1.0";

export const MANIFEST_FILE = "contracts.manifest.json";

export interface ContractsManifest {
  baseSchemaVersion: string;
  /** `sha256:<hex>` of `canonicalJson(<JSON Schema of the authored contract>)`. */
  schemaHash: string;
}

/** JSON with object keys sorted at every depth, so the hash ignores key order and whitespace. */
export function canonicalJson(value: unknown): string {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, v]) => [key, sort(v)]),
      );
    }
    return input;
  };
  return JSON.stringify(sort(value));
}

/** Hashes a JSON Schema in canonical form, so equal schemas hash equally. */
export function hashSchema(jsonSchema: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(jsonSchema)).digest("hex")}`;
}

/** The hash of the schema this copy of the package currently defines. */
export function currentSchemaHash(): string {
  return hashSchema(authoredFigmaContractJsonSchema());
}

/** Builds the manifest recording the schema version and hash this package defines. */
export function buildManifest(): ContractsManifest {
  return { baseSchemaVersion: BASE_SCHEMA_VERSION, schemaHash: currentSchemaHash() };
}

/** Reads a package's manifest, or `undefined` when it has none. */
export function readManifest(packageDir: string): ContractsManifest | undefined {
  const path = join(packageDir, MANIFEST_FILE);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as ContractsManifest;
}

export interface SchemaDeviation {
  /** True when this copy's schema no longer hashes to the one the package shipped with. */
  deviated: boolean;
  baseSchemaVersion: string;
  expected: string;
  actual: string;
}

/** Compares the schema in this copy of the package with the hash recorded in its manifest. */
export function schemaDeviation(packageDir: string): SchemaDeviation | undefined {
  const manifest = readManifest(packageDir);
  if (!manifest) return undefined;
  const actual = currentSchemaHash();
  return {
    deviated: actual !== manifest.schemaHash,
    baseSchemaVersion: manifest.baseSchemaVersion,
    expected: manifest.schemaHash,
    actual,
  };
}

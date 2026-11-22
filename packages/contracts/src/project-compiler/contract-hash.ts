/**
 * A fingerprint of each normalized contract, for machines.
 *
 * The hash covers the contract exactly as the artifact embeds it (after normalization, with the
 * registry description stamped in), serialized with sorted keys so it ignores key order and
 * whitespace. It is reported next to the compiler's output and in `list`, and is never written
 * into the artifact: the artifact format is frozen for each plugin release.
 *
 * Two copies of a contract with the same hash compile to the same contract. A different hash says
 * the contract changed, not by how much; `contract-versions.ts` grades the change.
 */
import { createHash } from "node:crypto";
import { canonicalJson } from "./manifest";

/** `sha256:<hex>` of the canonical JSON of one normalized contract. */
export function contractHash(contract: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(contract)).digest("hex")}`;
}

/** The hash of each compiled component's contract, keyed by slug, in artifact order. */
export function contractHashes(
  components: ReadonlyArray<{ contract: { slug: string } }>,
): Record<string, string> {
  return Object.fromEntries(
    components.map((component) => [component.contract.slug, contractHash(component.contract)]),
  );
}

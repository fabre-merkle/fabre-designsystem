import { deriveMapping } from "./derive";
import { serializeMapping } from "./serialize";

/** One-shot: derive a mapping from the contract, code props and manifest, then serialize it. */
export function generateCodeConnect(input: Parameters<typeof deriveMapping>[0]): string {
  return serializeMapping(deriveMapping(input));
}

/**
 * Where a contract's code lives. Most contracts own a folder named by their slug and export a
 * component named `componentName`. A part contract (`source: { slug: "field" }`) has no folder of
 * its own: it lives in its source component's folder, and its code is a member of that component's
 * namespace export (`FieldLabel` is `Field.Label`).
 */

/** The slice of a contract the mapping reads. */
export interface ContractSourceRef {
  slug: string;
  componentName: string;
  source?: { slug: string };
}

/** The folder, export and optional namespace member that hold a contract's component. */
export interface CodeSource {
  /** Folder under the components directory. */
  dir: string;
  /** Name exported from the folder's `index.ts`. */
  exportName: string;
  /** The property of the export that is the component, for a part contract (`Label`). */
  member?: string;
}

/**
 * Resolves where a contract's component code lives, mapping a part contract to a member of its
 * source component's namespace export. Throws when the source component is missing or the name
 * does not extend it.
 */
export function codeSourceFor(
  contract: ContractSourceRef,
  all: readonly ContractSourceRef[],
): CodeSource {
  if (!contract.source) {
    return { dir: contract.slug, exportName: contract.componentName };
  }
  const owner = all.find((c) => c.slug === contract.source?.slug);
  if (!owner) {
    throw new Error(
      `"${contract.slug}" is a part of "${contract.source.slug}", which is not in the contract artifact.`,
    );
  }
  const { componentName } = contract;
  const prefix = owner.componentName;
  const member = componentName.slice(prefix.length);
  if (!componentName.startsWith(prefix) || member === "") {
    throw new Error(
      `Cannot map "${componentName}" to a member of "${prefix}" (from "${contract.slug}"): its name must start with "${prefix}" followed by the member name.`,
    );
  }
  return { dir: owner.slug, exportName: prefix, member };
}

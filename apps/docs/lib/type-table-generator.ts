import path from "node:path";
import {
  createGenerator,
  type GeneratedDoc,
  type GenerateOptions,
  type Generator,
} from "fumadocs-typescript";

/**
 * Generator behind `<AutoTypeTable>`. Component pages point it at a component's props type, for
 * example `path="badge/badge.tsx" name="BadgeProps"`, and the table is read from the source: the
 * prop names, types, JSDoc descriptions and `@default` tags.
 *
 * Component props are `React.ComponentProps<"span"> & { ... }` or a Base UI part's props, so the
 * raw type carries hundreds of native element props. The wrapper keeps the props the component's
 * own source declares, plus the Base UI props that set what the component does (`value`,
 * `onValueChange`, `open`, `multiple` and so on), in the main table. It hides props from
 * `@types/react` and the TypeScript lib (native attributes). Generic Base UI rendering props
 * (`className`, `render`, `style`, `nativeButton`, `focusableWhenDisabled`) are kept but tagged
 * `docsBaseUI`, so the page and the Markdown form show them in a collapsed "Base UI props" group.
 * The split is by declaration site and a short name set, never a list per page. The build snapshot
 * (`scripts/generate-prop-tables.mts`) calls this same generator.
 */

/** Where `path` is resolved from. */
export const COMPONENTS_DIR = path.join(process.cwd(), "..", "..", "packages/ui/src/components");

const HIDDEN_TAG = "docsHidden";
/** Marks a generic Base UI rendering prop, shown in the collapsed "Base UI props" group. */
export const BASE_UI_TAG = "docsBaseUI";

/**
 * Generic Base UI props by name. Base UI declares `className`, `render` and `style` in its shared
 * `BaseUIComponentProps` and `nativeButton` in `NativeButtonProps`; anything declared in those
 * shared files is caught by declaration site. The names cover props the TypeScript program resolves
 * to a per-component file, and `focusableWhenDisabled`, which every button-like part repeats.
 */
const GENERIC_BASE_UI_NAMES = new Set(["className", "render", "style", "focusableWhenDisabled"]);

/** Readable types for the generic props, where the generator prints `union`. */
const GENERIC_TYPE_LABELS: Record<string, string> = {
  className: "string | ((state) => string)",
  render: "ReactElement | ((props, state) => ReactElement)",
  style: "CSSProperties | ((state) => CSSProperties)",
};

const isBaseUIFile = (file: string) => file.includes("/@base-ui/");
/** Declared in Base UI's shared types (`internals/types`: `BaseUIComponentProps`, `NativeButtonProps`). */
const isBaseUISharedFile = (file: string) =>
  isBaseUIFile(file) && /\/(?:internals|types|utils)\//.test(file);

const base = createGenerator();

type GenerateTypeTable = Generator["generateTypeTable"];

/** Unions longer than this fall back to the generator's own short form (`union`). */
const MAX_LITERAL_MEMBERS = 8;

/**
 * Show a union of literals as its values (`"sm" | "md" | "lg"`) instead of the word `union`, which
 * is what the generator prints and what the hand-written tables never did. Anything that is not a
 * short union of literals keeps the generator's own form.
 */
const literalUnions: NonNullable<GenerateOptions["typeSimplifier"]>["override"] = ({
  type,
  checker,
  location,
}) => {
  const members = (type as { getTypes?: () => unknown[] }).getTypes?.() as
    | (typeof type)[]
    | undefined;
  if (!members) return undefined;
  const parts = [...new Set(members.map((member) => checker.typeToString(member, location, 0)))];
  const defined = parts.filter((part) => part !== "undefined");
  if (defined.length === 0 || defined.length > MAX_LITERAL_MEMBERS) return undefined;
  if (!defined.every((part) => /^(?:"[^"]*"|-?\d+(?:\.\d+)?|true|false)$/.test(part))) {
    return undefined;
  }
  if (defined.length === 2 && defined.includes("true") && defined.includes("false"))
    return "boolean";
  return defined.join(" | ");
};

const generateTypeTable: GenerateTypeTable = async (props, options) => {
  const docs = await base.generateTypeTable(props, {
    ...options,
    typeSimplifier: { override: literalUnions, ...options?.typeSimplifier },
    basePath: options?.basePath ?? COMPONENTS_DIR,
    transform(entry, type, prop) {
      const file = String((prop.declarations?.[0] as { path?: string } | undefined)?.path ?? "");
      if (file.includes("/@types/react/") || file.includes("/typescript/lib/")) {
        entry.tags.push({ name: HIDDEN_TAG, text: "" });
      } else if (
        isBaseUIFile(file) &&
        (isBaseUISharedFile(file) || GENERIC_BASE_UI_NAMES.has(entry.name))
      ) {
        entry.tags.push({ name: BASE_UI_TAG, text: "" });
        const label = GENERIC_TYPE_LABELS[entry.name];
        if (label) entry.simplifiedType = label;
      }
      options?.transform?.call(this, entry, type, prop);
    },
  });
  return docs.map((doc) => ({
    ...doc,
    entries: doc.entries.filter((entry) => !entry.tags.some((tag) => tag.name === HIDDEN_TAG)),
  }));
};

export const typeTableGenerator: Generator = { ...base, generateTypeTable };

/** Whether an entry belongs to the collapsed "Base UI props" group. */
export function isBaseUIEntry(entry: { tags: { name: string }[] }): boolean {
  return entry.tags.some((tag) => tag.name === BASE_UI_TAG);
}

/** The entries of one group. The Base UI group's id is suffixed, so the page's two tables differ. */
export function selectGroup(docs: GeneratedDoc[], group: "main" | "baseUI"): GeneratedDoc[] {
  return docs.map((doc) => ({
    ...doc,
    id: group === "baseUI" ? `${doc.id}-base-ui` : doc.id,
    entries: doc.entries.filter((entry) => isBaseUIEntry(entry) === (group === "baseUI")),
  }));
}

/** The generator restricted to one group, so each group renders with the stock table. */
export function groupGenerator(group: "main" | "baseUI"): Generator {
  return {
    ...typeTableGenerator,
    async generateTypeTable(props, options) {
      return selectGroup(await generateTypeTable(props, options), group);
    },
  };
}

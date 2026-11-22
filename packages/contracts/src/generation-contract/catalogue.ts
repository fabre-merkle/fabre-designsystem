/**
 * The component catalogue: a flat, agent-readable summary of every compiled contract.
 *
 * Agents need one structured answer to "which components exist, what are their axes and slots, and
 * what can go in each slot". The contracts hold it, but as a large artifact written for the Figma
 * plugin. The compiler derives this smaller document from the same normalized contracts in the same
 * run, so it can never disagree with the artifact, and it is a separate output: the artifact format
 * does not change.
 *
 * Two inputs, kept apart on purpose:
 *
 * - Facts come from the contracts: slugs, axes and their values, slots and what fills them, the
 *   part tree, and which components compose which. Nothing here is authored by hand.
 * - Guidance comes from an authored sidecar (`.agents/component-guidance.json`): when to use a
 *   component, when not to, what it pairs with, whether it is deprecated and what replaces it.
 *   Guidance is judgement, not contract vocabulary, so it lives outside the contracts and is merged
 *   into the output by slug.
 *
 * Pure module: no file access, so it runs in the compiler and in a documentation app alike.
 */
import { z } from "zod";
import { buildingBlockSetName } from "./component-sets";
import { diagnostic, diagnosticPath, RefusalError } from "./diagnostics";
import type {
  FigmaGenerationContract,
  GenerationContractAnatomyNode,
  GenerationContractNodeKind,
} from "./types";

/** Where the compiler writes the catalogue, relative to the workspace root. */
export const CATALOGUE_PATH = ".agents/component-catalogue.json";

/** Where the compiler reads the authored guidance, relative to the workspace root. Optional. */
export const GUIDANCE_PATH = ".agents/component-guidance.json";

/** The shape version of the catalogue and of the guidance file. Raise it when a field changes meaning. */
export const COMPONENT_CATALOGUE_VERSION = 1 as const;

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .meta({ description: "A component slug: lowercase letters, digits and hyphens." });

const text = (description: string) => z.string().min(1).meta({ description });
const slugList = (description: string) => z.array(slugSchema).min(1).meta({ description });

/**
 * Authored guidance for one component. Every field is optional; write only what you know to be
 * true. A slug in `pairsWith` or `alternatives` must be a component in the catalogue.
 */
export const componentGuidanceEntrySchema = z
  .strictObject({
    when: text("When to reach for this component, in one or two sentences."),
    avoidWhen: text("When another component or approach is the better choice."),
    pairsWith: slugList("Components that are commonly used together with this one."),
    deprecated: text(
      "Present when the component is deprecated; the text says why and what to do instead.",
    ),
    alternatives: slugList("Components to use instead of this one, or alongside it as options."),
  })
  .partial()
  .meta({ description: "Authored guidance for one component." });

/** The authored guidance sidecar: one file, guidance keyed by component slug. */
export const componentGuidanceSchema = z
  .strictObject({
    version: z
      .literal(COMPONENT_CATALOGUE_VERSION)
      .meta({ description: "The guidance file format version." }),
    components: z.record(slugSchema, componentGuidanceEntrySchema).meta({
      description: "Guidance keyed by component slug. Components without an entry have none.",
    }),
  })
  .meta({
    title: "ComponentGuidance",
    description:
      "Authored guidance merged into the component catalogue. The compiler reads it from .agents/component-guidance.json when the file exists.",
  });

export type ComponentGuidanceEntry = z.infer<typeof componentGuidanceEntrySchema>;
export type ComponentGuidance = z.infer<typeof componentGuidanceSchema>;

const axisSchema = z
  .strictObject({
    prop: z.string().meta({ description: "The component prop that carries the axis." }),
    values: z
      .array(z.string())
      .meta({ description: "Every value the axis can take, as declared by the component." }),
    default: z.string().meta({ description: "The value used when the prop is omitted." }),
    foldedValues: z.record(z.string(), z.record(z.string(), z.string())).optional().meta({
      description:
        "Values the code accepts that are not axis values of their own: each maps to the axis values it stands for (for example a button's icon-only sizes).",
    }),
  })
  .meta({ description: "One design axis of a component." });

/** What fills a slot. */
export const SLOT_ACCEPTS = ["text", "icon", "image", "component", "children", "content"] as const;

const slotSchema = z
  .strictObject({
    name: z.string().meta({ description: "The slot's name." }),
    part: z.string().meta({ description: "The part that renders the slot's content." }),
    required: z
      .literal(true)
      .optional()
      .meta({ description: "Present when the slot must be filled." }),
    codeProp: z.string().optional().meta({
      description:
        "The prop that receives the content in code, when it is not named after the slot.",
    }),
    accepts: z.enum(SLOT_ACCEPTS).meta({
      description:
        "What fills the slot: `text`, `icon` or `image` for a leaf part of that kind; `component` when its default content is an instance of another component (see `composedChild`); `children` for a region that holds arbitrary content; `content` for any other frame.",
    }),
    composedChild: z
      .strictObject({
        component: slugSchema.meta({
          description: "The component whose instance fills the slot by default.",
        }),
        variantKey: z
          .record(z.string(), z.string())
          .optional()
          .meta({ description: "The axis values of that default instance." }),
        variantKeyFromAxes: z.record(z.string(), z.string()).optional().meta({
          description:
            "Axes of that instance that follow the parent's variant, as `{ childAxis: parentAxis }`.",
        }),
      })
      .optional()
      .meta({
        description: "Set when the slot's default content is an instance of another component.",
      }),
  })
  .meta({ description: "A place in a component that takes content." });

const propertySchema = z
  .strictObject({
    name: z.string().meta({ description: "The Figma property name." }),
    type: z.enum(["text", "boolean", "instanceSwap"]).meta({
      description:
        "`text` sets the characters of a text part, `boolean` shows or hides a part, `instanceSwap` swaps an icon.",
    }),
    part: z.string().meta({ description: "The part the property is bound to." }),
    codeProp: z.string().optional().meta({
      description: "The prop that carries the value in code, when it has one.",
    }),
  })
  .meta({ description: "A component property: what is not a visual difference." });

const buildingBlockSchema = z
  .strictObject({
    part: z.string().meta({ description: "The part the block is generated from." }),
    name: z.string().meta({
      description: "The block's hidden set in Figma, `.Building Blocks/<Component>/<Part>`.",
    }),
    axes: z.array(z.string()).meta({ description: "The block's own axes: its states." }),
    split: z
      .strictObject({
        axis: z.union([z.string(), z.array(z.string())]).meta({
          description:
            "The block axis whose values each become one hidden set, or the axes whose value combinations each become one.",
        }),
      })
      .optional()
      .meta({
        description:
          "Set when the block generates one hidden set per value of its axes; each set's name puts the value before the label (`.Building Blocks/<Component>/<Value> <Part>`).",
      }),
  })
  .meta({
    description:
      "A sub-element with its own states, generated as a hidden set nested in the component.",
  });

const anatomyNodeSchema: z.ZodType<CatalogueAnatomyNode> = z
  .strictObject({
    part: z.string().meta({ description: "The part name." }),
    kind: z
      .enum(["frame", "text", "icon", "rectangle", "ellipse", "image"])
      .meta({ description: "What the part is drawn as." }),
    layout: z
      .enum(["horizontal", "vertical", "overlay"])
      .optional()
      .meta({ description: "How the part lays out its children." }),
    slots: z.array(z.string()).optional().meta({ description: "The slots this part renders." }),
    get children() {
      return z.array(anatomyNodeSchema).optional().meta({ description: "Child parts, in order." });
    },
  })
  .meta({ id: "CatalogueAnatomyNode", description: "One part in the component's part tree." });

/** One node of the part tree: structure only, with no bindings, geometry or icon data. */
export interface CatalogueAnatomyNode {
  part: string;
  kind: GenerationContractNodeKind;
  layout?: "horizontal" | "vertical" | "overlay";
  slots?: string[];
  children?: CatalogueAnatomyNode[];
}

const componentSchema = z
  .strictObject({
    slug: slugSchema,
    name: z.string().meta({ description: "The component's display name." }),
    description: z
      .string()
      .optional()
      .meta({ description: "One sentence on what the component is." }),
    hash: z.string().meta({
      description:
        "Fingerprint of the normalized contract. Two catalogues with the same hash describe the same contract.",
    }),
    partOf: slugSchema.optional().meta({
      description:
        "Set when this is a part of another component (a label, a legend): that component's slug.",
    }),
    rootPart: z.string().meta({ description: "The part the component's root is drawn as." }),
    parts: z.array(z.string()).meta({ description: "Every declared part." }),
    axes: z
      .array(axisSchema)
      .meta({ description: "The design axes, in the order the contract declares them." }),
    slots: z
      .array(slotSchema)
      .meta({ description: "The content slots, in the order the contract declares them." }),
    properties: z.array(propertySchema).optional().meta({
      description:
        "The component properties (text, boolean, instance swap), in the order the contract declares them. Absent when the component has none.",
    }),
    split: z
      .strictObject({
        axis: z.union([z.string(), z.array(z.string())]).meta({
          description:
            "The axis whose values each become one set, or the axes whose value combinations each become one.",
        }),
      })
      .optional()
      .meta({
        description:
          "Set when the component generates one component set per value of an axis, instead of one set holding every variant.",
      }),
    capReason: z.string().optional().meta({
      description:
        "The contract's written reason for a component set to hold more than the 30 variants Figma's library guidance allows.",
    }),
    buildingBlocks: z.array(buildingBlockSchema).optional().meta({
      description: "The component's Building Blocks, in the order the contract declares them.",
    }),
    anatomy: anatomyNodeSchema.optional().meta({ description: "The part tree." }),
    guidance: componentGuidanceEntrySchema.optional().meta({
      description: "Authored guidance from the sidecar, when the component has an entry.",
    }),
  })
  .meta({ description: "One component." });

const edgeSchema = z
  .strictObject({
    parent: slugSchema.meta({ description: "The component that composes the other." }),
    slot: z.string().meta({ description: "The parent's slot that holds the child." }),
    child: slugSchema.meta({ description: "The composed component." }),
  })
  .meta({
    description:
      "One composition edge: the parent's slot is filled with an instance of the child by default.",
  });

/** The catalogue document. */
export const componentCatalogueSchema = z
  .strictObject({
    artifact: z.literal("component-catalogue").meta({ description: "Identifies the document." }),
    version: z
      .literal(COMPONENT_CATALOGUE_VERSION)
      .meta({ description: "The catalogue format version." }),
    components: z
      .array(componentSchema)
      .meta({ description: "Every contracted component, sorted by slug." }),
    composition: z
      .array(edgeSchema)
      .meta({ description: "Which components compose which, sorted by parent, slot, then child." }),
  })
  .meta({
    title: "ComponentCatalogue",
    description:
      "A flat summary of every compiled contract, generated by the compiler and never edited by hand.",
  });

export type ComponentCatalogue = z.infer<typeof componentCatalogueSchema>;
export type CatalogueComponent = ComponentCatalogue["components"][number];
export type CatalogueSlot = CatalogueComponent["slots"][number];
export type CompositionEdge = ComponentCatalogue["composition"][number];

/** The JSON Schema of the catalogue document, for editors, agents and the generated reference. */
export function componentCatalogueJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(componentCatalogueSchema, { target: "draft-2020-12" }) as Record<
    string,
    unknown
  >;
}

/** The JSON Schema of the guidance sidecar, for editors, agents and the generated reference. */
export function componentGuidanceJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(componentGuidanceSchema, { target: "draft-2020-12" }) as Record<
    string,
    unknown
  >;
}

/**
 * Checks guidance that has already been parsed as JSON and returns it typed. A refusal names every
 * field that does not match the format.
 */
export function parseComponentGuidance(raw: unknown, file = GUIDANCE_PATH): ComponentGuidance {
  const result = componentGuidanceSchema.safeParse(raw);
  if (result.success) return result.data;
  const issues = result.error.issues.slice(0, 50);
  const diagnostics = issues.map((issue) =>
    diagnostic(
      "guidance-invalid",
      `${file}: ${issue.path.join(".") || "(file)"}: ${issue.message}`,
      diagnosticPath(
        file,
        issue.path.filter((segment): segment is string | number => typeof segment !== "symbol"),
      ),
    ),
  );
  throw new RefusalError(diagnostics.map((item) => item.message).join("\n"), diagnostics);
}

/** Parses the text of the guidance file: JSON first, then the format. */
export function parseComponentGuidanceText(
  source: string,
  file = GUIDANCE_PATH,
): ComponentGuidance {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    const message = `${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`;
    throw new RefusalError(message, [diagnostic("guidance-invalid", message, file)]);
  }
  return parseComponentGuidance(raw, file);
}

/** The first anatomy node, depth first, that renders `part`. */
function findNode(
  node: GenerationContractAnatomyNode | undefined,
  part: string,
): GenerationContractAnatomyNode | undefined {
  if (!node) return undefined;
  if (node.part === part) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, part);
    if (found) return found;
  }
  return undefined;
}

/** The part tree reduced to structure: what each part is, how it lays out and which slots it renders. */
function summarizeAnatomy(node: GenerationContractAnatomyNode): CatalogueAnatomyNode {
  return {
    part: node.part,
    kind: node.kind,
    ...(node.layout ? { layout: node.layout } : {}),
    ...(node.slots?.length ? { slots: [...node.slots] } : {}),
    ...(node.children?.length ? { children: node.children.map(summarizeAnatomy) } : {}),
  };
}

/** What fills a slot, read from the contract: its composed child, its content region, or its part's kind. */
function slotAccepts(
  slot: NonNullable<FigmaGenerationContract["slots"]>[number],
  anatomy: GenerationContractAnatomyNode | undefined,
): CatalogueSlot["accepts"] {
  if (slot.composedChild) return "component";
  if (slot.defaultContent === "anatomy") return "children";
  const kind = findNode(anatomy, slot.part)?.kind;
  return kind === "text" || kind === "icon" || kind === "image" ? kind : "content";
}

/** One compiled contract as a catalogue component, without guidance. */
function catalogueComponent(contract: FigmaGenerationContract, hash: string): CatalogueComponent {
  return {
    slug: contract.slug,
    name: contract.componentName,
    ...(contract.description ? { description: contract.description } : {}),
    hash,
    ...(contract.source ? { partOf: contract.source.slug } : {}),
    rootPart: contract.rootPart,
    parts: [...contract.parts],
    axes: contract.axes.map((axis) => ({
      prop: axis.prop,
      values: [...axis.values],
      default: axis.default,
      ...(axis.foldedValues
        ? {
            foldedValues: structuredClone(axis.foldedValues) as Record<
              string,
              Record<string, string>
            >,
          }
        : {}),
    })),
    slots: (contract.slots ?? []).map((slot) => ({
      name: slot.name,
      part: slot.part,
      ...(slot.required ? { required: true as const } : {}),
      ...(slot.codeProp ? { codeProp: slot.codeProp } : {}),
      accepts: slotAccepts(slot, contract.anatomy),
      ...(slot.composedChild
        ? {
            composedChild: {
              component: slot.composedChild.component,
              ...(slot.composedChild.variantKey
                ? { variantKey: { ...slot.composedChild.variantKey } }
                : {}),
              ...(slot.composedChild.variantKeyFromAxes
                ? { variantKeyFromAxes: { ...slot.composedChild.variantKeyFromAxes } }
                : {}),
            },
          }
        : {}),
    })),
    ...(contract.properties?.length
      ? {
          properties: contract.properties.map((property) => ({
            name: property.name,
            type: property.type,
            part: property.part,
            ...(property.codeProp ? { codeProp: property.codeProp } : {}),
          })),
        }
      : {}),
    ...(contract.split ? { split: { axis: structuredClone(contract.split.axis) } } : {}),
    ...(contract.capReason ? { capReason: contract.capReason } : {}),
    ...(contract.buildingBlocks?.length
      ? {
          buildingBlocks: contract.buildingBlocks.map((block) => ({
            part: block.part,
            name: buildingBlockSetName(contract, block),
            axes: block.axes.map((axis) => axis.prop),
            ...(block.split ? { split: { axis: structuredClone(block.split.axis) } } : {}),
          })),
        }
      : {}),
    ...(contract.anatomy ? { anatomy: summarizeAnatomy(contract.anatomy) } : {}),
  };
}

const bySlug = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Refuses guidance that names a component the catalogue does not have: an entry for a slug with no
 * contract, or a `pairsWith` or `alternatives` link to one. A stale entry would otherwise sit in the
 * file unnoticed after a component is renamed or removed.
 */
function checkGuidanceSlugs(guidance: ComponentGuidance, known: ReadonlySet<string>): void {
  const diagnostics = [];
  for (const [slug, entry] of Object.entries(guidance.components)) {
    if (!known.has(slug)) {
      diagnostics.push(
        diagnostic(
          "guidance-unknown-component",
          `${GUIDANCE_PATH} has guidance for "${slug}", which is not a contracted component.`,
          diagnosticPath(GUIDANCE_PATH, ["components", slug]),
        ),
      );
      continue;
    }
    for (const field of ["pairsWith", "alternatives"] as const) {
      for (const [index, target] of (entry[field] ?? []).entries()) {
        if (known.has(target)) continue;
        diagnostics.push(
          diagnostic(
            "guidance-unknown-component",
            `${GUIDANCE_PATH}: "${slug}" ${field} names "${target}", which is not a contracted component.`,
            diagnosticPath(GUIDANCE_PATH, ["components", slug, field, index]),
          ),
        );
      }
    }
  }
  if (diagnostics.length > 0) {
    throw new RefusalError(diagnostics.map((item) => item.message).join("\n"), diagnostics);
  }
}

export interface BuildCatalogueInput {
  /** Each compiled contract with its fingerprint (see `contractHashes`). */
  components: ReadonlyArray<{ contract: FigmaGenerationContract; hash: string }>;
  /** The parsed guidance sidecar, when the project has one. */
  guidance?: ComponentGuidance;
}

/**
 * Builds the catalogue from compiled contracts and optional guidance. Components are sorted by slug
 * and composition edges by parent, slot and child, so the output depends only on the contracts, not
 * on the order they were discovered in. Throws a refusal when guidance names an unknown component.
 */
export function buildComponentCatalogue(input: BuildCatalogueInput): ComponentCatalogue {
  const known = new Set(input.components.map(({ contract }) => contract.slug));
  if (input.guidance) checkGuidanceSlugs(input.guidance, known);
  const components = input.components
    .map(({ contract, hash }) => {
      const component = catalogueComponent(contract, hash);
      const guidance = input.guidance?.components[contract.slug];
      return guidance && Object.keys(guidance).length > 0 ? { ...component, guidance } : component;
    })
    .sort((a, b) => bySlug(a.slug, b.slug));
  const composition = components
    .flatMap((component) =>
      component.slots.flatMap((slot) =>
        slot.composedChild
          ? [{ parent: component.slug, slot: slot.name, child: slot.composedChild.component }]
          : [],
      ),
    )
    .sort(
      (a, b) => bySlug(a.parent, b.parent) || bySlug(a.slot, b.slot) || bySlug(a.child, b.child),
    );
  return {
    artifact: "component-catalogue",
    version: COMPONENT_CATALOGUE_VERSION,
    components,
    composition,
  };
}

/** The catalogue as the exact text written to disk: pretty-printed JSON with a trailing newline. */
export function serializeComponentCatalogue(catalogue: ComponentCatalogue): string {
  return `${JSON.stringify(catalogue, null, 2)}\n`;
}

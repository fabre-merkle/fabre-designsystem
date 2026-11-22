import { z } from "zod";
import { diagnostic, diagnosticPath, RefusalError } from "./diagnostics";
import {
  type AuthoredGenerationContract,
  DOCS_LAYOUT_GAP_TOKEN_RE,
  OMITTED_PART_KINDS,
} from "./types";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

const nodeKind = z
  .enum(["frame", "text", "icon", "rectangle", "ellipse", "image"])
  .meta({ description: "The Figma node this part materializes as." });

const layout = z.enum(["horizontal", "vertical", "overlay"]).meta({
  description:
    "Auto-layout direction of a frame, or `overlay` for children stacked over one another (not flowed).",
});

const crossAlign = z.enum(["start", "center", "end", "stretch"]).meta({
  description: "Anchor on one axis of the parent: an edge, the centre, or spanning the parent.",
});

const bindingRole = z.enum(["fill", "text", "stroke", "textStyle", "effectStyle"]);

/** Schema for a map from an axis's values to an entry, keyed by the axis it reads. */
const axisValueMap = <T extends z.ZodType>(value: T, description: string) =>
  z
    .strictObject({
      axis: z.string().meta({ description: "The declared axis whose value selects the entry." }),
      values: z.record(z.string(), value).meta({
        description: "Axis value to resolved value. Unlisted values fall back to the plain field.",
      }),
    })
    .meta({ description });

/** Schema for a variant condition: axis name to one value or a non-empty list of values. */
const variantMatch = (description: string) =>
  z.record(z.string(), z.union([z.string(), z.array(z.string()).min(1)])).meta({ description });

// ---------------------------------------------------------------------------
// Axes
// ---------------------------------------------------------------------------

const valueSelectors = z.record(z.string(), z.union([z.string(), z.null()]));

const axis = z
  .strictObject({
    prop: z.string().meta({
      description: "Prop name as it appears in the component API, e.g. `variant`, `size`.",
    }),
    values: z.array(z.string()).optional().meta({
      description:
        "The axis values, in the order Figma lists them. Required for a design-only axis. For an axis the component source declares, omit it to use the source values, or curate them (a subset or reordering).",
    }),
    default: z.string().optional().meta({
      description:
        "The value used where an example or child omits this axis. Required for a design-only axis; for a source axis it defaults to the source default.",
    }),
    attribute: z.string().optional().meta({
      description:
        "The DOM/CSS attribute that expresses this axis, conventionally `data-<prop>`. Required for a design-only axis; a source axis takes its source attribute.",
    }),
    valueSelectors: valueSelectors.optional().meta({
      description:
        'Per-value CSS selector for values not expressed as `[attribute="value"]`. `null` adds no attribute constraint (the base case).',
    }),
    partValueSelectors: z.record(z.string(), valueSelectors).optional().meta({
      description:
        "Per-part `valueSelectors`, keyed by `data-ui` part name, for a part whose own attribute value differs from the axis value it renders under.",
    }),
    codeProps: z
      .record(
        z.string(),
        z.strictObject({
          prop: z.string().meta({ description: "The component prop to set." }),
          value: z.union([z.string(), z.boolean()]).meta({
            description: "The value to give it: a string the prop accepts, or a boolean.",
          }),
        }),
      )
      .optional()
      .meta({
        description:
          'Code props this axis stands for, keyed by axis value, for a design-only axis whose values group code props. For example `content: { "icon-only": { prop: "iconOnly", value: true } }`. A value with no entry sets nothing. Each key must be one of the axis values.',
      }),
    foldedValues: z.record(z.string(), z.record(z.string(), z.string())).optional().meta({
      description:
        "Source values this axis omits from `values`, each mapped to the other axes (prop to value) it folds into, e.g. `size` value `icon-sm` folds into `content: icon-only` with `size: sm`. Recorded for consumers; the variant matrix is built from `values` only.",
    }),
    attributeOmittedWhenNull: z.boolean().optional().meta({
      description:
        "The runtime omits `attribute` entirely for the value whose `valueSelectors` entry is `null`, so valueless `[attribute]` selectors can be evaluated per cell.",
    }),
  })
  .meta({
    description:
      "One variant axis: a Figma variant property and the selectors that realise each value in CSS. An axis the component source declares (a local `data-*` union type) may name only its `prop` and the fields it curates; an axis the source does not declare is design-only and complete. The standard `state` axis is design-only: values from `default`, `hover`, `active`, `focus-visible`, `disabled` in that order, each mapped to its CSS selector in `valueSelectors` (`default` to `null`), only `disabled` in `codeProps`, and declared last.",
  });

// ---------------------------------------------------------------------------
// Anatomy
// ---------------------------------------------------------------------------

const valueOfSchema = z
  .union([
    z.strictObject({
      kind: z.literal("valueOf"),
      slot: z.string().meta({ description: "A declared slot whose example text is the value." }),
    }),
    z.strictObject({
      kind: z.literal("valueOf"),
      runtimeValue: z.string().meta({ description: "A declared runtime value." }),
    }),
  ])
  .meta({
    description:
      "A value authored per documentation example, as a percent: read from a slot the part renders, or from a declared runtime value.",
  });

const positionAlongMain = z
  .union([
    z.strictObject({ kind: crossAlign }),
    valueOfSchema,
    z.strictObject({
      kind: z.literal("refused"),
      jsProperty: z.string().meta({
        description: "The runtime (JavaScript) property that really positions the part.",
      }),
    }),
  ])
  .meta({
    description:
      "Offset along the parent's main axis: a literal anchor, a value-driven anchor, or an explicit, reported refusal.",
  });

const docsLayout = z
  .strictObject({
    gap: z.string().regex(DOCS_LAYOUT_GAP_TOKEN_RE).optional().meta({
      description: "A bare `var(--token-name)` reference, bound as the node's item spacing.",
    }),
    justify: z.enum(["start", "center", "end", "space-between"]).optional().meta({
      description: "Main-axis alignment (Figma `primaryAxisAlignItems`).",
    }),
    align: z.enum(["start", "center", "end", "stretch"]).optional().meta({
      description: "Cross-axis alignment (Figma `counterAxisAlignItems`).",
    }),
    source: z.string().meta({
      description: "`<docs file path>:<line>` where the documentation markup authors this layout.",
    }),
  })
  .meta({
    description:
      "Gap and alignment for a synthetic container, taken from the documentation markup that composes it.",
  });

const anatomyItem = z
  .strictObject({
    key: z.record(z.string(), z.string()).optional().meta({
      description: "Per-item axis values overriding the variant cell's.",
    }),
    slots: z.record(z.string(), z.string()).optional().meta({
      description: "Per-item slot content, keyed by slot name.",
    }),
  })
  .meta({ description: "One materialized copy of a repeated compound subtree." });

const anatomyNode = z
  .strictObject({
    part: z
      .string()
      .meta({ description: "The declared part (a `data-ui` name) this node renders." }),
    synthetic: z.boolean().optional().meta({
      description: "A contract-only composition role with no `data-ui` source part.",
    }),
    docsLayout: docsLayout.optional(),
    kind: nodeKind,
    layout: layout.optional(),
    layoutByAxis: axisValueMap(
      layout,
      "Layout chosen by a visual axis, when the anatomy differs by (for example) orientation.",
    ).optional(),
    overlayCrossAlign: crossAlign.optional().meta({
      description:
        "Placement within an `overlay` parent on the axis across the parent's long direction.",
    }),
    overlayCrossAlignByAxis: axisValueMap(
      crossAlign,
      "`overlayCrossAlign` chosen by a visual axis.",
    ).optional(),
    removeFromFlow: z.boolean().optional().meta({
      description:
        "Exempt this child from its auto-layout parent's flow (Figma absolute positioning). Requires `reason`.",
    }),
    removeFromFlowByAxis: axisValueMap(
      z.boolean(),
      "`removeFromFlow` chosen by a visual axis. Requires `reason`.",
    ).optional(),
    positionAlongMain: positionAlongMain.optional(),
    positionAlongMainByAxis: axisValueMap(
      positionAlongMain,
      "`positionAlongMain` chosen by a visual axis. Requires `reason`.",
    ).optional(),
    sizeAlongMain: valueOfSchema.optional().meta({
      description:
        "Length along the parent's main axis, value-driven and pinned at the parent's origin. Requires `reason`.",
    }),
    reason: z.string().optional().meta({
      description:
        "Why placement is declared instead of derived. Required with `removeFromFlow`, `positionAlongMain` and `sizeAlongMain`.",
    }),
    slots: z.array(z.string()).optional().meta({
      description: "Declared slots whose example content renders in this node.",
    }),
    when: variantMatch(
      "Render only in variant cells matching every axis; an array value matches any of its values.",
    ).optional(),
    unless: variantMatch(
      "Omit in variant cells matching every axis; an array value matches any of its values.",
    ).optional(),
    repeat: z.number().optional().meta({
      description: "Repeat this part this many times without declaring it again.",
    }),
    items: z.array(anatomyItem).min(1).optional().meta({
      description: "Materialize the same compound subtree once per item, with per-item overrides.",
    }),
    requiredBindings: z.array(bindingRole).optional().meta({
      description: "CSS-derived bindings that must resolve in every materialized variant.",
    }),
    iconName: z.string().optional().meta({
      description: 'Icon to embed (by registry name) for a `kind: "icon"` node.',
    }),
    imageAssetPath: z.string().optional().meta({
      description:
        'For a `kind: "image"` node: an image file relative to the component\'s directory, embedded by the compiler.',
    }),
    arc: z
      .object({
        sweep: z.number().gt(0).lt(360).meta({
          description: "Angular extent in degrees (greater than 0, less than 360).",
        }),
        start: z.number().optional().meta({
          description:
            "Start angle in degrees, clockwise from 3 o'clock. Default -90 (12 o'clock).",
        }),
      })
      .strict()
      .optional()
      .meta({
        description:
          'For a `kind: "ellipse"` node: an open stroked arc of `sweep` degrees instead of a full ring (CSS `stroke-dasharray` on a circle).',
      }),
    get children(): z.ZodOptional<z.ZodArray<typeof anatomyNode>> {
      return z.array(anatomyNode).optional().meta({ description: "Child nodes, in order." });
    },
  })
  .meta({
    id: "FigmaContractAnatomyNode",
    description: "One node of the component's Figma node tree.",
  });

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

const slot = z
  .strictObject({
    name: z.string().meta({
      description: "Stable name documentation examples use to provide content.",
    }),
    part: z.string().meta({ description: "The declared part that renders this content." }),
    required: z.boolean().optional().meta({
      description: "Every documentation example must supply this slot.",
    }),
    codeProp: z.string().optional().meta({
      description:
        "The component prop that receives this slot's content in code, when its name differs from the slot's (a `label` slot is the component's `children`). Omit it when the prop has the slot's own name.",
    }),
    composedChild: z
      .strictObject({
        component: z.string().meta({ description: "The other component's contract `slug`." }),
        variantKey: z.record(z.string(), z.string()).optional().meta({
          description:
            "Which of the child's variants is the default instance. Omit to use the child's own axis defaults. May name only the axes that differ; each missing axis takes the child's default, unless `variantKeyFromAxes` maps it.",
        }),
        variantKeyFromAxes: z.record(z.string(), z.string()).optional().meta({
          description:
            "Axes of the child that follow the parent's variant, as `{ childAxis: parentAxis }`: in each variant of the parent, the instance takes the child's value for the axis that the parent's variant has. Every value of the parent axis must be a value of the child axis. A mapped axis takes the parent's value over both `variantKey` and the child's default. In a slot inside a Building Block, the parent axis must be one of the block's axes.",
        }),
      })
      .optional()
      .meta({
        description:
          "This slot's default content is an instance of another contracted component. Text an example or item supplies for this slot is set on that instance's text, which needs the child to have exactly one text slot; the instance stays linked to the child.",
      }),
    defaultContent: z.enum(["anatomy"]).optional().meta({
      description:
        "The region accepts arbitrary children and its default content is the anatomy subtree beneath the frame part that renders this slot. That frame is the slot (a native slot where available, otherwise a plain frame holding the same children). Not combinable with `composedChild`.",
    }),
    stretch: z.boolean().optional().meta({
      description:
        "The slot's frame fills its parent's cross axis, as the CSS content region does.",
    }),
  })
  .meta({ description: "Consumer-fillable content rendered by a part." });

const propertyName = z.string().min(1).meta({
  description:
    "The Figma property name, e.g. `Label`. It shares one namespace with axis `prop`s and slot names, so none may repeat.",
});

const textProperty = z
  .strictObject({
    type: z.literal("text"),
    name: propertyName,
    part: z.string().meta({ description: "The declared text part whose characters it sets." }),
    default: z.string().meta({
      description: "The text every variant shows until an instance overrides it.",
    }),
    codeProp: z.string().optional().meta({
      description:
        "The component prop that receives the text in code, e.g. `children`. Omit it when the text has no code prop.",
    }),
  })
  .meta({ description: "A text property: the characters of a text part." });

const booleanProperty = z
  .strictObject({
    type: z.literal("boolean"),
    name: propertyName,
    part: z.string().meta({ description: "The declared part it shows or hides." }),
    default: z.boolean().meta({ description: "Whether the part is shown by default." }),
    unless: variantMatch(
      "Variant cells (axis to value) where the part is always shown and the property does not apply; an array value matches any of its values.",
    ).optional(),
    codeProp: z.string().optional().meta({
      description:
        "The boolean component prop that carries the value in code. Not combinable with `contentPresence`.",
    }),
    contentPresence: z.literal(true).optional().meta({
      description:
        "In code the part's content is present or absent, so Code Connect renders the part's text or instance-swap content only while the property is on. The part needs a text or instance-swap property. Not combinable with `codeProp`.",
    }),
  })
  .meta({ description: "A boolean property: shows or hides a part." });

const instanceSwapProperty = z
  .strictObject({
    type: z.literal("instanceSwap"),
    name: propertyName,
    part: z.string().meta({
      description:
        "The declared icon part. Its anatomy node's `iconName` is the default icon component.",
    }),
    codeProp: z.string().optional().meta({
      description:
        "The component prop that receives the icon in code, e.g. `children` or an icon prop. Omit it when the icon has no code prop.",
    }),
  })
  .meta({ description: "An instance-swap property: a swappable icon." });

const property = z.discriminatedUnion("type", [
  textProperty,
  booleanProperty,
  instanceSwapProperty,
]);

const runtimeValue = z
  .strictObject({
    name: z.string().meta({
      description: "Stable name used by `examples[].runtimeValues` and `valueOf.runtimeValue`.",
    }),
    part: z.string().meta({ description: "The declared part this value places or sizes." }),
    measures: z.enum(["length", "travel"]).meta({
      description:
        "`length`: percent of the parent's length. `travel`: percent of the parent's free space along its main axis.",
    }),
    replaces: z.array(z.string()).meta({
      description: "Runtime CSS custom properties this declaration stands in for (may be empty).",
    }),
    reason: z.string().meta({
      description: "Why the value is measured at runtime and what the representative values show.",
    }),
  })
  .meta({
    description:
      "A value the browser measures at runtime, declared with a representative percent per documentation example.",
  });

const example = z
  .strictObject({
    label: z.string().min(1).meta({ description: "Caption shown for this example." }),
    key: z.record(z.string(), z.string()).meta({
      description:
        "The variant cell this example shows, as axis to value. May name only the axes that differ; each missing axis takes the component's default.",
    }),
    slots: z.record(z.string(), z.string()).optional().meta({
      description: "Representative content keyed by declared slot name.",
    }),
    runtimeValues: z.record(z.string(), z.string()).optional().meta({
      description: "Representative percent (0 to 100) of each declared runtime value.",
    }),
  })
  .meta({ description: "One documented example: a variant cell plus its representative content." });

const literalGeometry = z
  .strictObject({
    part: z.string().meta({ description: "The declared part." }),
    when: z.record(z.string(), z.string()).optional().meta({
      description: "Apply only in variant cells matching every axis.",
    }),
    width: z.number().optional(),
    height: z.number().optional(),
    fontSize: z.number().optional(),
    lineHeight: z.number().optional(),
    lineHeightUnit: z.enum(["pixels", "unitless"]).optional(),
  })
  .meta({
    description: "A dimension the CSS states as a literal rather than a bindable variable.",
  });

const omittedPart = z
  .union([
    z.string(),
    z.strictObject({
      kind: z.enum(OMITTED_PART_KINDS).meta({
        description:
          "`window-relative`: fixed to the browser window. `runtime-position`: placed at runtime. `unrepresentable-state`: exists only under a state no axis expresses.",
      }),
      reason: z.string().meta({ description: "Reviewed justification." }),
      via: z.string().optional().meta({
        description:
          "For `unrepresentable-state`: the omitted part this one is only reachable through.",
      }),
    }),
  ])
  .meta({ description: "A reviewed reason, as prose or classified by kind." });

const viewportEdge = z.enum(["top", "right", "bottom", "left"]);

const viewport = z
  .strictObject({
    placement: z.enum(["center", "docked", "corner"]).meta({
      description:
        "Where the popup sits in the viewport stand-in frame: centred, docked to an edge, or in a corner.",
    }),
    dock: z
      .strictObject({
        axis: z.string().meta({ description: "The axis whose value picks the docking edge." }),
        edges: z.record(z.string(), viewportEdge).meta({
          description: "Axis value to frame edge.",
        }),
      })
      .optional()
      .meta({ description: 'Required with `placement: "docked"`.' }),
    corner: z
      .enum(["top-left", "top-right", "bottom-left", "bottom-right"])
      .optional()
      .meta({ description: 'Required with `placement: "corner"`.' }),
    placementPart: z.string().optional().meta({
      description: "The part whose own CSS places the popup, when it is not `rootPart`.",
    }),
    backdropPart: z.string().optional().meta({
      description:
        "A painting backdrop part, stretched over the frame behind the popup. Declared in `parts`, not in the anatomy.",
    }),
    reason: z.string().meta({
      description: "Why this component is window-placed and what the frame stands in for.",
    }),
  })
  .meta({ description: "This component generates inside a viewport stand-in frame." });

const split = z
  .strictObject({
    axis: z.union([z.string(), z.array(z.string()).min(2)]).meta({
      description:
        "The axis whose values each become one component set, or a list of two or more axes whose value combinations each become one (the cartesian product, first axis outermost). A split axis is no longer a variant property inside the sets: each set is named for its values, and Code Connect maps each to the same component with those values as fixed props.",
    }),
  })
  .meta({
    description:
      "Splits the output into one component set per value of a primary axis, or per combination of values of several axes, all generated from this one contract, so a set stays within the 30 variants Figma allows.",
  });

const shape = z
  .strictObject({
    name: z.string().optional().meta({
      description:
        "The shape's name, written into each set's name (`Primary Filled Icon Button`). At most one shape has none: the component's ordinary sets.",
    }),
    values: z.record(z.string(), z.array(z.string()).min(1)).meta({
      description:
        "The values the shape holds, per axis. An axis not named holds every value; one listed with a single value is fixed in the shape's sets.",
    }),
    split: split.optional(),
  })
  .meta({
    description:
      "A kind of the component that is generated as sets of its own, such as an icon-only button. Together the shapes say which combinations of axis values exist.",
  });

const focusRing = z
  .strictObject({
    property: z.string().optional().meta({
      description: "The boolean property that shows the ring. Defaults to `focus-visible`.",
    }),
  })
  .meta({
    description:
      "Generates a ring layer from the root's `:focus-visible` outline: an overlay part outside the root, stroked with the outline's width and colour tokens, shown by a boolean property that is off by default.",
  });

const buildingBlock = z
  .strictObject({
    part: z.string().meta({
      description:
        "The declared part that becomes the block. Not the root part, and named `<component>-<name>`. Its slots and properties belong to the block.",
    }),
    name: z.string().optional().meta({
      description:
        "The label in the set's name (`.Building Blocks/<Component>/<name>`). Defaults to the part's name without the component's prefix.",
    }),
    axes: z.array(axis).meta({
      description:
        "The block's own variant axes (its states), each complete: `values`, `default` and `attribute`. An entry that names an axis of the parent by `prop` alone (optionally curating its values or default) is that axis. A parent axis of the same name shows the instance in the matching state; otherwise the instance shows the default.",
    }),
    focusRing: focusRing.optional().meta({
      description:
        "Generates the block's ring layer from its part's `:focus-visible` outline, as `focusRing` does for a contract's root.",
    }),
    split: split.optional().meta({
      description:
        "Splits the block into one hidden set per value, or combination of values, of its own axes (`.Building Blocks/<Component>/<Value> <Label>`), as `split` does for a contract. An instance shows the set that holds its variant.",
    }),
  })
  .meta({
    description:
      "A sub-element with its own states, generated as its own hidden component set and nested as an instance in the parent.",
  });

/** `namespace.name`: a lowercase namespace, a dot, then a name that may use camelCase. */
export const EXTENSION_KEY_PATTERN = /^[a-z][a-z0-9-]*\.[A-Za-z][A-Za-z0-9.-]*$/;

export const authoredFigmaContractSchema = z
  .strictObject({
    schemaVersion: z.literal(1).meta({
      description: "Authored contract schema version. Embedded verbatim in the compiled artifact.",
    }),
    slug: z
      .string()
      .min(1)
      .meta({ description: "The component directory name, e.g. `toggle-group`." }),
    componentName: z.string().min(1).meta({ description: "Display name, e.g. `ToggleGroup`." }),
    rootPart: z.string().meta({ description: "The `data-ui` part at the root of the anatomy." }),
    source: z
      .strictObject({
        slug: z.string().min(1).meta({
          description: "The component whose folder holds the `.tsx` and `.css`, e.g. `field`.",
        }),
      })
      .optional()
      .meta({
        description:
          "Build this contract from another component's source: `rootPart` is one of that component's parts, which becomes its own Figma component. The registry item, description and category come from the source component.",
      }),
    parts: z.array(z.string()).meta({ description: "Every `data-ui` part the contract declares." }),
    anatomy: anatomyNode.optional().meta({
      description: "Explicit parent/child node tree rooted at `rootPart`.",
    }),
    slots: z.array(slot).optional().meta({ description: "Consumer-fillable content." }),
    properties: z.array(property).optional().meta({
      description:
        "Component properties (text, boolean, instance swap) for what is not a visual difference: editable text, a part that shows or hides, a swappable icon. A visual difference stays an axis; arbitrary children stay a slot.",
    }),
    runtimeValues: z.array(runtimeValue).optional().meta({
      description: "Runtime-measured values, declared per documentation example.",
    }),
    axes: z.array(axis).optional().meta({
      description:
        "Variant axes, in Figma property order. Omitted axes the component source declares are filled in by the compiler; declare design-only axes and curation only.",
    }),
    split: split.optional(),
    shapes: z.array(shape).optional().meta({
      description:
        "Kinds of the component generated as sets of their own, such as an icon-only button. Together they say which combinations of axis values exist.",
    }),
    focusRing: focusRing.optional(),
    capReason: z.string().optional().meta({
      description:
        "Why a set may hold more than the 30 variants Figma's library guidance allows. Without it, a set over the cap is reported as a warning. The reason shows in the compiler output and the docs.",
    }),
    buildingBlocks: z.array(buildingBlock).optional().meta({
      description:
        "Sub-elements with their own states (a select item, a toggle-group segment), each generated as a hidden `.Building Blocks/<Component>/<Part>` set and nested as an instance in this component.",
    }),
    documentation: z
      .strictObject({
        examples: z.array(example).meta({ description: "Documented examples, in page order." }),
        coverage: z.literal("all-axes").optional().meta({
          description: "Require the examples to cover every value of every axis.",
        }),
      })
      .meta({ description: "The documentation page's examples." }),
    reactToFigmaNotes: z.array(z.string()).optional().meta({
      description: "Reviewed differences between the React API and the design-only axes.",
    }),
    literalGeometry: z.array(literalGeometry).optional().meta({
      description: "Dimensions CSS states as literals rather than bindable variables.",
    }),
    omittedParts: z.record(z.string(), omittedPart).optional().meta({
      description:
        "Real, CSS-styled parts the contract deliberately does not declare, each with a reviewed reason.",
    }),
    viewport: viewport.optional(),
    extensions: z
      .record(
        z.string().regex(EXTENSION_KEY_PATTERN, {
          error:
            "An extension key is a lowercase `namespace.name`, for example `acme.reviewStatus`.",
        }),
        z.unknown(),
      )
      .optional()
      .meta({
        description:
          "Project-owned data under a `namespace.name` key. Generation ignores it, it never reaches the compiled artifact, and using it does not make the schema deviate from its base.",
      }),
  })
  .meta({
    title: "Figma generation contract",
    description:
      "An authored Figma generation contract: how one component's parts, axes and documented examples become a Figma component set and documentation page.",
  });

export type AuthoredFigmaContract = z.infer<typeof authoredFigmaContractSchema>;

/**
 * Compile-time proof that every authored contract is a valid compiler input: the inferred type
 * must stay assignable to the compiler's input shape (`AuthoredGenerationContract`: the normalized
 * wire shape with sparse axes). If the schema ever admits something the compiler does not, type
 * checking fails here.
 */
function asCompilerInput(contract: AuthoredFigmaContract): AuthoredGenerationContract {
  return contract;
}

/**
 * Checks `contract` against the authored schema and returns it UNCHANGED (never Zod's parsed
 * copy, which would reorder keys). Throws one error naming the contract and every issue.
 */
export function parseAuthoredFigmaContract(
  contract: unknown,
  label: string,
): AuthoredFigmaContract {
  const result = authoredFigmaContractSchema.safeParse(contract);
  if (!result.success) {
    const slug =
      typeof (contract as { slug?: unknown } | null)?.slug === "string"
        ? (contract as { slug: string }).slug
        : label;
    throw new RefusalError(
      `Invalid Figma generation contract ${label}:\n${z.prettifyError(result.error)}`,
      result.error.issues.map((issue) =>
        diagnostic(
          "schema-invalid",
          issue.message,
          diagnosticPath(
            slug,
            issue.path.filter((s): s is string | number => typeof s !== "symbol"),
          ),
        ),
      ),
    );
  }
  return contract as AuthoredFigmaContract;
}

/** `parseAuthoredFigmaContract`, typed as the compiler input it is about to become. */
export function parseFigmaContractForCompiler(
  contract: unknown,
  label: string,
): AuthoredGenerationContract {
  return asCompilerInput(withoutExtensions(parseAuthoredFigmaContract(contract, label)));
}

/**
 * The contract without its `extensions`. Extensions are project data: generation never reads
 * them and the artifact never carries them. Returns the same object when there are none.
 */
export function withoutExtensions<T extends { extensions?: unknown }>(
  contract: T,
): Omit<T, "extensions"> {
  if (!("extensions" in contract)) return contract;
  const { extensions: _extensions, ...rest } = contract;
  return rest;
}

/** The JSON Schema for the authored contract, as committed in `figma-contract.schema.json`. */
export function authoredFigmaContractJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(authoredFigmaContractSchema, { target: "draft-2020-12" }) as Record<
    string,
    unknown
  >;
}

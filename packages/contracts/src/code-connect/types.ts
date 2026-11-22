/** Types for the deterministic Code Connect template (`.figma.ts`) generator. */

/**
 * A component's entry in the generation manifest (`.agents/figma.json`). The manifest supplies
 * Figma node ids only; everything about the component's properties comes from the compiled
 * contract. `nodeId` is the node Code Connect maps (the plugin handoff's `nodeId`, which is the
 * popup component for a window-placed component); `setId` is the component set and is the fallback.
 */
export interface FigmaManifestComponent {
  /** Colon-form Figma node id of the component set, e.g. "9:114". */
  setId?: string;
  /** Colon-form node id Code Connect should map, when it differs from `setId`. */
  nodeId?: string;
  /** Repo-relative path of the component source, shown in Dev Mode. */
  source?: string;
  /**
   * The component sets of a split contract, keyed by the split axis value (`primary`). Each set
   * maps to the same component with that value as a fixed prop.
   */
  sets?: Record<string, FigmaManifestNode>;
  /**
   * The hidden Building Block sets, keyed by the declared part (`select-item`). A split block lists
   * its sets under `sets`, keyed by the split value, as a split component does.
   */
  buildingBlocks?: Record<string, FigmaManifestNode & { sets?: Record<string, FigmaManifestNode> }>;
  [k: string]: unknown;
}

/** The Figma node ids of one component set the manifest names. */
export interface FigmaManifestNode {
  setId?: string;
  nodeId?: string;
}

/** The generation manifest: file key plus one node-id entry per component. */
export interface FigmaManifest {
  fileKey: string;
  components: Record<string, FigmaManifestComponent>;
  [k: string]: unknown;
}

/** A Figma VARIANT property the plugin creates: one per contract axis, values verbatim. */
export interface ContractAxis {
  /** Figma property name (the axis `prop`). */
  prop: string;
  values: string[];
  /** Code props a value stands for, keyed by axis value (a design-only axis that groups props). */
  codeProps?: Record<string, { prop: string; value: string | boolean }>;
  /**
   * Code values this axis does not offer as Figma variants, each with the other axes (and this
   * one) it folds into: `size` `icon-sm` is `{ content: "icon-only", size: "sm" }`.
   */
  foldedValues?: Record<string, Record<string, string>>;
}

/** A native slot property the plugin creates, named exactly as the contract names the slot. */
export interface ContractSlot {
  name: string;
  /** The declared part that renders the slot, which tells whether a Building Block owns it. */
  part?: string;
  /** The declared composed child, when the slot's default content is another component. */
  composedChild?: unknown;
  /** The code prop that receives the slot's content, when it differs from `name`. */
  codeProp?: string;
}

/**
 * A component property the plugin creates on the set: TEXT, BOOLEAN or INSTANCE_SWAP, named
 * exactly as the contract names it.
 */
export type ContractProperty =
  | { type: "text"; name: string; part: string; codeProp?: string }
  | {
      type: "boolean";
      name: string;
      part: string;
      codeProp?: string;
      /** The part's content is present or absent in code, so the boolean gates it. */
      contentPresence?: boolean;
      /** Variant cells where the part is always shown, whatever the property says. */
      unless?: Record<string, string | string[]>;
    }
  | { type: "instanceSwap"; name: string; part: string; codeProp?: string };

/** The slice of a compiled contract the generator reads. */
export interface ComponentContract {
  /** Exported component identifier, e.g. "Button". */
  componentName: string;
  axes: ContractAxis[];
  slots?: ContractSlot[];
  /** Text, boolean and instance-swap properties the plugin creates. */
  properties?: ContractProperty[];
  /**
   * Present when the component generates inside a viewport stand-in frame (dialog, drawer, toast).
   * Code Connect then maps the bare popup component, which carries no `context` axis.
   */
  viewport?: unknown;
  /** The anatomy tree, read only for the order its parts and slots appear in. */
  anatomy?: AnatomyOrder;
  /** One set per value of this axis: each maps with the value as a fixed prop. */
  split?: { axis: string | string[] };
  /** Kinds of the component generated as sets of their own: each shape's sets are mapped too. */
  shapes?: Array<{
    name?: string;
    values: Record<string, string[]>;
    split?: { axis: string | string[] };
  }>;
  /** The declared Building Blocks, whose parts the component's own template leaves to the block. */
  buildingBlocks?: Array<{ part: string; split?: { axis: string | string[] } }>;
}

/** The slice of an anatomy node that fixes the order its slots render in. */
export interface AnatomyOrder {
  /** Variant cells (axis to value or values) the node renders in. */
  when?: Record<string, string | string[]>;
  /** Variant cells the node is left out of. */
  unless?: Record<string, string | string[]>;
  /** The declared part this node renders, which fixes where a property's content sits. */
  part?: string;
  slots?: string[];
  children?: AnatomyOrder[];
}

/** How a code prop is typed, as far as a template needs to know. */
export type CodePropType = "union" | "boolean" | "node" | "string" | "other";

/** One prop of the component's own type. */
export interface CodePropFact {
  type: CodePropType;
  /** The string-literal members, for a `union` prop. */
  literals?: string[];
}

/** The component's props, keyed by name, read from the component's own TypeScript type. */
export type CodeProps = Record<string, CodePropFact>;

/**
 * Where a property's part exists in Figma, from its anatomy node's `when` and `unless`: the part is
 * absent in other cells, so the template must not render the property's value there. Each axis is
 * read with `getEnum`, over every value it has.
 */
export interface ShownIn {
  when?: Record<string, string[]>;
  unless?: Record<string, string[]>;
  reads: Record<string, string[]>;
}

/** A mapping derived from the contract: one entry per Figma property the template reads. */
export type PropMapping =
  | {
      kind: "enum";
      prop: string;
      figmaProp: string;
      values: Record<string, string>;
      /**
       * Code values the axis folds into other axes: when every `when` axis has its value, the
       * Figma value maps through `values` instead (`content=icon-only` turns `size` `sm` into
       * `icon-sm`). Derived from the axis's `foldedValues`.
       */
      folds?: Array<{ when: Record<string, string>; values: Record<string, string> }>;
      /** Every value of each other axis a fold reads, so it can be read with a `getEnum` map. */
      reads?: Record<string, string[]>;
    }
  | {
      /** A slot rendered into a code prop; several slots may compose one prop in anatomy order. */
      kind: "slot";
      /** The template local that holds the slot's content. */
      local: string;
      /** The code prop that receives it. */
      prop: string;
      figmaProp: string;
    }
  | {
      /** A TEXT property rendered into a code prop. */
      kind: "text";
      local: string;
      prop: string;
      figmaProp: string;
      /** The code prop is a string, so the text is an attribute, not rendered content. */
      asString?: boolean;
      /** The local of the boolean whose `contentPresence` hides this text. */
      gate?: string;
      /** The cells the text's part is rendered in; elsewhere nothing is rendered. */
      shown?: ShownIn;
    }
  | {
      /** An INSTANCE_SWAP property rendered into a code prop through the swapped instance's template. */
      kind: "swap";
      local: string;
      prop: string;
      figmaProp: string;
      /** The local of the boolean whose `contentPresence` hides this icon. */
      gate?: string;
      /** The cells the icon's part is rendered in; elsewhere nothing is rendered. */
      shown?: ShownIn;
    }
  | {
      /** A BOOLEAN property carried by a boolean code prop. */
      kind: "boolean";
      local: string;
      prop: string;
      figmaProp: string;
    }
  | {
      /** A BOOLEAN property that only gates other content; it adds no attribute of its own. */
      kind: "presence";
      local: string;
      figmaProp: string;
      /**
       * Variant cells where the content is present whatever the property says (axis to the values
       * that match). The template reads each axis with `getEnum` and ORs them in.
       */
      unless?: Record<string, string[]>;
      /** Every value of each axis `unless` reads, so it can be read with a `getEnum` map. */
      reads?: Record<string, string[]>;
    }
  | {
      /** Axis values that stand for one code prop: `content=icon-only` is `iconOnly`. */
      kind: "axisProp";
      prop: string;
      figmaProp: string;
      values: Record<string, string | boolean>;
    };

/** A contract property the template leaves out, and why (never guessed). */
export interface UnmappedProperty {
  kind: "axis" | "slot" | "property";
  name: string;
  reason: string;
}

/** The structured intermediate the serializer renders to a `.figma.ts` template. */
export interface CodeConnectMapping {
  componentName: string;
  /** The JSX tag the example renders; `Field.Root` for a compound component, else `componentName`. */
  renderTag: string;
  /** The name imported from `importPath`; `componentName` unless a part is a member of another export. */
  importName?: string;
  importPath: string;
  figmaUrl: string;
  /** Repo-relative path of the component source, shown in Figma's Dev Mode (optional). */
  source?: string;
  /**
   * Props fixed by the Figma set itself, not read from a property: the split axis value of a
   * split set (`variant="primary"`). Rendered first in the example.
   */
  fixed?: Array<{ prop: string; value: string | boolean }>;
  /** Appended to the template `id` so each set of a split component has its own. */
  idSuffix?: string;
  props: PropMapping[];
  unmapped: UnmappedProperty[];
}

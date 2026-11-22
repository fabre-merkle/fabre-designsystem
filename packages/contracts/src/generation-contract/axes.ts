import { isStandardStateAxis, STATE_AXIS_PROP, STATE_VALUES } from "../registry/state-axis";
import type { ComponentRegistryAxis } from "../registry/types";
import type {
  AuthoredContractAxis,
  AuthoredGenerationContract,
  FigmaGenerationContract,
} from "./types";

const CURATABLE = new Set(["values", "default"]);

/**
 * Whether an authored axis declares everything a component axis needs (values, default and
 * attribute).
 */
function isComplete(axis: AuthoredContractAxis): axis is ComponentRegistryAxis {
  return axis.values !== undefined && axis.default !== undefined && axis.attribute !== undefined;
}

/**
 * Merges an authored axis over the axis the component source declares, checking the authored
 * values are a subset of the source's.
 */
function curated(
  slug: string,
  authored: AuthoredContractAxis,
  source: ComponentRegistryAxis,
): ComponentRegistryAxis {
  const subject = `"${slug}" axis "${authored.prop}"`;
  if (authored.attribute !== undefined && authored.attribute !== source.attribute) {
    throw new Error(
      `${subject} attribute "${authored.attribute}" does not match its source attribute "${source.attribute}".`,
    );
  }
  const values = authored.values ?? source.values;
  if (values.length === 0) throw new Error(`${subject} must keep at least one value.`);
  for (const value of values) {
    if (!source.values.includes(value)) {
      throw new Error(
        `${subject} has unknown ${authored.prop} value "${value}"; the source declares ${source.values.join(", ")}.`,
      );
    }
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`${subject} lists a value more than once.`);
  }
  const defaultValue =
    authored.default ?? (values.includes(source.default) ? source.default : undefined);
  if (defaultValue === undefined) {
    throw new Error(
      `${subject} curates away its source default "${source.default}"; declare a default among its values.`,
    );
  }
  if (!values.includes(defaultValue)) {
    throw new Error(`${subject} default "${defaultValue}" is not one of its values.`);
  }
  for (const folded of Object.keys(authored.foldedValues ?? {})) {
    if (!source.values.includes(folded)) {
      throw new Error(
        `${subject} folds unknown ${authored.prop} value "${folded}"; the source declares ${source.values.join(", ")}.`,
      );
    }
    if (values.includes(folded)) {
      throw new Error(
        `${subject} folds "${folded}" but still lists it in values; a folded value is not a Figma variant.`,
      );
    }
  }
  if (isComplete(authored)) return authored;
  const extras = Object.fromEntries(
    Object.entries(authored).filter(
      ([key]) => key !== "prop" && key !== "attribute" && !CURATABLE.has(key),
    ),
  );
  return {
    prop: source.prop,
    values,
    default: defaultValue,
    attribute: source.attribute,
    ...extras,
  };
}

/**
 * Builds an axis the component source does not declare; it must state its own values, default and
 * attribute.
 */
function designOnly(slug: string, authored: AuthoredContractAxis): ComponentRegistryAxis {
  if (!isComplete(authored)) {
    throw new Error(
      `"${slug}" axis "${authored.prop}" is not declared by the component source; a design-only axis must declare values, default and attribute.`,
    );
  }
  if (authored.values.length === 0) {
    throw new Error(`"${slug}" axis "${authored.prop}" must declare at least one value.`);
  }
  if (!authored.values.includes(authored.default)) {
    throw new Error(
      `"${slug}" axis "${authored.prop}" default "${authored.default}" is not one of its values.`,
    );
  }
  return authored;
}

/**
 * Checks the standard State axis: a component's pointer, keyboard and availability states in one
 * axis. Its values are the standard ones, in the standard order, with `default` first and as the
 * default; every other value names the selector that expresses it in the component's CSS. Only
 * `disabled` stands for a code prop: the others are browser states with nothing to set. The axis
 * is last, so the component set reads it across the columns of its grid.
 */
function validateStateAxis(
  slug: string,
  axis: ComponentRegistryAxis,
  position: number,
  count: number,
): void {
  const subject = `"${slug}" axis "${axis.prop}"`;
  if (!isStandardStateAxis(axis)) {
    throw new Error(
      `${subject} is the standard State axis name, so its values must come from ${STATE_VALUES.join(", ")}. A selection or other state of the component needs a different axis name, such as "selection" or "checked".`,
    );
  }
  const order = STATE_VALUES.filter((value) => axis.values.includes(value));
  if (
    axis.values.join() !== order.join() ||
    axis.values.length < 2 ||
    axis.values[0] !== "default"
  ) {
    throw new Error(
      `${subject} must list at least default and one more of ${STATE_VALUES.join(", ")}, in that order, starting with default.`,
    );
  }
  if (axis.default !== "default") {
    throw new Error(`${subject} default must be "default".`);
  }
  for (const value of axis.values) {
    const selectors = axis.valueSelectors ?? {};
    if (value === "default" ? selectors[value] !== null : typeof selectors[value] !== "string") {
      throw new Error(
        value === "default"
          ? `${subject} must map "default" to null in valueSelectors: the base state adds no selector.`
          : `${subject} must map "${value}" to the CSS selector that expresses it in valueSelectors, for example ":hover", ":active", ":focus-visible" or "[data-disabled]".`,
      );
    }
  }
  for (const value of Object.keys(axis.codeProps ?? {})) {
    if (value !== "disabled") {
      throw new Error(
        `${subject} maps "${value}" to a code prop, but only "disabled" does. hover, active and focus-visible are browser states.`,
      );
    }
  }
  if (position !== count - 1) {
    throw new Error(
      `${subject} must be the last axis, so the component set reads it across the grid columns.`,
    );
  }
}

/**
 * Fills `contract.axes` in from `sourceAxes` (the extractor's axes for this component). Throws on
 * a duplicate axis, an incomplete axis the source does not declare, or curation that names a
 * value, default or attribute the source does not have.
 */
export function normalizeContractAxes(
  contract: AuthoredGenerationContract,
  sourceAxes: readonly ComponentRegistryAxis[],
): FigmaGenerationContract {
  const authored = contract.axes ?? [];
  const seen = new Set<string>();
  for (const axis of authored) {
    if (seen.has(axis.prop)) {
      throw new Error(`"${contract.slug}" declares axis "${axis.prop}" more than once.`);
    }
    seen.add(axis.prop);
  }
  const axes: ComponentRegistryAxis[] = authored.map((axis) => {
    const source = sourceAxes.find((candidate) => candidate.prop === axis.prop);
    return source ? curated(contract.slug, axis, source) : designOnly(contract.slug, axis);
  });
  sourceAxes.forEach((source, index) => {
    if (seen.has(source.prop)) return;
    const earlier = sourceAxes
      .slice(0, index)
      .map((candidate) => axes.findIndex((axis) => axis.prop === candidate.prop))
      .filter((position) => position !== -1);
    const position = earlier.length > 0 ? Math.max(...earlier) + 1 : 0;
    axes.splice(position, 0, source);
  });
  axes.forEach((axis, position) => {
    if (axis.prop === STATE_AXIS_PROP)
      validateStateAxis(contract.slug, axis, position, axes.length);
  });
  for (const axis of axes) {
    for (const [folded, target] of Object.entries(axis.foldedValues ?? {})) {
      for (const [prop, value] of Object.entries(target)) {
        const other = axes.find((candidate) => candidate.prop === prop);
        if (!other || !other.values.includes(value)) {
          throw new Error(
            `"${contract.slug}" axis "${axis.prop}" folds "${folded}" into ${prop}="${value}", which is not an axis value of the contract.`,
          );
        }
      }
    }
  }
  const blocks = completeBuildingBlockAxes(contract, axes);
  const withBlocks =
    blocks === contract.buildingBlocks ? contract : { ...contract, buildingBlocks: blocks };
  if (
    contract.axes &&
    axes.length === contract.axes.length &&
    axes.every((axis, index) => axis === contract.axes?.[index])
  ) {
    return withBlocks as FigmaGenerationContract;
  }
  if (contract.axes) return { ...withBlocks, axes } as FigmaGenerationContract;
  return withAxesKey(withBlocks, axes);
}

/**
 * Completes each Building Block axis that names an axis of the parent by `prop` alone (or curates
 * it): it becomes that axis, so the block varies the way the parent does (the parent's source
 * axes reach a block this way). A complete block axis is kept as written. Returns the same array
 * when nothing needs completing.
 */
function completeBuildingBlockAxes(
  contract: AuthoredGenerationContract,
  axes: readonly ComponentRegistryAxis[],
): AuthoredGenerationContract["buildingBlocks"] {
  const blocks = contract.buildingBlocks;
  if (!blocks?.some((block) => block.axes.some((axis) => !isComplete(axis)))) return blocks;
  return blocks.map((block) => {
    if (block.axes.every(isComplete)) return block;
    const slug = `${contract.slug}" Building Block "${block.part}`;
    return {
      ...block,
      axes: block.axes.map((axis) => {
        if (isComplete(axis)) return axis;
        const parent = axes.find((candidate) => candidate.prop === axis.prop);
        if (!parent) {
          throw new Error(
            `"${slug}" axis "${axis.prop}" is not an axis of the parent; a block axis that is not the parent's must declare values, default and attribute.`,
          );
        }
        const merged = curated(slug, axis, parent);
        // A parent axis of the same name drives the instance, so the block keeps the parent's
        // selectors for it; the block's own entry may add or override them.
        return {
          ...parent,
          ...merged,
        };
      }),
    };
  });
}

/**
 * Adds `axes` to a contract that has no `axes` key, after `anatomy` (where most contracts place
 * it), else after `parts`. A contract that wants another position keeps an `axes` key, which may
 * be empty.
 */
function withAxesKey(
  contract: AuthoredGenerationContract,
  axes: ComponentRegistryAxis[],
): FigmaGenerationContract {
  const anchor = "anatomy" in contract ? "anatomy" : "parts";
  const entries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(contract)) {
    entries.push([key, value]);
    if (key === anchor) entries.push(["axes", axes]);
  }
  return Object.fromEntries(entries) as unknown as FigmaGenerationContract;
}

import { RESOLVED_PLAN_SCHEMA_VERSION } from "../resolved-plan/types";
import { resolveRole } from "./compiler";
import { componentSetErrors } from "./component-sets";
import { validateComposition } from "./composition";
import { propertyErrors } from "./properties";
import { runtimeValueErrors } from "./runtime-values";
import {
  DOCS_LAYOUT_ALIGN_VALUES,
  DOCS_LAYOUT_GAP_TOKEN_RE,
  DOCS_LAYOUT_JUSTIFY_VALUES,
  DOCUMENTATION_THEME_ROLES,
  type FigmaGenerationContract,
  GENERATION_CONTRACT_ARTIFACT_SCHEMA_VERSION,
  GENERATION_CONTRACT_SOURCE_SCHEMA_VERSION,
  type GenerationContractArtifact,
  type GenerationContractBindingRole,
  OMITTED_PART_KINDS,
  parseDocsLayoutSource,
  type ViewportPlacement,
} from "./types";
import {
  cornerEdges,
  VIEWPORT_CONTEXT_AXIS,
  VIEWPORT_CONTEXT_AXIS_PROP,
  VIEWPORT_EDGES,
  VIEWPORT_PLACEMENTS,
} from "./viewport";

/** Whether a value is a non-array object. */
function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Asserts a value is a non-blank string, throwing with the offending path. */
function requireNonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid Figma generation contract: \`${path}\` must be a non-empty string.`);
  }
}

function requireSvgElementString(value: unknown, path: string): asserts value is string {
  requireNonEmptyString(value, path);
  const trimmed = value.trim();
  if (!/^<svg\b/i.test(trimmed) || !/<\/svg>\s*$/i.test(trimmed)) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}\` must be a complete <svg>...</svg> element, ` +
        "not a bare path or fragment.",
    );
  }
}

/** Asserts a value is an object, throwing with the offending path. */
function requireObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`Invalid Figma generation contract: \`${path}\` must be an object.`);
  }
}

/** Asserts a value is an array of non-blank strings, throwing with the offending path. */
function requireStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error(`Invalid Figma generation contract: \`${path}\` must be a string array.`);
  }
}

/** Asserts a value is an object whose values are all strings, throwing with the offending path. */
function requireStringRecord(
  value: unknown,
  path: string,
): asserts value is Record<string, string> {
  requireObject(value, path);
  for (const [key, entry] of Object.entries(value)) {
    if (!key.trim() || typeof entry !== "string") {
      throw new Error(`Invalid Figma generation contract: \`${path}\` must contain string values.`);
    }
  }
}

function requireStringOrStringArrayRecord(
  value: unknown,
  path: string,
): asserts value is Record<string, string | string[]> {
  requireObject(value, path);
  for (const [key, entry] of Object.entries(value)) {
    if (!key.trim()) {
      throw new Error(`Invalid Figma generation contract: \`${path}\` must contain string keys.`);
    }
    if (typeof entry === "string") continue;
    if (Array.isArray(entry) && entry.length > 0 && entry.every((v) => typeof v === "string")) {
      continue;
    }
    throw new Error(
      `Invalid Figma generation contract: \`${path}.${key}\` must be a string or a non-empty string array.`,
    );
  }
}

/** Validates one axis declaration: prop, values, default and (when required) attribute. */
function validateAxis(value: unknown, path: string, requireAttribute: boolean): void {
  requireObject(value, path);
  requireNonEmptyString(value.prop, `${path}.prop`);
  requireStringArray(value.values, `${path}.values`);
  if (value.values.length === 0) {
    throw new Error(`Invalid Figma generation contract: \`${path}.values\` must not be empty.`);
  }
  requireNonEmptyString(value.default, `${path}.default`);
  if (!value.values.includes(value.default)) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.default\` must be one of its values.`,
    );
  }
  if (requireAttribute) requireNonEmptyString(value.attribute, `${path}.attribute`);
  if (value.codeProps !== undefined) {
    requireObject(value.codeProps, `${path}.codeProps`);
    for (const [axisValue, entry] of Object.entries(value.codeProps)) {
      const entryPath = `${path}.codeProps.${axisValue}`;
      if (!value.values.includes(axisValue)) {
        throw new Error(
          `Invalid Figma generation contract: \`${entryPath}\` is not one of the axis values.`,
        );
      }
      requireObject(entry, entryPath);
      requireNonEmptyString(entry.prop, `${entryPath}.prop`);
      if (typeof entry.value !== "string" && typeof entry.value !== "boolean") {
        throw new Error(
          `Invalid Figma generation contract: \`${entryPath}.value\` must be a string or a boolean.`,
        );
      }
    }
  }
}

/** Validates the shape of the component properties; the cross-field rules run in `propertyErrors`. */
function validateProperties(value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid Figma generation contract: \`${path}\` must be an array.`);
  }
  value.forEach((property, index) => {
    const propertyPath = `${path}[${index}]`;
    requireObject(property, propertyPath);
    requireNonEmptyString(property.name, `${propertyPath}.name`);
    requireNonEmptyString(property.part, `${propertyPath}.part`);
    if (property.codeProp !== undefined) {
      requireNonEmptyString(property.codeProp, `${propertyPath}.codeProp`);
    }
    if (property.type === "text") {
      if (typeof property.default !== "string") {
        throw new Error(
          `Invalid Figma generation contract: \`${propertyPath}.default\` must be a string.`,
        );
      }
    } else if (property.type === "boolean") {
      if (typeof property.default !== "boolean") {
        throw new Error(
          `Invalid Figma generation contract: \`${propertyPath}.default\` must be a boolean.`,
        );
      }
      if (property.unless !== undefined) {
        requireStringOrStringArrayRecord(property.unless, `${propertyPath}.unless`);
      }
      if (property.contentPresence !== undefined && property.contentPresence !== true) {
        throw new Error(
          `Invalid Figma generation contract: \`${propertyPath}.contentPresence\` must be true.`,
        );
      }
    } else if (property.type !== "instanceSwap") {
      throw new Error(
        `Invalid Figma generation contract: \`${propertyPath}.type\` must be "text", "boolean" or "instanceSwap".`,
      );
    }
  });
}

/** Validates a contract object, including its axes, slots, anatomy and documentation. */
function validateContract(value: unknown, path: string): void {
  requireObject(value, path);
  // The SOURCE version, always — even when this contract is embedded inside a
  // compiled artifact, its `schemaVersion` is copied verbatim from the
  // authored `*.figma.contract.ts` file (see `compileGenerationContract`) and
  // never bumped alongside the artifact `version`.
  if (value.schemaVersion !== GENERATION_CONTRACT_SOURCE_SCHEMA_VERSION) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.schemaVersion\` must be ${GENERATION_CONTRACT_SOURCE_SCHEMA_VERSION}.`,
    );
  }
  requireNonEmptyString(value.slug, `${path}.slug`);
  requireNonEmptyString(value.componentName, `${path}.componentName`);
  requireNonEmptyString(value.rootPart, `${path}.rootPart`);
  if (value.description !== undefined) {
    requireNonEmptyString(value.description, `${path}.description`);
  }
  if (value.source !== undefined) {
    requireObject(value.source, `${path}.source`);
    requireNonEmptyString(value.source.slug, `${path}.source.slug`);
  }
  requireStringArray(value.parts, `${path}.parts`);
  if (!value.parts.includes(value.rootPart)) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.rootPart\` must be declared in parts.`,
    );
  }
  for (const part of value.parts as string[]) {
    const pseudoIndex = part.indexOf("::");
    if (pseudoIndex === -1) continue;
    const suffix = part.slice(pseudoIndex);
    if (suffix !== "::before" && suffix !== "::after") {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.parts\` part "${part}" declares an ` +
          'unrecognised pseudo-element — only "::before" and "::after" are supported.',
      );
    }
    const hostPart = part.slice(0, pseudoIndex);
    if (!hostPart || !value.parts.includes(hostPart)) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.parts\` pseudo part "${part}" names host ` +
          `part "${hostPart}", which is not itself declared in parts.`,
      );
    }
  }
  if (value.omittedParts !== undefined) {
    requireObject(value.omittedParts, `${path}.omittedParts`);
    for (const [part, entry] of Object.entries(value.omittedParts)) {
      let reason: unknown = entry;
      if (isObject(entry)) {
        reason = entry.reason;
        if (!(OMITTED_PART_KINDS as readonly unknown[]).includes(entry.kind)) {
          throw new Error(
            `Invalid Figma generation contract: \`${path}.omittedParts\` part "${part}" has an unknown kind; use one of ${OMITTED_PART_KINDS.join(", ")}.`,
          );
        }
        if (entry.via !== undefined && typeof entry.via !== "string") {
          throw new Error(
            `Invalid Figma generation contract: \`${path}.omittedParts.${part}.via\` must be a string.`,
          );
        }
      } else if (typeof entry !== "string") {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.omittedParts\` part "${part}" must be a reason string or a { kind, reason } object.`,
        );
      }
      if (typeof reason !== "string" || !reason.trim()) {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.omittedParts.${part}\` must have a non-empty reason.`,
        );
      }
      if (value.parts.includes(part)) {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.omittedParts\` part "${part}" is also declared in parts — a part is either declared or omitted, never both.`,
        );
      }
    }
  }
  if (!Array.isArray(value.axes)) {
    throw new Error(`Invalid Figma generation contract: \`${path}.axes\` must be an array.`);
  }
  value.axes.forEach((axis, index) => {
    validateAxis(axis, `${path}.axes[${index}]`, true);
  });
  if (value.slots !== undefined) {
    if (!Array.isArray(value.slots)) {
      throw new Error(`Invalid Figma generation contract: \`${path}.slots\` must be an array.`);
    }
    value.slots.forEach((slot, index) => {
      const slotPath = `${path}.slots[${index}]`;
      requireObject(slot, slotPath);
      requireNonEmptyString(slot.name, `${slotPath}.name`);
      requireNonEmptyString(slot.part, `${slotPath}.part`);
      if (slot.codeProp !== undefined) requireNonEmptyString(slot.codeProp, `${slotPath}.codeProp`);
      if (slot.required !== undefined && typeof slot.required !== "boolean") {
        throw new Error(
          `Invalid Figma generation contract: \`${slotPath}.required\` must be a boolean.`,
        );
      }
      if (slot.defaultContent !== undefined && slot.defaultContent !== "anatomy") {
        throw new Error(
          `Invalid Figma generation contract: \`${slotPath}.defaultContent\` must be "anatomy".`,
        );
      }
      if (slot.stretch !== undefined && typeof slot.stretch !== "boolean") {
        throw new Error(
          `Invalid Figma generation contract: \`${slotPath}.stretch\` must be a boolean.`,
        );
      }
      if (slot.composedChild !== undefined) {
        const composedChildPath = `${slotPath}.composedChild`;
        requireObject(slot.composedChild, composedChildPath);
        requireNonEmptyString(slot.composedChild.component, `${composedChildPath}.component`);
        if (slot.composedChild.variantKey !== undefined) {
          requireStringRecord(slot.composedChild.variantKey, `${composedChildPath}.variantKey`);
        }
        if (slot.composedChild.variantKeyFromAxes !== undefined) {
          requireStringRecord(
            slot.composedChild.variantKeyFromAxes,
            `${composedChildPath}.variantKeyFromAxes`,
          );
        }
      }
    });
  }
  if (value.properties !== undefined) validateProperties(value.properties, `${path}.properties`);
  if (value.anatomy !== undefined) {
    validateAnatomy(value.anatomy, `${path}.anatomy`, true);
  }
  validateViewport(value, path);
  if (value.literalGeometry !== undefined) {
    if (!Array.isArray(value.literalGeometry)) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.literalGeometry\` must be an array.`,
      );
    }
    value.literalGeometry.forEach((literal, index) => {
      const literalPath = `${path}.literalGeometry[${index}]`;
      requireObject(literal, literalPath);
      requireNonEmptyString(literal.part, `${literalPath}.part`);
      if (literal.when !== undefined) requireStringRecord(literal.when, `${literalPath}.when`);
      for (const dimension of ["width", "height", "fontSize", "lineHeight"]) {
        const dimensionValue = literal[dimension];
        if (
          dimensionValue !== undefined &&
          (typeof dimensionValue !== "number" ||
            !Number.isFinite(dimensionValue) ||
            dimensionValue <= 0)
        ) {
          throw new Error(
            `Invalid Figma generation contract: \`${literalPath}.${dimension}\` must be positive.`,
          );
        }
      }
      if (
        literal.lineHeightUnit !== undefined &&
        literal.lineHeightUnit !== "pixels" &&
        literal.lineHeightUnit !== "unitless"
      ) {
        throw new Error(
          `Invalid Figma generation contract: \`${literalPath}.lineHeightUnit\` is invalid.`,
        );
      }
      if (literal.lineHeightUnit !== undefined && literal.lineHeight === undefined) {
        throw new Error(
          `Invalid Figma generation contract: \`${literalPath}.lineHeightUnit\` requires lineHeight.`,
        );
      }
    });
  }
  requireObject(value.documentation, `${path}.documentation`);
  if (!Array.isArray(value.documentation.examples) || value.documentation.examples.length === 0) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.documentation.examples\` must not be empty.`,
    );
  }
  value.documentation.examples.forEach((example, index) => {
    const examplePath = `${path}.documentation.examples[${index}]`;
    requireObject(example, examplePath);
    requireNonEmptyString(example.label, `${examplePath}.label`);
    requireStringRecord(example.key, `${examplePath}.key`);
    if (example.slots !== undefined) {
      requireStringRecord(example.slots, `${examplePath}.slots`);
    }
    if (example.runtimeValues !== undefined) {
      requireStringRecord(example.runtimeValues, `${examplePath}.runtimeValues`);
    }
  });
  if (value.runtimeValues !== undefined) {
    if (!Array.isArray(value.runtimeValues)) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.runtimeValues\` must be an array.`,
      );
    }
    value.runtimeValues.forEach((declaration, index) => {
      const declarationPath = `${path}.runtimeValues[${index}]`;
      requireObject(declaration, declarationPath);
      requireNonEmptyString(declaration.name, `${declarationPath}.name`);
      requireNonEmptyString(declaration.part, `${declarationPath}.part`);
      requireNonEmptyString(declaration.measures, `${declarationPath}.measures`);
      requireStringArray(declaration.replaces, `${declarationPath}.replaces`);
      requireNonEmptyString(declaration.reason, `${declarationPath}.reason`);
    });
  }
  const runtimeErrors = runtimeValueErrors(value as unknown as FigmaGenerationContract);
  if (runtimeErrors.length > 0) {
    throw new Error(`Invalid Figma generation contract: ${runtimeErrors[0]}`);
  }
  const propertyRefusals = propertyErrors(value as unknown as FigmaGenerationContract);
  if (propertyRefusals.length > 0) {
    throw new Error(`Invalid Figma generation contract: ${propertyRefusals[0]}`);
  }
  validateComponentSets(value, path);
}

/** Shape of `split`, `capReason` and `buildingBlocks`; the cross-field rules run in `componentSetErrors`. */
/** A split's shape, for the contract's own and each shape's: an axis, or a list of two or more. */
function validateSplit(split: unknown, path: string): void {
  requireObject(split, path);
  const axis = split.axis;
  if (Array.isArray(axis)) {
    if (axis.length < 2) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.axis\` lists a single axis; write it as a string, or list two or more.`,
      );
    }
    axis.forEach((entry, index) => {
      requireNonEmptyString(entry, `${path}.axis[${index}]`);
    });
  } else {
    requireNonEmptyString(axis, `${path}.axis`);
  }
}

/** A focus ring declaration's shape, the contract's own or a Building Block's. */
function validateFocusRing(ring: unknown, path: string): void {
  requireObject(ring, path);
  if (ring.property !== undefined) requireNonEmptyString(ring.property, `${path}.property`);
  if (ring.insetPx !== undefined && typeof ring.insetPx !== "number") {
    throw new Error(`Invalid Figma generation contract: \`${path}.insetPx\` must be a number.`);
  }
  if (ring.insetPxByAxis !== undefined) {
    requireObject(ring.insetPxByAxis, `${path}.insetPxByAxis`);
    requireNonEmptyString(ring.insetPxByAxis.axis, `${path}.insetPxByAxis.axis`);
    requireObject(ring.insetPxByAxis.values, `${path}.insetPxByAxis.values`);
    for (const [value, inset] of Object.entries(ring.insetPxByAxis.values)) {
      if (typeof inset !== "number") {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.insetPxByAxis.values.${value}\` must be a number.`,
        );
      }
    }
  }
}

function validateComponentSets(value: Record<string, unknown>, path: string): void {
  if (value.split !== undefined) validateSplit(value.split, `${path}.split`);
  if (value.shapes !== undefined) {
    if (!Array.isArray(value.shapes)) {
      throw new Error(`Invalid Figma generation contract: \`${path}.shapes\` must be an array.`);
    }
    value.shapes.forEach((shape, index) => {
      const shapePath = `${path}.shapes[${index}]`;
      requireObject(shape, shapePath);
      if (shape.name !== undefined) requireNonEmptyString(shape.name, `${shapePath}.name`);
      requireObject(shape.values, `${shapePath}.values`);
      for (const [axis, values] of Object.entries(shape.values as Record<string, unknown>)) {
        if (!Array.isArray(values) || values.length === 0) {
          throw new Error(
            `Invalid Figma generation contract: \`${shapePath}.values.${axis}\` must list one or more values.`,
          );
        }
        values.forEach((entry, valueIndex) => {
          requireNonEmptyString(entry, `${shapePath}.values.${axis}[${valueIndex}]`);
        });
      }
      if (shape.split !== undefined) validateSplit(shape.split, `${shapePath}.split`);
    });
  }
  if (value.focusRing !== undefined) validateFocusRing(value.focusRing, `${path}.focusRing`);
  if (value.capReason !== undefined) requireNonEmptyString(value.capReason, `${path}.capReason`);
  if (value.buildingBlocks !== undefined) {
    if (!Array.isArray(value.buildingBlocks)) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.buildingBlocks\` must be an array.`,
      );
    }
    value.buildingBlocks.forEach((block, index) => {
      const blockPath = `${path}.buildingBlocks[${index}]`;
      requireObject(block, blockPath);
      requireNonEmptyString(block.part, `${blockPath}.part`);
      if (block.name !== undefined) requireNonEmptyString(block.name, `${blockPath}.name`);
      if (!Array.isArray(block.axes)) {
        throw new Error(
          `Invalid Figma generation contract: \`${blockPath}.axes\` must be an array.`,
        );
      }
      for (const [axisIndex, axis] of block.axes.entries()) {
        validateAxis(axis, `${blockPath}.axes[${axisIndex}]`, true);
      }
      if (block.split !== undefined) validateSplit(block.split, `${blockPath}.split`);
      if (block.focusRing !== undefined)
        validateFocusRing(block.focusRing, `${blockPath}.focusRing`);
    });
  }
  const refusals = componentSetErrors(value as unknown as FigmaGenerationContract);
  if (refusals.length > 0) throw new Error(`Invalid Figma generation contract: ${refusals[0]}`);
}

/** A compiled entry carries one compiled block for each Building Block its contract declares. */
function validateCompiledBuildingBlocks(
  entry: Record<string, unknown>,
  contract: Record<string, unknown>,
  path: string,
): void {
  const declared = (contract.buildingBlocks ?? []) as Array<{ part: string }>;
  const compiled = entry.buildingBlocks;
  if (compiled === undefined) {
    if (declared.length > 0) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.buildingBlocks\` is missing; the contract declares ${declared.length} Building Block(s), so rebuild the artifact.`,
      );
    }
    return;
  }
  if (!Array.isArray(compiled) || compiled.length !== declared.length) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.buildingBlocks\` must hold one compiled block for each Building Block the contract declares.`,
    );
  }
  compiled.forEach((block, index) => {
    const blockPath = `${path}.buildingBlocks[${index}]`;
    requireObject(block, blockPath);
    if (block.part !== declared[index].part) {
      throw new Error(
        `Invalid Figma generation contract: \`${blockPath}.part\` must be "${declared[index].part}", in declaration order.`,
      );
    }
    validateContract(block.contract, `${blockPath}.contract`);
    validateResolvedPlan(block.resolvedPlan, `${blockPath}.resolvedPlan`);
    const blockContract = block.contract as Record<string, unknown>;
    const blockPlan = block.resolvedPlan as Record<string, unknown>;
    if (blockContract.componentName !== blockPlan.component) {
      throw new Error(
        `Invalid Figma generation contract: \`${blockPath}.resolvedPlan.component\` must match the block contract component name.`,
      );
    }
    validateContractPlanAlignment(blockContract, blockPlan, blockPath);
  });
}

function validateViewport(contract: Record<string, unknown>, path: string): void {
  const axes = contract.axes as Array<Record<string, unknown>>;
  const contextAxis = axes.find((axis) => axis.prop === VIEWPORT_CONTEXT_AXIS_PROP);
  const viewportPath = `${path}.viewport`;
  if (contract.viewport === undefined) {
    if (contextAxis) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.axes\` declares "${VIEWPORT_CONTEXT_AXIS_PROP}" without a viewport.`,
      );
    }
    return;
  }
  requireObject(contract.viewport, viewportPath);
  const viewport = contract.viewport;
  if (
    typeof viewport.placement !== "string" ||
    !VIEWPORT_PLACEMENTS.has(viewport.placement as ViewportPlacement)
  ) {
    throw new Error(`Invalid Figma generation contract: \`${viewportPath}.placement\` is invalid.`);
  }
  requireNonEmptyString(viewport.reason, `${viewportPath}.reason`);
  if (viewport.placement === "docked") {
    requireObject(viewport.dock, `${viewportPath}.dock`);
    requireNonEmptyString(viewport.dock.axis, `${viewportPath}.dock.axis`);
    requireObject(viewport.dock.edges, `${viewportPath}.dock.edges`);
    for (const [value, edge] of Object.entries(viewport.dock.edges)) {
      if (typeof edge !== "string" || !VIEWPORT_EDGES.has(edge as never)) {
        throw new Error(
          `Invalid Figma generation contract: \`${viewportPath}.dock.edges.${value}\` is invalid.`,
        );
      }
    }
    if (!axes.some((axis) => axis.prop === (viewport.dock as Record<string, unknown>).axis)) {
      throw new Error(
        `Invalid Figma generation contract: \`${viewportPath}.dock.axis\` must name a declared axis.`,
      );
    }
  }
  if (viewport.placement === "corner") {
    const edges = typeof viewport.corner === "string" ? cornerEdges(viewport.corner) : undefined;
    if (!edges) {
      throw new Error(`Invalid Figma generation contract: \`${viewportPath}.corner\` is invalid.`);
    }
    requireObject(viewport.cornerOffsets, `${viewportPath}.cornerOffsets`);
    for (const edge of edges) {
      requireNonEmptyString(
        (viewport.cornerOffsets as Record<string, unknown>)[edge],
        `${viewportPath}.cornerOffsets.${edge}`,
      );
    }
  }
  requireNonEmptyString(viewport.frameWidthVariable, `${viewportPath}.frameWidthVariable`);
  if (viewport.framePaddingBlock !== undefined) {
    requireNonEmptyString(viewport.framePaddingBlock, `${viewportPath}.framePaddingBlock`);
  }
  if (viewport.backdropPart !== undefined) {
    requireNonEmptyString(viewport.backdropPart, `${viewportPath}.backdropPart`);
    if (!(contract.parts as string[]).includes(viewport.backdropPart)) {
      throw new Error(
        `Invalid Figma generation contract: \`${viewportPath}.backdropPart\` must be declared in parts.`,
      );
    }
  }
  if (viewport.popupWidth !== undefined) {
    const widthPath = `${viewportPath}.popupWidth`;
    requireObject(viewport.popupWidth, widthPath);
    requireNonEmptyString(viewport.popupWidth.source, `${widthPath}.source`);
    requireNonEmptyString(viewport.popupWidth.marginVariable, `${widthPath}.marginVariable`);
    const maxWidthPx = viewport.popupWidth.maxWidthPx;
    if (typeof maxWidthPx !== "number" || !Number.isFinite(maxWidthPx) || maxWidthPx <= 0) {
      throw new Error(
        `Invalid Figma generation contract: \`${widthPath}.maxWidthPx\` must be positive.`,
      );
    }
  }
  if (
    !contextAxis ||
    JSON.stringify(contextAxis.values) !== JSON.stringify(VIEWPORT_CONTEXT_AXIS.values) ||
    contextAxis.default !== VIEWPORT_CONTEXT_AXIS.default
  ) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.axes\` must declare the viewport context axis (${VIEWPORT_CONTEXT_AXIS.values.join(" | ")}, default ${VIEWPORT_CONTEXT_AXIS.default}).`,
    );
  }
  const anatomy = contract.anatomy as Record<string, unknown> | undefined;
  if (anatomy?.positionAlongMain !== undefined || anatomy?.positionAlongMainByAxis !== undefined) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.anatomy\` root must not declare positionAlongMain when a viewport is declared.`,
    );
  }
}

const ANATOMY_KINDS = new Set(["frame", "text", "icon", "rectangle", "ellipse", "image"]);
const ANATOMY_LAYOUTS = new Set(["horizontal", "vertical", "overlay"]);
const BINDING_ROLES = new Set(["fill", "text", "stroke", "textStyle", "effectStyle"]);
const POSITION_ALONG_MAIN_ANCHORS = new Set(["start", "center", "end", "stretch"]);

function validatePositionAlongMain(value: unknown, path: string): void {
  requireObject(value, path);
  if (typeof value.kind !== "string") {
    throw new Error(`Invalid Figma generation contract: \`${path}.kind\` must be a string.`);
  }
  if (POSITION_ALONG_MAIN_ANCHORS.has(value.kind)) return;
  if (value.kind === "valueOf") {
    validateValueOfSource(value, path);
    return;
  }
  if (value.kind === "refused") {
    requireNonEmptyString(value.jsProperty, `${path}.jsProperty`);
    return;
  }
  throw new Error(
    `Invalid Figma generation contract: \`${path}.kind\` must be one of start, center, end, stretch, valueOf, refused.`,
  );
}

function validateSizeAlongMain(value: unknown, path: string): void {
  requireObject(value, path);
  if (value.kind !== "valueOf") {
    throw new Error(`Invalid Figma generation contract: \`${path}.kind\` must be "valueOf".`);
  }
  validateValueOfSource(value, path);
}

function validateValueOfSource(value: Record<string, unknown>, path: string): void {
  if ((value.slot === undefined) === (value.runtimeValue === undefined)) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}\` must read exactly one of slot or runtimeValue.`,
    );
  }
  if (value.slot !== undefined) requireNonEmptyString(value.slot, `${path}.slot`);
  else requireNonEmptyString(value.runtimeValue, `${path}.runtimeValue`);
}

/** Validates one anatomy node and, recursively, its children. */
function validateAnatomy(value: unknown, path: string, isRoot = false): void {
  requireObject(value, path);
  requireNonEmptyString(value.part, `${path}.part`);
  if (typeof value.kind !== "string" || !ANATOMY_KINDS.has(value.kind)) {
    throw new Error(`Invalid Figma generation contract: \`${path}.kind\` is invalid.`);
  }

  if (
    value.layout !== undefined &&
    (typeof value.layout !== "string" || !ANATOMY_LAYOUTS.has(value.layout))
  ) {
    throw new Error(`Invalid Figma generation contract: \`${path}.layout\` is invalid.`);
  }
  if (value.layoutByAxis !== undefined) {
    requireObject(value.layoutByAxis, `${path}.layoutByAxis`);
    requireNonEmptyString(value.layoutByAxis.axis, `${path}.layoutByAxis.axis`);
    requireObject(value.layoutByAxis.values, `${path}.layoutByAxis.values`);
    for (const [key, layout] of Object.entries(value.layoutByAxis.values)) {
      if (typeof layout !== "string" || !ANATOMY_LAYOUTS.has(layout)) {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.layoutByAxis.values.${key}\` is invalid.`,
        );
      }
    }
  }
  if (value.slots !== undefined) requireStringArray(value.slots, `${path}.slots`);
  if (value.synthetic !== undefined && typeof value.synthetic !== "boolean") {
    throw new Error(`Invalid Figma generation contract: \`${path}.synthetic\` must be boolean.`);
  }
  if (value.when !== undefined) requireStringOrStringArrayRecord(value.when, `${path}.when`);
  if (value.unless !== undefined) requireStringOrStringArrayRecord(value.unless, `${path}.unless`);
  if (
    value.repeat !== undefined &&
    (typeof value.repeat !== "number" || !Number.isInteger(value.repeat) || value.repeat < 1)
  ) {
    throw new Error(`Invalid Figma generation contract: \`${path}.repeat\` must be positive.`);
  }
  if (value.repeat !== undefined && value.items !== undefined) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}\` cannot use repeat and items together.`,
    );
  }
  if (value.items !== undefined) {
    if (!Array.isArray(value.items) || value.items.length === 0) {
      throw new Error(`Invalid Figma generation contract: \`${path}.items\` must not be empty.`);
    }
    value.items.forEach((item, index) => {
      requireObject(item, `${path}.items[${index}]`);
      if (item.key !== undefined) requireStringRecord(item.key, `${path}.items[${index}].key`);
      if (item.slots !== undefined)
        requireStringRecord(item.slots, `${path}.items[${index}].slots`);
    });
  }
  if (value.requiredBindings !== undefined) {
    requireStringArray(value.requiredBindings, `${path}.requiredBindings`);
    if (value.requiredBindings.some((role) => !BINDING_ROLES.has(role))) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.requiredBindings\` contains an invalid role.`,
      );
    }
  }

  if (value.iconName !== undefined) requireNonEmptyString(value.iconName, `${path}.iconName`);
  if (value.iconPath !== undefined) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.iconPath\` is the old bare-path shape and is ` +
        "no longer accepted — icons carry a complete `iconSvg` element.",
    );
  }
  if (value.iconSvg !== undefined) requireSvgElementString(value.iconSvg, `${path}.iconSvg`);
  if (value.kind === "icon" && (value.iconName === undefined || value.iconSvg === undefined)) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}\` icons require embedded iconName and iconSvg.`,
    );
  }
  if (value.imageAssetPath !== undefined) {
    requireNonEmptyString(value.imageAssetPath, `${path}.imageAssetPath`);
  }
  if (value.imageData !== undefined) requireNonEmptyString(value.imageData, `${path}.imageData`);
  if (value.imageMimeType !== undefined) {
    requireNonEmptyString(value.imageMimeType, `${path}.imageMimeType`);
  }
  if (
    value.kind === "image" &&
    (value.imageAssetPath === undefined ||
      value.imageData === undefined ||
      value.imageMimeType === undefined)
  ) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}\` images require embedded imageAssetPath, ` +
        "imageData, and imageMimeType.",
    );
  }

  if (value.arc !== undefined) validateArc(value.arc, value.kind, `${path}.arc`);

  if (value.removeFromFlow !== undefined && typeof value.removeFromFlow !== "boolean") {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.removeFromFlow\` must be boolean.`,
    );
  }
  if (value.positionAlongMain !== undefined) {
    validatePositionAlongMain(value.positionAlongMain, `${path}.positionAlongMain`);
  }
  if (value.sizeAlongMain !== undefined) {
    validateSizeAlongMain(value.sizeAlongMain, `${path}.sizeAlongMain`);
  }
  if (value.positionAlongMainByAxis !== undefined) {
    const byAxisPath = `${path}.positionAlongMainByAxis`;
    requireObject(value.positionAlongMainByAxis, byAxisPath);
    requireNonEmptyString(value.positionAlongMainByAxis.axis, `${byAxisPath}.axis`);
    requireObject(value.positionAlongMainByAxis.values, `${byAxisPath}.values`);
    for (const [key, declared] of Object.entries(value.positionAlongMainByAxis.values)) {
      validatePositionAlongMain(declared, `${byAxisPath}.values.${key}`);
    }
  }
  if (value.overlayCrossAlignByAxis !== undefined) {
    const byAxisPath = `${path}.overlayCrossAlignByAxis`;
    requireObject(value.overlayCrossAlignByAxis, byAxisPath);
    requireNonEmptyString(value.overlayCrossAlignByAxis.axis, `${byAxisPath}.axis`);
    requireObject(value.overlayCrossAlignByAxis.values, `${byAxisPath}.values`);
    for (const [key, align] of Object.entries(value.overlayCrossAlignByAxis.values)) {
      if (!POSITION_ALONG_MAIN_ANCHORS.has(align as string)) {
        throw new Error(
          `Invalid Figma generation contract: \`${byAxisPath}.values.${key}\` must be one of start, center, end, stretch.`,
        );
      }
    }
  }
  if (value.removeFromFlowByAxis !== undefined) {
    const byAxisPath = `${path}.removeFromFlowByAxis`;
    requireObject(value.removeFromFlowByAxis, byAxisPath);
    requireNonEmptyString(value.removeFromFlowByAxis.axis, `${byAxisPath}.axis`);
    requireObject(value.removeFromFlowByAxis.values, `${byAxisPath}.values`);
    for (const [key, flag] of Object.entries(value.removeFromFlowByAxis.values)) {
      if (typeof flag !== "boolean") {
        throw new Error(
          `Invalid Figma generation contract: \`${byAxisPath}.values.${key}\` must be boolean.`,
        );
      }
    }
  }
  const hasPositioning =
    value.removeFromFlow !== undefined ||
    value.removeFromFlowByAxis !== undefined ||
    value.positionAlongMain !== undefined ||
    value.positionAlongMainByAxis !== undefined ||
    value.sizeAlongMain !== undefined;
  if (hasPositioning) {
    if (isRoot) {
      const isRootRefusalOnly =
        value.removeFromFlow === undefined &&
        value.removeFromFlowByAxis === undefined &&
        value.positionAlongMainByAxis === undefined &&
        value.sizeAlongMain === undefined &&
        (value.positionAlongMain as { kind?: string } | undefined)?.kind === "refused";
      if (!isRootRefusalOnly) {
        throw new Error(
          `Invalid Figma generation contract: \`${path}\` cannot declare removeFromFlow/positionAlongMain/sizeAlongMain on the root part — it has no parent, except a root-level positionAlongMain: { kind: "refused" }.`,
        );
      }
    }
    if (typeof value.reason !== "string" || !value.reason.trim()) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.reason\` is required whenever removeFromFlow, positionAlongMain, or sizeAlongMain is declared.`,
      );
    }
  }

  if (value.docsLayout !== undefined) {
    const docsLayoutPath = `${path}.docsLayout`;
    requireObject(value.docsLayout, docsLayoutPath);
    if (!value.synthetic) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}\` declares docsLayout but is not synthetic — ` +
          "docsLayout is only allowed on a synthetic composed-child container.",
      );
    }
    requireNonEmptyString(value.docsLayout.source, `${docsLayoutPath}.source`);
    if (!parseDocsLayoutSource(value.docsLayout.source)) {
      throw new Error(
        `Invalid Figma generation contract: \`${docsLayoutPath}.source\` must be shaped "<docs file path>:<line>".`,
      );
    }
    if (
      value.docsLayout.gap !== undefined &&
      (typeof value.docsLayout.gap !== "string" ||
        !DOCS_LAYOUT_GAP_TOKEN_RE.test(value.docsLayout.gap))
    ) {
      throw new Error(
        `Invalid Figma generation contract: \`${docsLayoutPath}.gap\` must be a bare "var(--token-name)" reference.`,
      );
    }
    if (
      value.docsLayout.justify !== undefined &&
      !DOCS_LAYOUT_JUSTIFY_VALUES.has(value.docsLayout.justify as string)
    ) {
      throw new Error(
        `Invalid Figma generation contract: \`${docsLayoutPath}.justify\` must be one of start, center, end, space-between.`,
      );
    }
    if (
      value.docsLayout.align !== undefined &&
      !DOCS_LAYOUT_ALIGN_VALUES.has(value.docsLayout.align as string)
    ) {
      throw new Error(
        `Invalid Figma generation contract: \`${docsLayoutPath}.align\` must be one of start, center, end, stretch.`,
      );
    }
  }

  if (value.children !== undefined) {
    if (!Array.isArray(value.children)) {
      throw new Error(`Invalid Figma generation contract: \`${path}.children\` must be an array.`);
    }
    value.children.forEach((child, index) => {
      validateAnatomy(child, `${path}.children[${index}]`);
    });
  }
}

/** Collects the names of synthetic parts in an anatomy tree. */
function collectSyntheticParts(
  node: Record<string, unknown> | undefined,
  parts = new Set<string>(),
): Set<string> {
  if (!node) return parts;
  if (node.synthetic === true && typeof node.part === "string") parts.add(node.part);
  (node.children as Array<Record<string, unknown>> | undefined)?.forEach((child) => {
    collectSyntheticParts(child, parts);
  });
  return parts;
}

/** Validates a cell's variable bindings. */
function validateBinding(value: unknown, path: string): void {
  requireObject(value, path);
  for (const field of ["fill", "text", "stroke", "effectStyle"]) {
    if (value[field] !== undefined) requireNonEmptyString(value[field], `${path}.${field}`);
  }
  if (value.strokeFromText !== undefined && value.strokeFromText !== true) {
    throw new Error(`Invalid Figma generation contract: \`${path}.strokeFromText\` must be true.`);
  }
}

/** Validates a size: a variable binding, literal pixels, fill or hug. */
function validateDimension(value: unknown, path: string): void {
  requireObject(value, path);
  if (value.kind === "variable") {
    requireNonEmptyString(value.variable, `${path}.variable`);
    return;
  }
  if (value.kind === "fill" || value.kind === "hug") return;
  if (value.kind === "literal") {
    if (typeof value.px !== "number" || !Number.isFinite(value.px) || value.px < 0) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.px\` must be a finite non-negative number.`,
      );
    }
    return;
  }
  if (value.kind === "unsupported") {
    requireNonEmptyString(value.value, `${path}.value`);
    return;
  }
  if (value.kind === "runtime") {
    requireNonEmptyString(value.property, `${path}.property`);
    return;
  }
  throw new Error(
    `Invalid Figma generation contract: \`${path}.kind\` must be variable, fill, literal, hug, unsupported, or runtime.`,
  );
}

/** Throws unless a value is one of the allowed strings. */
function validateEnum(value: unknown, path: string, allowed: readonly string[]): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}\` must be one of ${allowed.join(", ")}.`,
    );
  }
}

/**
 * Validate an anatomy node's `arc`: only on an `ellipse`, a finite `sweep` strictly between 0
 * and 360 degrees, and an optional finite `start`. A full ring needs no arc, and a zero sweep
 * draws nothing, so both are rejected.
 */
function validateArc(value: unknown, kind: unknown, path: string): void {
  requireObject(value, path);
  if (kind !== "ellipse") {
    throw new Error(`Invalid Figma generation contract: \`${path}\` is only valid on an ellipse.`);
  }
  const { sweep, start } = value;
  if (typeof sweep !== "number" || !Number.isFinite(sweep) || sweep <= 0 || sweep >= 360) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.sweep\` must be a number greater than 0 and less than 360.`,
    );
  }
  if (start !== undefined && (typeof start !== "number" || !Number.isFinite(start))) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.start\` must be a finite number.`,
    );
  }
}

/** Validates a geometry object field by field. */
function validateGeometry(value: unknown, path: string): void {
  requireObject(value, path);
  for (const field of [
    "paddingInline",
    "paddingBlock",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "paddingBottom",
    "gap",
    "radius",
    "borderWidth",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "textStyle",
    "opacity",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "counterAxisSpacing",
  ]) {
    if (value[field] !== undefined) requireNonEmptyString(value[field], `${path}.${field}`);
  }
  for (const field of ["minWidthPx", "maxWidthPx", "minHeightPx", "maxHeightPx"]) {
    const limit = value[field];
    if (
      limit !== undefined &&
      (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0)
    ) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.${field}\` must be a finite positive number.`,
      );
    }
  }
  if (value.clipsContent !== undefined && value.clipsContent !== true) {
    throw new Error(`Invalid Figma generation contract: \`${path}.clipsContent\` must be true.`);
  }
  if (value.layoutWrap !== undefined) {
    validateEnum(value.layoutWrap, `${path}.layoutWrap`, ["WRAP"]);
  }
  if (value.constraints !== undefined) {
    requireObject(value.constraints, `${path}.constraints`);
    for (const axis of ["horizontal", "vertical"]) {
      if (value.constraints[axis] !== undefined) {
        validateEnum(value.constraints[axis], `${path}.constraints.${axis}`, ["SCALE"]);
      }
    }
  }
  if (value.insetPercent !== undefined) {
    requireObject(value.insetPercent, `${path}.insetPercent`);
    for (const side of ["top", "right", "bottom", "left"]) {
      const percent = value.insetPercent[side];
      if (percent !== undefined && (typeof percent !== "number" || !Number.isFinite(percent))) {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.insetPercent.${side}\` must be a finite number.`,
        );
      }
    }
  }
  for (const field of ["width", "height"]) {
    if (value[field] !== undefined) validateDimension(value[field], `${path}.${field}`);
  }
  if (value.layoutMode !== undefined) {
    validateEnum(value.layoutMode, `${path}.layoutMode`, ["HORIZONTAL", "VERTICAL"]);
  }
  if (value.primaryAxisAlignItems !== undefined) {
    validateEnum(value.primaryAxisAlignItems, `${path}.primaryAxisAlignItems`, [
      "MIN",
      "CENTER",
      "MAX",
      "SPACE_BETWEEN",
    ]);
  }
  if (value.counterAxisAlignItems !== undefined) {
    validateEnum(value.counterAxisAlignItems, `${path}.counterAxisAlignItems`, [
      "MIN",
      "CENTER",
      "MAX",
    ]);
  }
  if (value.alignItems !== undefined) {
    validateEnum(value.alignItems, `${path}.alignItems`, ["stretch"]);
  }
  if (value.alignSelf !== undefined) {
    validateEnum(value.alignSelf, `${path}.alignSelf`, ["MIN", "CENTER", "MAX"]);
  }
  if (value.textAlignHorizontal !== undefined) {
    validateEnum(value.textAlignHorizontal, `${path}.textAlignHorizontal`, [
      "LEFT",
      "CENTER",
      "RIGHT",
      "JUSTIFIED",
    ]);
  }
  if (value.textCase !== undefined) {
    validateEnum(value.textCase, `${path}.textCase`, ["UPPER", "LOWER", "ORIGINAL"]);
  }
  if (
    value.aspectRatio !== undefined &&
    (typeof value.aspectRatio !== "number" ||
      !Number.isFinite(value.aspectRatio) ||
      value.aspectRatio <= 0)
  ) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.aspectRatio\` must be a finite positive number.`,
    );
  }
  if (
    value.radiusPx !== undefined &&
    (typeof value.radiusPx !== "number" || !Number.isFinite(value.radiusPx) || value.radiusPx <= 0)
  ) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.radiusPx\` must be a finite positive number.`,
    );
  }
}

/** Validates one variant cell: key, label, bindings and geometry. */
function validateCell(value: unknown, path: string): void {
  requireObject(value, path);
  requireStringRecord(value.key, `${path}.key`);
  requireNonEmptyString(value.label, `${path}.label`);
  validateBinding(value.bind, `${path}.bind`);
  if (value.geometry !== undefined) validateGeometry(value.geometry, `${path}.geometry`);
  if (value.iconName !== undefined) requireNonEmptyString(value.iconName, `${path}.iconName`);
  if (value.iconPath !== undefined) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.iconPath\` is the old bare-path shape and is ` +
        "no longer accepted — icons carry a complete `iconSvg` element.",
    );
  }
  if (value.iconSvg !== undefined) requireSvgElementString(value.iconSvg, `${path}.iconSvg`);
  if ((value.iconName === undefined) !== (value.iconSvg === undefined)) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}\` must carry both iconName and iconSvg together, or neither.`,
    );
  }
}

/** Validates the resolved plan: schema version, base geometry, variant matrix and part bindings. */
function validateResolvedPlan(value: unknown, path: string): void {
  requireObject(value, path);
  if (value.schemaVersion !== RESOLVED_PLAN_SCHEMA_VERSION) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.schemaVersion\` must be ${RESOLVED_PLAN_SCHEMA_VERSION}.`,
    );
  }
  requireNonEmptyString(value.component, `${path}.component`);
  requireStringArray(value.parts, `${path}.parts`);
  if (!Array.isArray(value.variantAxes)) {
    throw new Error(`Invalid Figma generation contract: \`${path}.variantAxes\` must be an array.`);
  }
  value.variantAxes.forEach((axis, index) => {
    validateAxis(axis, `${path}.variantAxes[${index}]`, false);
  });
  if (!Array.isArray(value.variantMatrix)) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.variantMatrix\` must be an array.`,
    );
  }
  if (value.variantMatrix.length === 0) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.variantMatrix\` must not be empty.`,
    );
  }
  value.variantMatrix.forEach((cell, index) => {
    validateCell(cell, `${path}.variantMatrix[${index}]`);
  });
  validateGeometry(value.baseGeometry, `${path}.baseGeometry`);
  if (value.gridLabels !== null) {
    requireObject(value.gridLabels, `${path}.gridLabels`);
    requireStringArray(value.gridLabels.rows, `${path}.gridLabels.rows`);
    requireStringArray(value.gridLabels.cols, `${path}.gridLabels.cols`);
  }
  if (value.partBindings !== undefined) {
    requireObject(value.partBindings, `${path}.partBindings`);
    for (const [part, cells] of Object.entries(value.partBindings)) {
      if (!Array.isArray(cells)) {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.partBindings.${part}\` must be an array.`,
        );
      }
      cells.forEach((cell, index) => {
        validateCell(cell, `${path}.partBindings.${part}[${index}]`);
      });
    }
  }
}

/** Whether two string records hold the same entries. */
function sameRecord(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/** Throws when the resolved plan does not line up with the contract's axes and parts. */
function validateContractPlanAlignment(
  contract: Record<string, unknown>,
  resolvedPlan: Record<string, unknown>,
  path: string,
): void {
  const contractAxes = contract.axes as Array<Record<string, unknown>>;
  const planAxes = resolvedPlan.variantAxes as Array<Record<string, unknown>>;
  const axesMatch =
    contractAxes.length === planAxes.length &&
    contractAxes.every((axis, index) => {
      const planAxis = planAxes[index];
      return (
        axis.prop === planAxis.prop &&
        axis.default === planAxis.default &&
        JSON.stringify(axis.values) === JSON.stringify(planAxis.values)
      );
    });
  if (!axesMatch) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.resolvedPlan.variantAxes\` must match the contract axes.`,
    );
  }

  const axisValues = new Map(
    contractAxes.map((axis) => [axis.prop as string, new Set(axis.values as string[])]),
  );
  const matrix = resolvedPlan.variantMatrix as Array<Record<string, unknown>>;
  const expectedCellCount = contractAxes.reduce(
    (count, axis) => count * (axis.values as string[]).length,
    1,
  );
  if (matrix.length !== expectedCellCount) {
    throw new Error(
      `Invalid Figma generation contract: \`${path}.resolvedPlan.variantMatrix\` must contain the complete axis product.`,
    );
  }
  const seenKeys: Record<string, string>[] = [];
  matrix.forEach((cell, index) => {
    const key = cell.key as Record<string, string>;
    if (
      Object.keys(key).length !== axisValues.size ||
      [...axisValues].some(([axis, values]) => !values.has(key[axis]))
    ) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.resolvedPlan.variantMatrix[${index}].key\` must match the declared axes.`,
      );
    }
    if (seenKeys.some((seen) => sameRecord(seen, key))) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.resolvedPlan.variantMatrix\` contains a duplicate key.`,
      );
    }
    seenKeys.push(key);
  });

  const parts = new Set(contract.parts as string[]);
  const resolvedParts = new Set(resolvedPlan.parts as string[]);
  const syntheticParts = collectSyntheticParts(
    contract.anatomy as Record<string, unknown> | undefined,
  );
  for (const part of parts) {
    if (syntheticParts.has(part)) continue;
    if (!resolvedParts.has(part)) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.resolvedPlan.parts\` is missing contract part "${part}".`,
      );
    }
  }
  const omittedParts = (contract.omittedParts as Record<string, unknown> | undefined) ?? {};
  for (const part of Object.keys(omittedParts)) {
    if (!resolvedParts.has(part)) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.contract.omittedParts\` part "${part}" is not present in source.`,
      );
    }
  }
  const partBindings = resolvedPlan.partBindings as
    | Record<string, Array<Record<string, unknown>>>
    | undefined;
  for (const [part, cells] of Object.entries(partBindings ?? {})) {
    if (!parts.has(part) || cells.length !== matrix.length) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.resolvedPlan.partBindings.${part}\` must align with a declared part and every variant.`,
      );
    }
    cells.forEach((cell, index) => {
      if (
        !sameRecord(cell.key as Record<string, string>, matrix[index].key as Record<string, string>)
      ) {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.resolvedPlan.partBindings.${part}[${index}].key\` must match the corresponding variant key.`,
        );
      }
    });
  }

  const slots = new Map(
    ((contract.slots as Array<Record<string, unknown>> | undefined) ?? []).map((slot) => [
      slot.name as string,
      slot.part as string,
    ]),
  );
  const materializedParts = new Set<string>();
  const materializedSlots = new Set<string>();
  // A Building Block's part and everything beneath it may also read the block's own axes.
  const blocks = (contract.buildingBlocks as Array<Record<string, unknown>> | undefined) ?? [];
  function validateAnatomyReferences(
    node: Record<string, unknown>,
    nodePath: string,
    scope: Map<string, Set<string>> = axisValues,
  ): void {
    const block = blocks.find((candidate) => candidate.part === node.part);
    if (block) {
      scope = new Map(scope);
      for (const axis of (block.axes as Array<Record<string, unknown>> | undefined) ?? []) {
        scope.set(axis.prop as string, new Set((axis.values as string[] | undefined) ?? []));
      }
    }
    if (!parts.has(node.part as string)) {
      throw new Error(
        `Invalid Figma generation contract: \`${nodePath}.part\` must reference a declared part.`,
      );
    }
    if (materializedParts.has(node.part as string)) {
      throw new Error(
        `Invalid Figma generation contract: \`${nodePath}.part\` is materialized more than once.`,
      );
    }
    materializedParts.add(node.part as string);
    for (const [axis, value] of Object.entries(
      (node.when as Record<string, string | string[]> | undefined) ?? {},
    )) {
      const values = Array.isArray(value) ? value : [value];
      const unknown = values.find((v) => !scope.get(axis)?.has(v));
      if (unknown !== undefined) {
        throw new Error(
          `Invalid Figma generation contract: \`${nodePath}.when.${axis}\` value "${unknown}" is not a declared axis value.`,
        );
      }
    }
    for (const slot of (node.slots as string[] | undefined) ?? []) {
      if (slots.get(slot) !== node.part) {
        throw new Error(
          `Invalid Figma generation contract: \`${nodePath}.slots\` must reference a slot attached to this part.`,
        );
      }
      if (materializedSlots.has(slot)) {
        throw new Error(
          `Invalid Figma generation contract: \`${nodePath}.slots\` materializes "${slot}" more than once.`,
        );
      }
      materializedSlots.add(slot);
    }
    const positionAlongMainSlot = (node.positionAlongMain as Record<string, unknown> | undefined)
      ?.slot as string | undefined;
    if (positionAlongMainSlot !== undefined && !slots.has(positionAlongMainSlot)) {
      throw new Error(
        `Invalid Figma generation contract: \`${nodePath}.positionAlongMain.slot\` "${positionAlongMainSlot}" is undeclared.`,
      );
    }
    const sizeAlongMainSlot = (node.sizeAlongMain as Record<string, unknown> | undefined)?.slot as
      | string
      | undefined;
    if (sizeAlongMainSlot !== undefined && !slots.has(sizeAlongMainSlot)) {
      throw new Error(
        `Invalid Figma generation contract: \`${nodePath}.sizeAlongMain.slot\` "${sizeAlongMainSlot}" is undeclared.`,
      );
    }
    const positionAlongMainByAxisValues = (
      node.positionAlongMainByAxis as Record<string, unknown> | undefined
    )?.values as Record<string, Record<string, unknown>> | undefined;
    for (const [axisValue, declared] of Object.entries(positionAlongMainByAxisValues ?? {})) {
      const slot = declared?.slot as string | undefined;
      if (slot !== undefined && !slots.has(slot)) {
        throw new Error(
          `Invalid Figma generation contract: \`${nodePath}.positionAlongMainByAxis.values.${axisValue}.slot\` "${slot}" is undeclared.`,
        );
      }
    }
    for (const role of (node.requiredBindings as string[] | undefined) ?? []) {
      matrix.forEach((cell, index) => {
        const key = cell.key as Record<string, string>;
        const matches = (conditions: Record<string, string | string[]> | undefined) =>
          Object.entries(conditions ?? {}).every(([axis, value]) =>
            Array.isArray(value) ? value.includes(key[axis]) : key[axis] === value,
          );
        const visible =
          matches(node.when as Record<string, string | string[]> | undefined) &&
          !(node.unless !== undefined && matches(node.unless as Record<string, string | string[]>));
        if (!visible) return;
        const isRoot = node.part === contract.rootPart;
        const partCell = isRoot ? undefined : partBindings?.[node.part as string]?.[index];
        const bind = (isRoot ? cell.bind : partCell?.bind) as Record<string, unknown> | undefined;
        const geometry = (isRoot ? cell.geometry : partCell?.geometry) as
          | Record<string, unknown>
          | undefined;
        const baseGeometry = resolvedPlan.baseGeometry as Record<string, unknown> | undefined;
        if (!resolveRole(role as GenerationContractBindingRole, bind, geometry, baseGeometry)) {
          throw new Error(
            `Invalid Figma generation contract: \`${nodePath}.requiredBindings\` requires a resolved ${role} binding.`,
          );
        }
      });
    }
    (node.children as Array<Record<string, unknown>> | undefined)?.forEach((child, index) => {
      validateAnatomyReferences(child, `${nodePath}.children[${index}]`, scope);
    });
  }
  if (contract.anatomy) {
    const anatomy = contract.anatomy as Record<string, unknown>;
    if (anatomy.part !== contract.rootPart) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.contract.anatomy.part\` must match rootPart.`,
      );
    }
    validateAnatomyReferences(anatomy, `${path}.contract.anatomy`);
    const backdropPart = (contract.viewport as Record<string, unknown> | undefined)?.backdropPart;
    for (const part of parts) {
      if (part === backdropPart) continue;
      if (!materializedParts.has(part)) {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.contract.anatomy\` does not materialize part "${part}".`,
        );
      }
    }
    for (const slot of slots.keys()) {
      if (!materializedSlots.has(slot)) {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.contract.anatomy\` does not materialize slot "${slot}".`,
        );
      }
    }
  }

  for (const [index, example] of (
    (contract.documentation as Record<string, unknown>).examples as Array<Record<string, unknown>>
  ).entries()) {
    const key = example.key as Record<string, string>;
    if (!matrix.some((cell) => sameRecord(cell.key as Record<string, string>, key))) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.contract.documentation.examples[${index}].key\` must match a resolved variant.`,
      );
    }
    const exampleSlots = (example.slots as Record<string, string> | undefined) ?? {};
    for (const [slotName] of Object.entries(exampleSlots)) {
      if (!slots.has(slotName)) {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.contract.documentation.examples[${index}].slots.${slotName}\` is undeclared.`,
        );
      }
    }
    for (const slot of (contract.slots as Array<Record<string, unknown>> | undefined) ?? []) {
      if (
        slot.required === true &&
        !slot.composedChild &&
        !slot.defaultContent &&
        !((slot.name as string) in exampleSlots)
      ) {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.contract.documentation.examples[${index}].slots\` is missing required slot "${slot.name as string}".`,
        );
      }
    }
  }

  for (const [index, literal] of (
    (contract.literalGeometry as Array<Record<string, unknown>> | undefined) ?? []
  ).entries()) {
    if (!parts.has(literal.part as string)) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.contract.literalGeometry[${index}].part\` must reference a declared part.`,
      );
    }
    for (const [axis, value] of Object.entries(
      (literal.when as Record<string, string> | undefined) ?? {},
    )) {
      if (!axisValues.get(axis)?.has(value)) {
        throw new Error(
          `Invalid Figma generation contract: \`${path}.contract.literalGeometry[${index}].when.${axis}\` is not a declared axis value.`,
        );
      }
    }
  }
}

/**
 * Validates an unknown value as a generation contract artifact and returns it typed. Throws with
 * the path of the first problem.
 */
export function parseGenerationContractArtifact(value: unknown): GenerationContractArtifact {
  if (!isObject(value)) {
    throw new Error("Invalid Figma generation contract: expected a top-level object.");
  }
  if (value.artifact !== "focus.figma-generation-contract") {
    throw new Error(
      'Invalid Figma generation artifact identity: expected "focus.figma-generation-contract".',
    );
  }
  if (value.version !== GENERATION_CONTRACT_ARTIFACT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported Figma generation artifact version ${JSON.stringify(value.version)}. ` +
        `This plugin supports version ${GENERATION_CONTRACT_ARTIFACT_SCHEMA_VERSION}; update the plugin or regenerate the artifact.`,
    );
  }
  if (!isObject(value.documentationTheme)) {
    throw new Error("Invalid Figma generation contract: `documentationTheme` must be an object.");
  }
  for (const role of DOCUMENTATION_THEME_ROLES) {
    requireNonEmptyString(value.documentationTheme[role], `documentationTheme.${role}`);
  }
  if (value.documentationPage !== undefined) {
    requireObject(value.documentationPage, "documentationPage");
    for (const field of ["docsBaseUrl", "brandName"] as const) {
      if (value.documentationPage[field] !== undefined) {
        requireNonEmptyString(value.documentationPage[field], `documentationPage.${field}`);
      }
    }
    const docsBaseUrl = value.documentationPage.docsBaseUrl;
    if (typeof docsBaseUrl === "string" && !/^https?:\/\//.test(docsBaseUrl)) {
      throw new Error(
        "Invalid Figma generation contract: `documentationPage.docsBaseUrl` must be an http(s) URL.",
      );
    }
  }
  if (!Array.isArray(value.components) || value.components.length === 0) {
    throw new Error("Invalid Figma generation contract: `components` must not be empty.");
  }
  const slugs = new Set<string>();
  value.components.forEach((entry, index) => {
    const path = `components[${index}]`;
    requireObject(entry, path);
    validateContract(entry.contract, `${path}.contract`);
    validateResolvedPlan(entry.resolvedPlan, `${path}.resolvedPlan`);
    const contract = entry.contract as Record<string, unknown>;
    const resolvedPlan = entry.resolvedPlan as Record<string, unknown>;
    if (slugs.has(contract.slug as string)) {
      throw new Error(
        `Invalid Figma generation contract: duplicate component slug "${contract.slug as string}".`,
      );
    }
    slugs.add(contract.slug as string);
    if (contract.componentName !== resolvedPlan.component) {
      throw new Error(
        `Invalid Figma generation contract: \`${path}.resolvedPlan.component\` must match the contract component name.`,
      );
    }
    validateContractPlanAlignment(contract, resolvedPlan, path);
    validateCompiledBuildingBlocks(entry, contract, path);
  });

  validateComposition(
    value.components.map(
      (entry) => (entry as { contract: unknown }).contract as FigmaGenerationContract,
    ),
  );

  return value as unknown as GenerationContractArtifact;
}

/**
 * Deterministic code→Figma planner. Pure, serializable, LLM-free. Its only
 * per-component input is the compiled V2 generation artifact
 * (`.agents/figma-generation-contract.json`) — the same one the Figma
 * plugin walks. The emitter (`SKILL.md`) walks these plans via `use_figma`.
 */
export type {
  ArtifactComponent,
  ContractAnatomyNode,
  ContractAxis,
  ContractDocumentationExample,
  ContractSlot,
  DocumentationPage,
  DocumentationTheme,
  GenerationArtifact,
  GenerationArtifactErrorCode,
  GenerationContract,
  ResolvedBinding,
  ResolvedCell,
  ResolvedDimension,
  ResolvedGeometry,
  ResolvedPlan,
} from "./artifact";
export {
  findArtifactComponent,
  GENERATION_ARTIFACT_IDENTITY,
  GENERATION_ARTIFACT_PATH,
  GenerationArtifactError,
  parseGenerationArtifact,
  SUPPORTED_ARTIFACT_VERSION,
  SUPPORTED_RESOLVED_PLAN_VERSION,
} from "./artifact";
export type {
  AnatomyGeometry,
  AnatomyLayout,
  AnatomyNodePlan,
  AnatomySlotPlan,
  ComposedChildRef,
  OverlayCrossAlign,
  ResolvedPositionAlongMain,
  ResolvedSizeAlongMain,
} from "./anatomy";
// Window-placed components: the viewport stand-in frame and the popup component.
export type { FrameAlign, PopupComponentPlan, ViewportFramePlan } from "./viewport";
export {
  popupComponentName,
  popupComponentPlan,
  popupVariantsByCell,
  tokensInViewport,
  VIEWPORT_CONTEXT_AXIS_PROP,
  VIEWPORT_CONTEXT_COMPONENT,
  VIEWPORT_CONTEXT_VIEWPORT,
  viewportFramePlan,
} from "./viewport";
export {
  cellAnatomyPlan,
  componentAnatomyPlans,
  composedChildKey,
  composedChildVariantLabel,
  generationOrder,
  tokensInAnatomy,
  walkAnatomy,
} from "./anatomy";
export type {
  AxisSizing,
  CellGeometryPlan,
  CellLayoutMode,
  CounterAxisAlign,
  LiteralSize,
  NodeSizing,
  PrimaryAxisAlign,
} from "./geometry";
export { axisSizing, cellGeometryPlan, componentGeometryPlans, nodeSizing, sizeVariablesInGeometry } from "./geometry";
export type { ComponentPlan, ComposedChildPlan, PlanArtifact, PlanOptions } from "./plan";
export { generateComponentPlan } from "./plan";
export type {
  DocumentationChromeBindings,
  DocumentationLayout,
  DocumentationPagePlan,
  DocumentationPagePlanNode,
  DocumentationSlice,
} from "./documentation-page";
export {
  buildDocumentationLayout,
  buildDocumentationPagePlan,
  orderThemeModes,
  pinnedCaption,
} from "./documentation-page";
// Pure emitter core (bind-by-name + §8 upsert manifest). The Figma Plugin API
// reference (`emit.ts`) is NOT re-exported here — it pulls @figma/plugin-typings
// and is inlined into `use_figma`, keeping this index Figma-free + pure.
export type { BindMatch, FigmaManifest, ManifestEntry, ReconcileAction, ReconcilePlan } from "./emit-core";
export {
  indexVariablesByName,
  normalizeVarName,
  planHash,
  reconcileManifest,
  resolveBinding,
  tokensInPlan,
} from "./emit-core";
// Heal — normalize Figma state the variable model can't express (line-height as
// the first case). Pure detectors + patches; the emitter inlines + applies them.
export type { FigmaLineHeight, HealableStyle, HealAction, StyleHealer, StyleHealPatch } from "./heal";
export {
  isRatioAsPx,
  lineHeightHealer,
  planStyleHeals,
  ratioToPercent,
  STYLE_HEALERS,
} from "./heal";

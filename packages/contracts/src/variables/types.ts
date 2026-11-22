export type FigmaVarType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";

/** A variable's value in a given mode — either a literal or an alias to another variable. */
export type ModeValue =
  | { kind: "alias"; targetVar: string } // slash-path name of the target variable
  | { kind: "color"; r: number; g: number; b: number; a: number } // 0–1 channels
  | { kind: "float"; value: number }
  | { kind: "string"; value: string }
  | { kind: "boolean"; value: boolean };

export interface TokenVariable {
  /** Slash-path name, e.g. "color/border/subtle" or "theme/color/neutral/4". */
  name: string;
  type: FigmaVarType;
  /** modeName → value. */
  valuesByMode: Record<string, ModeValue>;
}

export interface TokenCollection {
  /** Token-set family, e.g. "theme", "brand", "semantic-web". */
  name: string;
  /** Mode names, e.g. ["light","dark"] for theme, ["default"] for single-mode families. */
  modes: string[];
  variables: TokenVariable[];
}

export interface TokenModel {
  collections: TokenCollection[];
}

/** The subset of an existing Figma file's local variables the reconciler needs to upsert. */
export interface ExistingVarState {
  /** collectionName → { id, modeName → modeId }. */
  collections: Record<string, { id: string; modes: Record<string, string> }>;
  /** slash-path variable name → its existing variable id (assumed globally unique, per Studio). */
  variableIdsByName: Record<string, string>;
}

// ── Figma REST `POST /v1/files/:key/variables` payload shape ────────────────────

export type FigmaAction = "CREATE" | "UPDATE" | "DELETE";

export interface CollectionChange {
  action: FigmaAction;
  /** Real id when UPDATE/DELETE; a caller-assigned temporary id when CREATE (Figma overloads `id`). */
  id?: string;
  name?: string;
  /** tempId of the auto-created initial mode (so it can be renamed/addressed). */
  initialModeId?: string;
}

export interface ModeChange {
  action: FigmaAction;
  /** Real id when UPDATE/DELETE; a caller-assigned temporary id when CREATE (Figma overloads `id`). */
  id?: string;
  name?: string;
  variableCollectionId: string; // id or tempId
}

export interface VariableChange {
  action: FigmaAction;
  /** Real id when UPDATE/DELETE; a caller-assigned temporary id when CREATE (Figma overloads `id`). */
  id?: string;
  name?: string;
  variableCollectionId?: string; // id or tempId
  resolvedType?: FigmaVarType;
}

export type FigmaValue =
  | { r: number; g: number; b: number; a: number }
  | number
  | string
  | boolean
  | { type: "VARIABLE_ALIAS"; id: string };

export interface ModeValueChange {
  variableId: string; // id or tempId
  modeId: string; // id or tempId
  value: FigmaValue;
}

export interface VariablesPostBody {
  variableCollections?: CollectionChange[];
  variableModes?: ModeChange[];
  variables?: VariableChange[];
  variableModeValues?: ModeValueChange[];
}

/** An empty existing-state — for a first bootstrap into a fresh file. */
export const EMPTY_EXISTING: ExistingVarState = {
  collections: {},
  variableIdsByName: {},
};

/**
 * `defineFigmaContract` declares a co-located `<name>.figma.contract.ts`.
 *
 * It returns its argument unchanged and imports nothing, so a contract file stays plain data
 * at runtime: installing a component never needs the contract compiler or its dependencies.
 *
 * The argument's type comes from the contract schema. Where the schema is installed it merges
 * `authored` into `FigmaContractShape` (declaration merging), and type checking then rejects
 * unknown keys and wrong field types in the contract literal. Without it any object is
 * accepted here; the contract compiler validates the contract against the schema when it runs.
 */

// biome-ignore lint/suspicious/noEmptyInterface: filled in by declaration merging from the contract schema.
export interface FigmaContractShape {}

/** The authored contract type when the contract schema is installed, otherwise any object. */
export type FigmaContractInput = FigmaContractShape extends { authored: infer Contract }
  ? Contract
  : Record<string, unknown>;

export function defineFigmaContract(contract: FigmaContractInput): FigmaContractInput {
  return contract;
}

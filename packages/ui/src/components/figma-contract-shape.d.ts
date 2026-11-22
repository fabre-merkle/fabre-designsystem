/**
 * Types every co-located `*.figma.contract.ts` with the authored contract schema.
 *
 * `defineFigmaContract` (in `figma-contract.ts`, next to the components) accepts any object until
 * this file is installed beside it. Once it is, type checking rejects unknown keys and wrong
 * field types in every contract. It adds nothing at runtime, so a contract file stays plain data.
 */
import type { AuthoredFigmaContract } from "@workspace/contracts/authored-schema";

declare module "./figma-contract" {
  interface FigmaContractShape {
    authored: AuthoredFigmaContract;
  }
}

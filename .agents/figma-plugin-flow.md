# Figma generation artifact

The Figma plugin consumes only the current V2 artifact at
`.agents/figma-generation-contract.json`.

1. Run `bun run figma:contract` after changing a contracted component.
2. Commit `.agents/figma-generation-contract.json`.
3. In the plugin, load the repository and branch. Automatic discovery uses the
   conventional path only.
4. If discovery cannot find the artifact, enter a valid repository-relative
   artifact path. The plugin validates the V2 schema before exposing components and
   remembers the successful path for that repository and branch.

An unsupported artifact version requires updating the plugin or regenerating the
artifact. Invalid artifacts never begin Figma materialization.

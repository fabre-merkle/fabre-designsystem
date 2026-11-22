import type { MDXComponents } from "mdx/types";
import { type ComponentProps, createElement } from "react";

import { AutoTypeTable } from "./auto-type-table";
import { CardAnnotated } from "./card-annotated";
import { ComponentContract } from "./component-contract";
import { ComponentPreview } from "./component-preview";
import { ComponentShowcase } from "./component-showcase";
import { DocsStory } from "./docs-story";
import { ElevationExampleWithComponents, FoundationExamplesProvider } from "./elevation-example";
import { BackdropExample, MotionExamples } from "./foundation-examples";
import { TokenReference } from "./token-reference";

/**
 * The component-doc widgets (live showcase with source tabs, variant/state previews), added to the
 * docs app's MDX components by `mdx-components.tsx`. Replaces the empty map the docs shell ships.
 */
export const extraMdxComponents: MDXComponents = {
  AutoTypeTable,
  ComponentContract,
  ComponentShowcase,
  ComponentPreview,
  DocsStory,
  CardAnnotated,
  ElevationExample: ElevationExampleWithComponents,
  MotionExamples: (props: ComponentProps<typeof MotionExamples>) =>
    createElement(FoundationExamplesProvider, null, createElement(MotionExamples, props)),
  BackdropExample: () =>
    createElement(FoundationExamplesProvider, null, createElement(BackdropExample)),
  TokenReference: (props: ComponentProps<typeof TokenReference>) =>
    createElement(FoundationExamplesProvider, null, createElement(TokenReference, props)),
};

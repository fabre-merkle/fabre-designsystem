import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Callout, CalloutContainer } from "fumadocs-ui/components/callout";
import { CodeBlockTabs } from "fumadocs-ui/components/codeblock";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps, ComponentType } from "react";

import { extraMdxComponents } from "./components/docs/extra-mdx-components";
import {
  BackdropExample,
  ColourExample,
  ElevationExample,
  MotionExamples,
  SpacingExample,
  TypographyExamples,
} from "./components/docs/foundation-examples";
import { ProjectAbout } from "./components/docs/project-about";
import { ProjectDocument } from "./components/docs/project-document";
import { relatedPageComponents } from "./components/docs/related-pages";
import { TokenConfiguration } from "./components/docs/token-configuration";
import { TokenReference } from "./components/docs/token-reference";
import { resolveRelatedPage } from "./lib/source";

/**
 * Fumadocs chrome with the `data-docs-*` hooks `app/fumadocs-elevation.css` paints.
 * Fumadocs spreads extra props onto each component's root element, so the elevation CSS
 * targets these attributes instead of Fumadocs' Tailwind utility classes. Render these
 * components through the MDX map (or add the attribute yourself) to keep the styling.
 */
const DefaultTable = defaultMdxComponents.table as ComponentType<ComponentProps<"table">>;

export const docsChromeComponents = {
  Callout: (props: ComponentProps<typeof Callout>) => <Callout data-docs-callout="" {...props} />,
  CalloutContainer: (props: ComponentProps<typeof CalloutContainer>) => (
    <CalloutContainer data-docs-callout="" {...props} />
  ),
  Tabs: (props: ComponentProps<typeof Tabs>) => <Tabs data-docs-tabs="" {...props} />,
  CodeBlockTabs: (props: ComponentProps<typeof CodeBlockTabs>) => (
    <CodeBlockTabs data-docs-code-tabs="" {...props} />
  ),
  Accordions: (props: ComponentProps<typeof Accordions>) => (
    <Accordions data-docs-accordion="" {...props} />
  ),
  table: (props: ComponentProps<"table">) => <DefaultTable data-docs-table="" {...props} />,
} satisfies MDXComponents;

/**
 * Project-level MDX components: Fumadocs UI defaults + the Fumadocs natives the
 * doc templates use (`Accordion`, `Tabs`/`Tab`, `Steps`/`Step`, `TypeTable`) so the
 * `@focus/docs-template-*` pages prerender without per-page imports. These are
 * framework components with no component-library coupling. Other docs items add
 * their widgets through `components/docs/extra-mdx-components.ts`, so this file
 * stays the one place the page components are assembled.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...docsChromeComponents,
    Accordion,
    Tab,
    Steps,
    Step,
    TypeTable,
    ProjectAbout,
    ProjectDocument,
    BackdropExample,
    ColourExample,
    ElevationExample,
    MotionExamples,
    SpacingExample,
    TokenConfiguration,
    TokenReference,
    TypographyExamples,
    ...relatedPageComponents(resolveRelatedPage),
    ...extraMdxComponents,
    ...components,
  };
}

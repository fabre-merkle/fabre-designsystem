import { asMarkdown } from "fumadocs-core/server";
import type { MDXComponents } from "mdx/types";
import { cardAnnotatedMarkdown } from "../components/docs/card-annotated-model";
import { autoTypeTableMarkdownComponents } from "./auto-type-table-markdown";
import { componentContractMarkdownComponents } from "./component-contract-markdown";
import { DocsStoryMarkdown } from "./docs-story-markdown";

/** Markdown form of `<CardAnnotated />`: the tokens its callouts name, as a list. */
function CardAnnotatedMarkdown({ level, shadowLevel }: { level?: number; shadowLevel?: number }) {
  asMarkdown();
  return cardAnnotatedMarkdown(level, shadowLevel);
}

/**
 * Project hooks for the Markdown forms of the docs components.
 */
export const markdownConfig: {
  /** Extra or replacement Markdown components, merged over the defaults. */
  components?: MDXComponents;
} = {
  // The generated props table and the story presets as Markdown, not the interactive components.
  components: {
    ...autoTypeTableMarkdownComponents,
    ...componentContractMarkdownComponents,
    DocsStory: DocsStoryMarkdown,
    CardAnnotated: CardAnnotatedMarkdown,
  },
};

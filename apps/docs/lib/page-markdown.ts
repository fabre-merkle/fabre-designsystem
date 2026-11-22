import type { InferPageType } from "fumadocs-core/source";
import type { MDXComponents } from "mdx/types";
import { getMarkdownComponents } from "./markdown-components";
import * as projectSource from "./source";

type DocsPage = InferPageType<typeof projectSource.source>;
const projectMarkdown: {
  source: typeof projectSource.source;
  markdownComponentsForPage?: (page: DocsPage) => MDXComponents | undefined;
} = projectSource;

/** The processed Markdown of one page, headed by its title, URL and description. */
export async function getPageMarkdown(page: DocsPage): Promise<string> {
  const body = await page.data.getText("processed", {
    components: getMarkdownComponents(projectMarkdown.markdownComponentsForPage?.(page)),
  });
  const description = page.data.description ? `${page.data.description}\n\n` : "";
  return `# ${page.data.title} (${page.url})\n\n${description}${body}`;
}

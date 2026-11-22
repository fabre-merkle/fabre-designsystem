import { asMarkdown } from "fumadocs-core/server";
import { getDocsStory } from "./docs-stories";
import type { DocsStoryModule } from "./docs-story-types";

/** Snippets come from story files, which never contain backticks, so a plain fence is enough. */
function fence(code: string): string {
  return `\n\`\`\`tsx\n${code}\n\`\`\`\n`;
}

/**
 * The presets of a docs story as Markdown: each preset's name, description and the JSX it stands
 * for. The page renders the live component with controls; an agent reads this instead.
 */
export function docsStoryToMarkdown(story: DocsStoryModule<any>): string {
  const presets = story.presets
    .map(({ variant, description, initial }) => {
      const heading = `**${variant}**${description ? `: ${description}` : ""}`;
      return `${heading}\n${fence(story.snippet(initial))}`;
    })
    .join("\n");
  const demo = story.demoArgs?.length
    ? `Demo-only controls (not ${story.title} props): ${story.demoArgs.join(", ")}\n\n`
    : "";
  return `\n**Example: ${story.title}** (interactive on the page; presets below)\n\n${demo}${presets}\n`;
}

/** Markdown form of `<DocsStory name="…" />`, registered through `markdownConfig.components`. */
export function DocsStoryMarkdown({ name }: { name: string }) {
  asMarkdown();
  return docsStoryToMarkdown(getDocsStory(name));
}

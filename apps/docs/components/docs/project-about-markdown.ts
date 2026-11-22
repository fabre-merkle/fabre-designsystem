import { asMarkdown } from "fumadocs-core/server";
import { readProjectAbout } from "../../lib/project-about";
import type { ProjectAboutProps } from "./project-about";

function escapeMarkdown(value: string) {
  return value.replace(/[\\`*_[\]<>|]/g, "\\$&").replace(/\r?\n/g, " ");
}

/** Register as `ProjectAbout` in the Markdown component map, alongside the HTML component. */
export function ProjectAboutMarkdown({ group, docsDirectory }: ProjectAboutProps = {}) {
  asMarkdown();
  const data = readProjectAbout(docsDirectory);
  const groups = data.groups.filter((entry) => !group || entry.id === group);
  if (group && groups.length === 0) throw new Error(`Unknown About group: ${group}`);
  return `\n${groups
    .map((section) =>
      [
        !group ? `## ${escapeMarkdown(section.title)}\n` : "",
        ...section.entries.map(
          (entry) => `<!-- topic:start ${entry.id} -->
### [${escapeMarkdown(entry.name)}](${entry.href.replace(/[()|]/g, encodeURIComponent)})

${escapeMarkdown(entry.role)}

**Project version:** ${escapeMarkdown(entry.version)}
<!-- topic:end ${entry.id} -->\n`,
        ),
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n")}\n`;
}

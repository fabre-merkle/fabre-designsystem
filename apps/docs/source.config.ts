import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import convert from "npm-to-yarn";
import { z } from "zod";

// Install commands are authored once as an npm command in a ```npm fence; remarkNpm renders one
// tab per package manager, bun first. `npx` becomes `bunx --bun`, which runs the CLI under Bun
// (the default conversion emits `bun x ...` without --bun, so the CLI would run under Node).
const convertLines = (cmd: string, to: "pnpm" | "yarn" | "bun") =>
  cmd
    .split("\n")
    .map((line) =>
      to === "bun" && line.startsWith("npx ") ? `bunx --bun ${line.slice(4)}` : convert(line, to),
    )
    .join("\n");

const packageManagers = [
  { name: "bun", command: (cmd: string) => convertLines(cmd, "bun") },
  { name: "pnpm", command: (cmd: string) => convertLines(cmd, "pnpm") },
  { name: "npm", command: (cmd: string) => cmd },
  // `yarn dlx` needs Yarn 2+ (Classic has no dlx); the value keeps the persisted tab key.
  { name: "Yarn 2+", value: "yarn", command: (cmd: string) => convertLines(cmd, "yarn") },
];

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    // Markdown for agents: keeps each page as authored, with its JSX components rendered by the
    // Markdown forms in lib/markdown-components.tsx.
    postprocess: { includeProcessedMarkdown: { output: "function" } },
    schema: pageSchema.extend({
      // Optional pointer back to a UI primitive's slug — used by
      // component-doc pages once @focus/docs-foundations and the UI components land.
      primitive: z.string().optional(),
    }),
  },
});

export default defineConfig({
  mdxOptions: {
    // Tabs per package manager for ```npm fences; the choice persists across pages.
    remarkNpmOptions: { persist: { id: "package-manager" }, packageManagers },
  },
});

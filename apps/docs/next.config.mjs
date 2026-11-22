import { readFileSync } from "node:fs";
import { createNextStory } from "@fumadocs/story/next";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

// Workspace packages ship TS/CSS source with no build step, so the app transpiles whichever ones
// it depends on. Read from package.json so an item that adds a workspace dependency (the
// component library, for example) needs no edit to this file.
const { dependencies = {} } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);
const workspacePackages = Object.entries(dependencies)
  .filter(([, range]) => String(range).startsWith("workspace:"))
  .map(([name]) => name);
const projectReferenceFiles = [
  "./project-about.json",
  "../../package.json",
  "../../apps/*/package.json",
  "../../packages/*/package.json",
  "../../node_modules/*/package.json",
  "../../node_modules/@*/*/package.json",
  "./node_modules/*/package.json",
  "./node_modules/@*/*/package.json",
  "../../DESIGN.md",
  "../../.agents/*.md",
  "../../.agents/skills/*/SKILL.md",
  "../../packages/ui/.storybook/README.md",
  "../../packages/tokens/dtcg/**",
  "../../packages/tokens/css/**",
  "./lib/token-context.json",
];

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Markdown token references resolve CSS server-side; bundle the parser into those routes.
  transpilePackages: [...workspacePackages, "postcss"],
  // `.md` URLs serve a docs page as Markdown (see app/llms.mdx).
  async rewrites() {
    return [
      { source: "/docs.md", destination: "/llms.mdx/docs" },
      { source: "/docs/:path*.md", destination: "/llms.mdx/docs/:path*" },
    ];
  },
  // The Markdown routes are dynamic. Items that write a build-time snapshot for them (the generated
  // prop tables in `.generated/`) rely on the serverless trace shipping it with those routes; a
  // pattern with no matching file is ignored. Keys are picomatch globs against the route; both the
  // `/app/...` and the bare `/llms.mdx/**` forms were checked against the built `.nft.json` and
  // match. The catch-all is matched with `**`, because a literal `[[...slug]]` reads as a bracket
  // expression.
  outputFileTracingIncludes: {
    "/app/docs/**": projectReferenceFiles,
    "/app/llms.mdx/**": ["./.generated/**", ...projectReferenceFiles],
    "/app/llms-full.txt/**": ["./.generated/**", ...projectReferenceFiles],
  },
  // Webpack pinned in dev/build scripts via --webpack. fumadocs-mdx@15
  // emits `?collection=docs` query-string imports in .source/server.ts
  // which Turbopack's resolver doesn't recognise; Webpack handles them as
  // loader params. Migrate to Turbopack when fumadocs-mdx adds support.
  // See task: "apps/docs — migrate to Turbopack when fumadocs-mdx supports it."
};

// Docs stories: `*.story.tsx` files get their controls generated from the component props at
// build time. `createNextStory()` registers one glob for both bundlers, but webpack's `test`
// rejects a glob string, and this app builds with webpack, so the webpack rule is registered
// again with the same loader and a RegExp.
const createdWithStory = createNextStory();
const storyFiles = /\.story\.(?:js|jsx|ts|tsx)$/;
/** @param {import("next").NextConfig} nextConfig */
function withStory(nextConfig) {
  return {
    ...createdWithStory(nextConfig),
    webpack(webpackConfig, options) {
      webpackConfig.module ||= {};
      webpackConfig.module.rules ||= [];
      webpackConfig.module.rules.push({
        test: storyFiles,
        enforce: "pre",
        use: [{ loader: "@fumadocs/story/webpack/story", options: {} }],
      });
      return nextConfig.webpack?.(webpackConfig, options) ?? webpackConfig;
    },
  };
}

// withMDX stays outermost: it returns a thenable that makes Next wait for the MDX files.
export default withMDX(withStory(config));

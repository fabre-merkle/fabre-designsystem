export const PROJECT_RUNBOOKS = {
  figma: ".agents/connect-to-figma.md",
  "code-connect": ".agents/figma-connect.md",
  storybook: "packages/ui/.storybook/README.md",
  "github-actions": ".agents/ci-main.md",
  "storybook-tests": ".agents/ci-storybook.md",
  chromatic: ".agents/ci-chromatic.md",
  "token-sync": ".agents/tokens-sync.md",
  "claude-code": ".agents/mcp-claude-code.md",
  vscode: ".agents/mcp-vscode.md",
} as const;

export function documentationHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const source = href.match(
    /^(?:\.\/)?apps\/docs\/content\/docs\/([a-z0-9][a-z0-9/-]*)\.mdx?([?#].*)?$/i,
  );
  if (source) {
    const slug = source[1].replace(/(?:\/index|^index)$/, "");
    return `/docs${slug ? `/${slug}` : ""}${source[2] ?? ""}`;
  }
  return /^(?:https?:\/\/|\/(?!\/)|#)/.test(href) ? href : undefined;
}

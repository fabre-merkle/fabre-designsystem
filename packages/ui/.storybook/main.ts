import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Storybook 10 (React + Vite) for the @workspace/ui component package.
 *
 * Lives in packages/ui/.storybook so stories sit beside the components they document
 * and the dev server keeps its conventional fixed port (:6006) — the Storybook MCP
 * (@storybook/addon-mcp) binds to that port, and packages/ are not touched by the
 * port-assignment step the way apps/ are. Rename @workspace to your own scope at scaffold time.
 */
const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: [
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-vitest",
    // Grounded component context for agents — see .storybook/AGENTS.md.
    "@storybook/addon-mcp",
  ],
  framework: { name: "@storybook/react-vite", options: {} },
  features: { componentsManifest: true },
  typescript: {
    // react-docgen-typescript reads the props through the TypeScript checker, so unions and
    // `Partial<{ ... }>` intersections resolve to their literal values and keep their JSDoc;
    // the default react-docgen reads the syntax only and reports them as `any`.
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      // Keep the props the library declares; drop the DOM attributes every element inherits.
      propFilter: (prop) =>
        prop.parent
          ? !/node_modules\/(?:@types\/react|typescript)\//.test(prop.parent.fileName)
          : true,
    },
  },
};

export default config;

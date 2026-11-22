import type { Decorator, Preview } from "@storybook/react-vite";
import { useLayoutEffect } from "react";
import "./preview.css";

// The UI components dev-guard on `process?.env?.NODE_ENV`. The browser has no Node
// `process` — in BOTH the Storybook preview UI and the Vitest runner — and Vite's `define`
// can't rewrite the optional-chaining form, so a bare `process?.` reference throws
// ReferenceError when a component renders. This module loads in both runtimes (the Vitest
// setup imports it), so shimming here makes every UI component mount in the workshop.
(globalThis as { process?: { env?: Record<string, string | undefined> } }).process ??= {
  env: { NODE_ENV: "production" },
};

/**
 * Global preview config for @workspace/ui stories.
 *
 * The token decorator applies the scoping attributes the cascade keys off
 * (`data-brand` / `data-foundation` / `data-theme`) to the document root — exactly as a
 * scaffolded app sets them on `<html>`. The semantic layer is also re-declared on every
 * `[data-brand]`/`[data-theme]` element, so a wrapper div would work too; the root
 * keeps the story canvas and page background in step. Toolbar toggles flip brand + theme so a story is reviewable in any
 * combination. This is the scaffolded-project analogue of the generator's ScopedTokenRoot
 * — far simpler, because the project consumes static baked token CSS, not a live tree.
 */
const withTokens: Decorator = (Story, context) => {
  const brand = context.globals.brand ?? "fabre-designsystem";
  const theme = context.globals.theme ?? "light";
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-brand", brand);
    root.setAttribute("data-foundation", "default");
    root.setAttribute("data-theme", theme);
  }, [brand, theme]);
  return (
    <div className="sb-token-root">
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTokens],
  parameters: {
    layout: "centered",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "error" },
  },
  initialGlobals: { brand: "fabre-designsystem", theme: "light" },
  globalTypes: {
    theme: {
      description: "Token theme",
      toolbar: {
        title: "Theme",
        icon: "contrast",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
    brand: {
      description: "Token brand",
      toolbar: {
        title: "Brand",
        icon: "paintbrush",
        items: [{ value: "fabre-designsystem", title: "Fabre Designsystem" }],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dir = dirname(fileURLToPath(import.meta.url));

/**
 * Runs the @workspace/ui stories as a browser test project — interaction (play) +
 * a11y checks — via `bun run test-storybook` and in CI (@focus/ci-storybook).
 * Needs Playwright Chromium: `bunx playwright install chromium`.
 */
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        // Vite pre-bundles each dependency the first time a story imports it. Found mid-run, that
        // triggers a reload and fails the first run after you add a story for a new component.
        // Listing the component library's deep imports up front keeps the first run stable.
        optimizeDeps: {
          include: ["@base-ui/react/*", "@storybook/addon-docs/**", "@storybook/react-dom-shim"],
        },
        plugins: [storybookTest({ configDir: join(dir, ".storybook") })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            // vitest 4: provider is a factory from @vitest/browser-playwright (was a string in v3).
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
          setupFiles: [join(dir, ".storybook/vitest.setup.ts")],
        },
      },
    ],
  },
});

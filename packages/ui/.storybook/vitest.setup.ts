import { setProjectAnnotations } from "@storybook/react-vite";
import { beforeAll } from "vitest";
import * as previewAnnotations from "./preview";

// The UI components dev-guard on `process?.env?.NODE_ENV`. The browser test runner has no
// Node `process`, and Vite's `define` doesn't rewrite the optional-chaining form — so a bare
// `process?.` reference throws ReferenceError at render. Provide a minimal global so real
// components mount in the test runner (the SB UI gets one from Vite's dev server).
(globalThis as { process?: { env?: Record<string, string | undefined> } }).process ??= {
  env: { NODE_ENV: "production" },
};

/**
 * Applies the .storybook/preview annotations (decorators, parameters, globals) to the
 * Vitest browser run, so `vitest --project=storybook` exercises stories with the same
 * token decorator + a11y config as the Storybook UI.
 */
const project = setProjectAnnotations([previewAnnotations]);

beforeAll(project.beforeAll);

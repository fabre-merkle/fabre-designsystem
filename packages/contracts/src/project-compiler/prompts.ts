/**
 * The only questions the command line ever asks, and the rule for when it may ask them.
 *
 * Two places prompt: `explain` without a slug (pick a component) and `new` (pick a component,
 * confirm an overwrite). A prompt appears only on an interactive terminal, never when `CI` is set
 * (to anything other than empty, `0` or `false`) and never with `--json` or `--yes`. Every question has a flag or argument equivalent, and the
 * refusal that appears when it cannot be asked names it.
 *
 * `@inquirer/prompts` is loaded when a question is actually asked, so a project that never
 * prompts (CI, agents, scripts) never needs it installed.
 */
import { MissingPrerequisiteError } from "./prerequisites";

/** Asks the person at the terminal. Tests pass their own. */
export interface Prompter {
  chooseComponent(slugs: readonly string[], message: string): Promise<string>;
  confirm(message: string): Promise<boolean>;
}

export interface PromptContext {
  /** Whether stdin and stdout are both a terminal. */
  interactive: boolean;
  json?: boolean;
  yes?: boolean;
}

/** Whether a question may be asked right now. */
export function canPrompt(context: PromptContext, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!context.interactive) return false;
  if (context.json === true || context.yes === true) return false;
  const ci = env.CI;
  return ci === undefined || ci === "" || ci === "0" || ci === "false";
}

/** The `select` configuration for choosing one component. Exported so a test can drive the real prompt. */
export function componentSelectConfig(slugs: readonly string[], message: string) {
  return {
    message,
    choices: slugs.map((slug) => ({ name: slug, value: slug })),
    pageSize: 12,
  };
}

/** The `confirm` configuration for a yes/no question. Defaults to no. */
export function confirmConfig(message: string) {
  return { message, default: false };
}

async function loadInquirer(): Promise<typeof import("@inquirer/prompts")> {
  try {
    return await import("@inquirer/prompts");
  } catch {
    throw new MissingPrerequisiteError(
      "Missing dependency @inquirer/prompts, which asks questions in an interactive terminal. " +
        "Run `bun install` at the workspace root, or pass the value as an argument or flag.",
    );
  }
}

/** The prompter that asks in the terminal. */
export function createTerminalPrompter(): Prompter {
  return {
    async chooseComponent(slugs, message) {
      const { select } = await loadInquirer();
      return select(componentSelectConfig(slugs, message));
    },
    async confirm(message) {
      const { confirm } = await loadInquirer();
      return confirm(confirmConfig(message));
    },
  };
}

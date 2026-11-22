import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { AlertDemo, type AlertDemoProps } from "./alert-demo";

export const title = "Alert";
// The controls are generated from `AlertDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Alert props: drawn in the "Demo" group. */
export const demoArgs = ["title", "description", "icon", "showActions"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  intent: "info",
  title: "Heads up",
  description: "A new token release is available.",
  icon: "default",
  showActions: false,
} satisfies AlertDemoProps;

export const presets: DocsStoryPreset<AlertDemoProps>[] = [
  {
    variant: "Info",
    description: "Neutral news. Announced politely (role=status).",
    initial: base,
  },
  {
    variant: "Success",
    description: "A completed action. Announced politely.",
    initial: {
      ...base,
      intent: "success",
      title: "Changes saved",
      description: "Your workspace settings are up to date.",
    },
  },
  {
    variant: "Warning",
    description: "Something needs attention but nothing has failed. Announced politely.",
    initial: {
      ...base,
      intent: "warning",
      title: "Unsaved changes",
      description: "You have edits that haven't been saved.",
    },
  },
  {
    variant: "Error",
    description: "A problem the user must act on. Announced assertively (role=alert).",
    initial: {
      ...base,
      intent: "error",
      title: "Couldn't publish",
      description: "Check your connection and try again.",
    },
  },
  {
    variant: "With actions",
    description: "Trailing controls sit under the description.",
    initial: {
      ...base,
      intent: "warning",
      title: "Unsaved changes",
      description: "You have edits that haven't been saved.",
      showActions: true,
    },
  },
  {
    variant: "Custom icon",
    description: "Put a Phosphor icon first among the children to replace the intent's default.",
    initial: { ...base, title: "Tip", description: "Press ⌘K to search the docs.", icon: "custom" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: AlertDemoProps): string {
  const { intent, title = "", description = "", icon, showActions } = props;
  const actions = showActions ? raw('<Button size="sm">Save</Button>') : undefined;
  const open = jsxSnippet(
    "Alert",
    { intent, title, actions },
    { openOnly: true, defaults: { intent: "info" } },
  );
  return [
    open,
    ...(icon === "custom" ? ['  <Lightbulb weight="fill" />'] : []),
    `  ${description}`,
    "</Alert>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Alert",
  Component: AlertDemo,
  args: presets,
});

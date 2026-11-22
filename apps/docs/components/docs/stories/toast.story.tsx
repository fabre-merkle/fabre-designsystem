import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { ToastDemo, type ToastDemoProps } from "./toast-demo";

export const title = "Toast";
// The controls are generated from `ToastDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Toast props: drawn in the "Demo" group. */
export const demoArgs = ["triggerLabel", "title", "description", "showAction"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  triggerLabel: "Show toast",
  title: "Changes saved",
  description: "Your workspace settings have been updated.",
  showAction: false,
  timeout: 5000,
  limit: 3,
} satisfies ToastDemoProps;

export const presets: DocsStoryPreset<ToastDemoProps>[] = [
  {
    variant: "Default",
    description: "Dismisses itself after the timeout. Hovering or focusing it pauses the timer.",
    initial: base,
  },
  {
    variant: "With action",
    description: "actionProps on the toast adds an action button, rendered by Toast.Action.",
    initial: {
      ...base,
      triggerLabel: "Delete item",
      title: "Item deleted",
      description: "The item was moved to the trash.",
      showAction: true,
    },
  },
  {
    variant: "Persistent",
    description: "timeout 0 keeps the toast on screen until it is closed.",
    initial: { ...base, timeout: 0, triggerLabel: "Show persistent toast" },
  },
  {
    variant: "Stacked",
    description: "Several toasts stack in the viewport, up to limit at once.",
    initial: { ...base, limit: 5, timeout: 8000, triggerLabel: "Add toast" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: ToastDemoProps): string {
  const { triggerLabel = "Show toast", title, description, showAction, timeout, limit } = props;
  const provider = jsxSnippet(
    "Toast.Provider",
    { timeout, limit },
    { openOnly: true, defaults: { timeout: 5000, limit: 3 } },
  );
  const add = [
    "        manager.add({",
    `          title: ${JSON.stringify(title)},`,
    `          description: ${JSON.stringify(description)},`,
    ...(showAction ? ['          actionProps: { children: "Undo" },'] : []),
    "        })",
  ];
  return [
    "function ToastList() {",
    "  const { toasts } = Toast.useToastManager();",
    "  return toasts.map((toast) => (",
    "    <Toast.Root key={toast.id} toast={toast}>",
    "      <Toast.Content>",
    "        <Toast.Title />",
    "        <Toast.Description />",
    ...(showAction ? ["        <Toast.Action />"] : []),
    "      </Toast.Content>",
    '      <Toast.Close aria-label="Close" />',
    "    </Toast.Root>",
    "  ));",
    "}",
    "",
    "function ShowToast() {",
    "  const manager = Toast.useToastManager();",
    "  return (",
    "    <Button",
    "      onClick={() =>",
    ...add,
    "      }",
    "    >",
    `      ${triggerLabel}`,
    "    </Button>",
    "  );",
    "}",
    "",
    provider,
    "  <ShowToast />",
    "  <Toast.Portal>",
    "    <Toast.Viewport>",
    "      <ToastList />",
    "    </Toast.Viewport>",
    "  </Toast.Portal>",
    "</Toast.Provider>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Toast",
  Component: ToastDemo,
  args: presets,
});

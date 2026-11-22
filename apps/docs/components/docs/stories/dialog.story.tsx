import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { DialogDemo, type DialogDemoProps } from "./dialog-demo";

export const title = "Dialog";
// The controls are generated from `DialogDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Dialog props: drawn in the "Demo" group. */
export const demoArgs = ["triggerLabel", "title", "description", "confirmLabel"] as const;

export const presets: DocsStoryPreset<DialogDemoProps>[] = [
  {
    variant: "Confirm",
    description: "A modal confirm: the page behind is inert and focus stays inside.",
    initial: {
      modal: true,
      disablePointerDismissal: false,
      triggerLabel: "Open dialog",
      title: "Confirm action",
      description: "This will permanently remove the selected item. You can't undo this.",
      confirmLabel: "Delete",
    },
  },
  {
    variant: "Non-modal",
    description: "The page behind stays interactive and focus is not trapped.",
    initial: {
      modal: false,
      disablePointerDismissal: false,
      triggerLabel: "Open non-modal dialog",
      title: "Heads up",
      description: "You can keep working while this is open.",
      confirmLabel: "Got it",
    },
  },
  {
    variant: "Persistent",
    description: "An outside click does not dismiss it; only the actions or Escape close it.",
    initial: {
      modal: true,
      disablePointerDismissal: true,
      triggerLabel: "Open persistent dialog",
      title: "Unsaved changes",
      description: "Choose an action to continue.",
      confirmLabel: "Discard",
    },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: DialogDemoProps): string {
  const {
    modal,
    disablePointerDismissal,
    triggerLabel = "Open dialog",
    title,
    description,
    confirmLabel,
  } = props;
  const root = jsxSnippet(
    "Dialog.Root",
    { modal: modal === false ? raw("false") : undefined, disablePointerDismissal },
    { openOnly: true },
  );
  return [
    root,
    `  <Dialog.Trigger render={<Button>${triggerLabel}</Button>} />`,
    "  <Dialog.Portal>",
    "    <Dialog.Backdrop />",
    "    <Dialog.Popup>",
    "      <Dialog.Header>",
    `        <Dialog.Title>${title}</Dialog.Title>`,
    `        <Dialog.Description>${description}</Dialog.Description>`,
    "      </Dialog.Header>",
    "      <Dialog.Footer>",
    '        <Dialog.Close render={<Button variant="secondary" mode="ghost">Cancel</Button>} />',
    `        <Dialog.Close render={<Button variant="destructive">${confirmLabel}</Button>} />`,
    "      </Dialog.Footer>",
    "    </Dialog.Popup>",
    "  </Dialog.Portal>",
    "</Dialog.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Dialog",
  Component: DialogDemo,
  args: presets,
});

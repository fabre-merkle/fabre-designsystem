import type { DocsStoryPreset } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { AlertDialogDemo, type AlertDialogDemoProps } from "./alert-dialog-demo";

export const title = "Alert Dialog";
// The controls are generated from `AlertDialogDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not AlertDialog props: drawn in the "Demo" group. */
export const demoArgs = [
  "triggerLabel",
  "title",
  "description",
  "confirmLabel",
  "cancelLabel",
  "tone",
  "showCancel",
] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  triggerLabel: "Delete account",
  title: "Delete account?",
  description:
    "This action is permanent. All of your data will be removed from our servers and cannot be recovered.",
  confirmLabel: "Delete",
  cancelLabel: "Keep account",
  tone: "destructive",
  showCancel: true,
} satisfies AlertDialogDemoProps;

export const presets: DocsStoryPreset<AlertDialogDemoProps>[] = [
  {
    variant: "Destructive",
    description: "Confirms an action that loses data. Keyboard focus starts on the safe action.",
    initial: base,
  },
  {
    variant: "Confirm",
    description: "A neutral confirmation: the confirm action uses the primary look.",
    initial: {
      ...base,
      triggerLabel: "Publish changes",
      title: "Publish changes?",
      description: "Everyone with the link will see the new version straight away.",
      confirmLabel: "Publish",
      cancelLabel: "Not yet",
      tone: "primary",
    },
  },
  {
    variant: "Acknowledge",
    description: "A single action: the dialog informs and waits for an explicit acknowledgement.",
    initial: {
      ...base,
      triggerLabel: "Session expired",
      title: "Session expired",
      description: "You were signed out after a period of inactivity. Sign in again to continue.",
      confirmLabel: "Sign in",
      tone: "primary",
      showCancel: false,
    },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: AlertDialogDemoProps): string {
  const {
    triggerLabel = "Delete account",
    title,
    description,
    confirmLabel,
    cancelLabel,
    tone,
    showCancel,
  } = props;
  const variant = tone === "primary" ? "" : ' variant="destructive"';
  const lines = [
    "<AlertDialog.Root>",
    `  <AlertDialog.Trigger render={<Button${variant}>${triggerLabel}</Button>} />`,
    "  <AlertDialog.Portal>",
    "    <AlertDialog.Backdrop />",
    "    <AlertDialog.Popup>",
    "      <AlertDialog.Header>",
    `        <AlertDialog.Title>${title}</AlertDialog.Title>`,
    `        <AlertDialog.Description>${description}</AlertDialog.Description>`,
    "      </AlertDialog.Header>",
    "      <AlertDialog.Footer>",
  ];
  if (showCancel !== false) {
    lines.push(
      `        <AlertDialog.Close render={<Button variant="secondary" mode="ghost">${cancelLabel}</Button>} />`,
    );
  }
  lines.push(
    `        <AlertDialog.Close render={<Button${variant}>${confirmLabel}</Button>} />`,
    "      </AlertDialog.Footer>",
    "    </AlertDialog.Popup>",
    "  </AlertDialog.Portal>",
    "</AlertDialog.Root>",
  );
  return lines.join("\n");
}

export const story = defineStory({
  displayName: "AlertDialog",
  Component: AlertDialogDemo,
  args: presets,
});

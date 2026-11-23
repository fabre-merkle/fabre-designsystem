import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../button/button";
import { Dialog } from "./dialog";

/**
 * Dialog interrupts: it takes focus, traps it, and blocks the page until it is answered or
 * dismissed. That cost is the reason to use it sparingly — for a decision that must happen
 * now. A message that can wait belongs in an Alert, and a confirmation of something
 * destructive belongs in AlertDialog, which is harder to dismiss by accident.
 *
 * Compose it: `Dialog.Root` holds a `Dialog.Trigger` and a `Dialog.Portal` containing
 * `Dialog.Backdrop` and `Dialog.Popup`. Always give the popup a `Dialog.Title` — it is the
 * dialog's accessible name, and without one it opens as an unnamed box.
 *
 * The popup renders in a portal, outside the story canvas, so these stories query it
 * through `screen` rather than `within(canvasElement)`.
 */
const meta = {
  title: "Components/Dialog",
  component: Dialog.Root,
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: a trigger, a titled popup, and actions in the footer. */
export const Default: Story = {
  render: (args) => (
    <Dialog.Root {...args}>
      <Dialog.Trigger render={<Button>Invite people</Button>} />
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Header>
            <Dialog.Title>Invite people</Dialog.Title>
            <Dialog.Description>
              They will be able to read every project in this workspace.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Dialog.Close
              render={
                <Button variant="secondary" mode="ghost">
                  Cancel
                </Button>
              }
            />
            <Dialog.Close render={<Button>Send invites</Button>} />
          </Dialog.Footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("it starts closed — nothing is in the document yet", async () => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    await step("the trigger opens it", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Invite people" }));
      await waitFor(() => expect(screen.getByRole("dialog")).toBeVisible());
    });

    await step("the title is the dialog's accessible name", async () => {
      expect(screen.getByRole("dialog")).toHaveAccessibleName("Invite people");
    });

    await step("tokens resolved — the popup fill is a real value", async () => {
      expect(getComputedStyle(screen.getByRole("dialog")).backgroundColor).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
    });

    await step("a Close button dismisses it", async () => {
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
  },
};

/**
 * Escape closes the dialog. It is the expected way out of anything modal, and the reason
 * a dialog should never be the only path to information the user may just want to read.
 */
export const DismissedByEscape: Story = {
  render: (args) => (
    <Dialog.Root {...args}>
      <Dialog.Trigger render={<Button>Open</Button>} />
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Header>
            <Dialog.Title>Unsaved changes</Dialog.Title>
            <Dialog.Description>Your draft will be kept for 30 days.</Dialog.Description>
          </Dialog.Header>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeVisible());

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

/**
 * Open from the start, for a dialog that is the point of the view it lands on — a shared
 * link that opens straight into a decision.
 */
export const OpenByDefault: Story = {
  render: (args) => (
    <Dialog.Root {...args} defaultOpen>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Header>
            <Dialog.Title>Accept the invitation?</Dialog.Title>
            <Dialog.Description>
              You have been invited to the Fabre design system workspace.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Dialog.Close
              render={
                <Button variant="secondary" mode="ghost">
                  Decline
                </Button>
              }
            />
            <Dialog.Close render={<Button>Accept</Button>} />
          </Dialog.Footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ),
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeVisible());
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Accept the invitation?");
  },
};

/**
 * The footer puts the primary action LAST. Below the small breakpoint the row stacks in
 * reverse, so the last action lands on top — where a thumb reaches first.
 */
export const FooterActionOrder: Story = {
  render: (args) => (
    <Dialog.Root {...args} defaultOpen>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Header>
            <Dialog.Title>Publish this version?</Dialog.Title>
            <Dialog.Description>Everyone with the link will see it immediately.</Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Dialog.Close
              render={
                <Button variant="secondary" mode="ghost">
                  Keep as draft
                </Button>
              }
            />
            <Dialog.Close render={<Button>Publish</Button>} />
          </Dialog.Footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ),
  play: async () => {
    const dialog = await screen.findByRole("dialog");
    const buttons = within(dialog).getAllByRole("button");
    expect(buttons[buttons.length - 1], "the primary action should be last").toHaveAccessibleName(
      "Publish",
    );
  },
};

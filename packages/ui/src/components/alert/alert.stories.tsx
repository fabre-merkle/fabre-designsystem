import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Button } from "../button/button";
import { Alert } from "./alert";

/**
 * Alert is an inline status message that stays on the page — the outcome of something that
 * just happened, or a condition the view is in. For a message that interrupts and must be
 * answered, use a Dialog; for one that appears briefly and leaves, use a Toast.
 *
 * `intent` sets both the colour and how assistive technology announces it: `error`
 * renders `role="alert"` and interrupts, while every other intent renders `role="status"`
 * and waits for a pause. That makes `error` a real cost to over-use.
 */
const meta = {
  title: "Components/Alert",
  component: Alert,
  tags: ["autodocs"],
  args: {
    title: "Changes saved",
    children: "Your changes are live and visible to everyone on the team.",
  },
  argTypes: {
    intent: { control: "select", options: ["info", "success", "warning", "error"] },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: context the reader may want, with no action required. */
export const Info: Story = {
  args: {
    title: "Scheduled maintenance",
    children: "The dashboard will be read-only on Sunday between 02:00 and 04:00 UTC.",
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole("status");

    await step("a non-error intent announces politely", async () => {
      expect(alert).toHaveAttribute("data-intent", "info");
      expect(canvas.queryByRole("alert"), "info should not use the assertive role").toBeNull();
    });

    await step("tokens resolved — the container fill is a real value", async () => {
      expect(getComputedStyle(alert).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    });
  },
};

/** Confirms something finished. Say what happened, not just that it worked. */
export const Success: Story = {
  args: { intent: "success" },
};

/**
 * Something needs attention but nothing has failed yet — an expiring card, a quota nearly
 * reached. Pair it with the action that resolves it.
 */
export const Warning: Story = {
  args: {
    intent: "warning",
    title: "Your card expires this month",
    children: "Update it before 30 November to avoid an interruption.",
  },
};

/**
 * Something failed. `error` is the only intent that announces assertively, interrupting
 * whatever the screen reader was saying — which is why it belongs to genuine failures and
 * not to emphasis.
 */
export const ErrorIntent: Story = {
  name: "Error",
  args: {
    intent: "error",
    title: "Payment failed",
    children: "Your bank declined the charge. No money has left your account.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole("alert");
    expect(alert).toHaveAttribute("data-intent", "error");
  },
};

/**
 * `actions` puts the way out directly in the message. An alert that states a problem
 * without an action leaves the reader to find the fix themselves.
 */
export const WithActions: Story = {
  args: {
    intent: "error",
    title: "Could not sync 3 records",
    children: "They were edited in two places at once.",
    actions: (
      <>
        <Button size="sm">Review conflicts</Button>
        <Button size="sm" variant="secondary" mode="ghost">
          Dismiss
        </Button>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "Review conflicts" })).toBeVisible();
  },
};

/**
 * The title is optional. Without one the description carries the whole message, which
 * suits a single short line — adding a title that only repeats it wastes a row.
 */
export const DescriptionOnly: Story = {
  args: { title: undefined, children: "Draft saved just now." },
};

/**
 * ANTI-PATTERN — `error` used for emphasis on something that has not failed. It takes the
 * assertive role, interrupting the screen reader for news that could have waited. Kept out
 * of the manifest.
 */
export const ErrorForEmphasisAntiPattern: Story = {
  tags: ["!manifest", "!test"],
  args: {
    intent: "error",
    title: "New feature",
    children: "Try the new export tool.",
  },
};

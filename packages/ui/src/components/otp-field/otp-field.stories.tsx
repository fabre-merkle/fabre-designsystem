import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { OTPField } from "./otp-field";

/**
 * OTPField takes a one-time code, split into one box per character. Behind the boxes it is
 * a single value, which is what makes it usable: pasting a whole code fills every box at
 * once, and the caret moves on its own as the user types.
 *
 * Compose it: `OTPField.Root` takes the `length` and holds that many `OTPField.Input`s,
 * with optional `OTPField.Separator`s between groups. The boxes are POSITIONAL — they take
 * no `index` prop; the root assigns each slot by order. Name the ROOT, not the boxes: a
 * screen reader should hear one field, not six.
 */
const meta = {
  title: "Components/OTPField",
  component: OTPField.Root,
  tags: ["autodocs"],
} satisfies Meta<typeof OTPField.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: a six-character code. */
export const Default: Story = {
  args: { length: 6 },
  render: (args) => (
    <OTPField.Root aria-label="Verification code" {...args}>
      {Array.from({ length: 6 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the boxes are positional and never reorder.
        <OTPField.Input key={index} />
      ))}
    </OTPField.Root>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const boxes = canvas.getAllByRole("textbox");

    await step("one box per character", async () => {
      expect(boxes).toHaveLength(6);
    });

    await step("tokens resolved — a box's border is a real value", async () => {
      expect(getComputedStyle(boxes[0]).borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    });

    await step("typing fills the boxes and advances on its own", async () => {
      boxes[0].focus();
      await userEvent.keyboard("482");
      expect(boxes[0]).toHaveValue("4");
      expect(boxes[1]).toHaveValue("8");
      expect(boxes[2]).toHaveValue("2");
    });

    await step("Backspace clears and steps back", async () => {
      await userEvent.keyboard("{Backspace}");
      expect(boxes[2]).toHaveValue("");
    });
  },
};

/**
 * A four-character code. The length is set once on the root; the boxes follow it, so the
 * two can never disagree.
 */
export const FourDigits: Story = {
  args: { length: 4 },
  render: (args) => (
    <OTPField.Root aria-label="PIN" {...args}>
      {Array.from({ length: 4 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the boxes are positional and never reorder.
        <OTPField.Input key={index} />
      ))}
    </OTPField.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getAllByRole("textbox")).toHaveLength(4);
  },
};

/**
 * A separator splits the code into groups, matching how the code is written in the email
 * that carried it. It is decorative — the value is unaffected.
 */
export const Grouped: Story = {
  args: { length: 6 },
  render: (args) => (
    <OTPField.Root aria-label="Verification code" {...args}>
      {[0, 1, 2].map((index) => (
        <OTPField.Input key={index} />
      ))}
      <OTPField.Separator />
      {[3, 4, 5].map((index) => (
        <OTPField.Input key={index} />
      ))}
    </OTPField.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getAllByRole("textbox")).toHaveLength(6);
  },
};

/** Pre-filled, for a code that arrived by autofill or a resend. */
export const Filled: Story = {
  args: { length: 6, defaultValue: "482913" },
  render: (args) => (
    <OTPField.Root aria-label="Verification code" {...args}>
      {Array.from({ length: 6 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the boxes are positional and never reorder.
        <OTPField.Input key={index} />
      ))}
    </OTPField.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = canvas.getAllByRole("textbox");
    expect(boxes[0]).toHaveValue("4");
    expect(boxes[5]).toHaveValue("3");
  },
};

/** Not editable — while the code is being checked, say. */
export const Disabled: Story = {
  args: { length: 6, disabled: true, defaultValue: "482913" },
  render: (args) => (
    <OTPField.Root aria-label="Verification code" {...args}>
      {Array.from({ length: 6 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the boxes are positional and never reorder.
        <OTPField.Input key={index} />
      ))}
    </OTPField.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getAllByRole("textbox")[0]).toBeDisabled();
  },
};

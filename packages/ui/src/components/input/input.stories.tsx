import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Input } from "./input";

/**
 * Input is the text control on its own — no label, no description, no error text. That is
 * deliberate: Field owns the surrounding anatomy. On its own, Input still needs an
 * accessible name, so every story here supplies one.
 *
 * `size` matches the Button of the same size, so a control and its action line up on one
 * row without nudging either.
 */
const meta = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  args: { "aria-label": "Email address", placeholder: "you@example.com" },
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default control: empty, ready for typing. */
export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Email address" });

    await step("it carries its size attribute", async () => {
      expect(input).toHaveAttribute("data-size", "md");
    });

    await step("tokens resolved — the border is a real value", async () => {
      expect(getComputedStyle(input).borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    });

    await step("it accepts typing and keeps what was typed", async () => {
      await userEvent.type(input, "ada@example.com");
      expect(input).toHaveValue("ada@example.com");
    });
  },
};

/**
 * A placeholder is a hint, never a label: it disappears the moment someone types, leaving
 * no way to check what the field was for. Pair the control with a FieldLabel in real use —
 * here `aria-label` stands in for one.
 */
export const WithPlaceholder: Story = {
  args: { placeholder: "Search orders, customers or SKUs", "aria-label": "Search" },
};

/**
 * `sm` for dense rows — a filter bar, a table toolbar — where the control sits among other
 * small controls rather than in a form.
 */
export const Small: Story = {
  args: { size: "sm" },
};

/**
 * `lg` for a single prominent field: a sign-in email, a one-question step. Pair with a
 * Button of the same size.
 */
export const Large: Story = {
  args: { size: "lg" },
};

/**
 * A disabled field is skipped by the keyboard and announced as unavailable. Use it only
 * when the value genuinely cannot be edited yet — a field disabled with no explanation
 * leaves no way forward.
 */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "ada@example.com" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("textbox", { name: "Email address" })).toBeDisabled();
  },
};

/**
 * A read-only field still focuses and still copies — the value matters to the reader even
 * though they cannot change it. Prefer it over `disabled` for generated values like an API
 * key or an invoice number.
 */
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: "sk_live_4eC39Hq" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Email address" });
    expect(input).toHaveAttribute("readonly");
    await userEvent.click(input);
    expect(input, "a read-only field still takes focus so its value can be copied").toHaveFocus();
  },
};

/**
 * ANTI-PATTERN — no label and no `aria-label`. A screen reader announces an unnamed text
 * field, and the placeholder vanishes on the first keystroke. Kept out of the manifest.
 */
export const UnnamedAntiPattern: Story = {
  tags: ["!manifest", "!test"],
  args: { "aria-label": undefined, placeholder: "Email" },
};

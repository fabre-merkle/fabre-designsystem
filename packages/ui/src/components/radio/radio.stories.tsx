import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { RadioGroup } from "../radio-group/radio-group";
import { Radio } from "./radio";

/**
 * Radio is one option inside a RadioGroup. It never stands alone — choosing between it and
 * nothing is a Checkbox, and a radio outside a group has no set to be exclusive within.
 * Every story here wraps it in a group for that reason.
 *
 * It renders the circle only and takes no children, so each option needs a name from a
 * wrapping `<label>` or `aria-label`. Note the asymmetry with Checkbox: a radio cannot be
 * unchosen, so add an explicit "None" option wherever clearing the answer must stay
 * possible.
 */
const meta = {
  title: "Components/Radio",
  component: Radio,
  tags: ["autodocs"],
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A single option, unchosen. */
export const Unchecked: Story = {
  args: { value: "standard", "aria-label": "Standard delivery" },
  render: (args) => (
    <RadioGroup aria-label="Delivery">
      <Radio {...args} />
    </RadioGroup>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const radio = canvas.getByRole("radio", { name: "Standard delivery" });

    await step("it starts unchosen", async () => {
      expect(radio).not.toBeChecked();
    });

    await step("tokens resolved — the circle's border is a real value", async () => {
      expect(getComputedStyle(radio).borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    });
  },
};

/** The chosen option. Its group holds the value, so the choice is set there. */
export const Checked: Story = {
  args: { value: "standard", "aria-label": "Standard delivery" },
  render: (args) => (
    <RadioGroup aria-label="Delivery" defaultValue="standard">
      <Radio {...args} />
    </RadioGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("radio", { name: "Standard delivery" })).toBeChecked();
  },
};

/**
 * The shape to reach for when the option has visible text: a wrapping label names the
 * radio and widens the hit target to the whole row.
 */
export const WithALabel: Story = {
  args: { value: "express" },
  render: (args) => (
    <RadioGroup aria-label="Delivery">
      {/* biome-ignore lint/a11y/noLabelWithoutControl: Radio renders the input inside this label; the rule only sees intrinsic elements. */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <Radio {...args} />
        Express delivery
      </label>
    </RadioGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("radio", { name: "Express delivery" })).toBeVisible();
  },
};

/** A single option that cannot be chosen, inside an otherwise live group. */
export const Disabled: Story = {
  args: { value: "overnight", "aria-label": "Overnight delivery", disabled: true },
  render: (args) => (
    <RadioGroup aria-label="Delivery">
      <Radio {...args} />
    </RadioGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("radio", { name: "Overnight delivery" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  },
};

/**
 * ANTI-PATTERN — a lone radio used as an on/off control. It can be turned on and never
 * off again, which is why that job belongs to Checkbox or Switch. Kept out of the manifest.
 */
export const LoneRadioAsToggleAntiPattern: Story = {
  tags: ["!manifest", "!test"],
  args: { value: "accepted", "aria-label": "I accept the terms" },
  render: (args) => (
    <RadioGroup aria-label="Terms">
      <Radio {...args} />
    </RadioGroup>
  ),
};

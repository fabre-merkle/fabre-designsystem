import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { NumberField } from "./number-field";

/**
 * NumberField is a numeric input with stepper buttons, for a number the user may want to
 * nudge rather than type — a quantity, a count, a duration. Use Input when stepping makes
 * no sense (a year, an amount), and Slider when the approximate value is enough.
 *
 * Compose it: `NumberField.Root` holds a `NumberField.Group` containing
 * `NumberField.Decrement`, `NumberField.Input` and `NumberField.Increment`.
 *
 * Name the INPUT, not the root: a label on `NumberField.Root` lands on a wrapper div and
 * never reaches the control, leaving an unnamed text box. Name the stepper buttons too —
 * a keyboard user has the arrow keys, but a pointer user hears only what the buttons say.
 */
const meta = {
  title: "Components/NumberField",
  component: NumberField.Root,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof NumberField.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

function Quantity(args: React.ComponentProps<typeof NumberField.Root>) {
  return (
    <NumberField.Root {...args}>
      <NumberField.Group>
        <NumberField.Decrement aria-label="Decrease quantity" />
        <NumberField.Input aria-label="Quantity" />
        <NumberField.Increment aria-label="Increase quantity" />
      </NumberField.Group>
    </NumberField.Root>
  );
}

/** The default: a value, with a stepper on each side. */
export const Default: Story = {
  args: { defaultValue: 1 },
  render: (args) => <Quantity {...args} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Quantity" });

    await step("the control carries its size", async () => {
      expect(input).toHaveAttribute("data-size", "md");
    });

    await step("tokens resolved — the group's border is a real value", async () => {
      const group = canvasElement.querySelector('[data-ui="number-field-group"]');
      if (group) expect(getComputedStyle(group).borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    });

    await step("the increment button raises the value", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Increase quantity" }));
      expect(input).toHaveValue("2");
    });

    await step("the decrement button lowers it again", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Decrease quantity" }));
      expect(input).toHaveValue("1");
    });
  },
};

/**
 * Arrow keys in the input do the same job as the buttons — the keyboard path, and the
 * reason the steppers themselves need no tab stop of their own.
 */
export const KeyboardStepping: Story = {
  args: { defaultValue: 5 },
  render: (args) => <Quantity {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Quantity" });

    input.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(input).toHaveValue("6");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveValue("4");
  },
};

/**
 * `min` and `max` bound the range, and the stepper that would leave it is disabled rather
 * than silently doing nothing — the control says what it will accept before it is asked.
 */
export const Bounded: Story = {
  args: { defaultValue: 1, min: 1, max: 3 },
  render: (args) => <Quantity {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.getByRole("button", { name: "Decrease quantity" }),
      "at the minimum, decrementing should be unavailable",
    ).toBeDisabled();
  },
};

/** A `step` other than 1, for values that only make sense in multiples. */
export const Stepped: Story = {
  args: { defaultValue: 10, step: 5 },
  render: (args) => <Quantity {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Increase quantity" }));
    expect(canvas.getByRole("textbox", { name: "Quantity" })).toHaveValue("15");
  },
};

/**
 * `invalid` sets `data-invalid` for error styling. It marks the state only — pair it with
 * a Field so the reason is said as well as shown.
 */
export const Invalid: Story = {
  args: { defaultValue: 0, invalid: true },
  render: (args) => <Quantity {...args} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="number-field"]');
    expect(root).toHaveAttribute("data-invalid");
  },
};

/** Not editable, and the steppers go with it. */
export const Disabled: Story = {
  args: { defaultValue: 1, disabled: true },
  render: (args) => <Quantity {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  },
};

/** The three heights. Reference only. */
export const Sizes: Story = {
  tags: ["!manifest"],
  args: { defaultValue: 1 },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      {(["sm", "md", "lg"] as const).map((size) => (
        <NumberField.Root key={size} defaultValue={1} size={size}>
          <NumberField.Group>
            <NumberField.Decrement aria-label={`Decrease ${size}`} />
            <NumberField.Input aria-label={size} />
            <NumberField.Increment aria-label={`Increase ${size}`} />
          </NumberField.Group>
        </NumberField.Root>
      ))}
    </div>
  ),
};

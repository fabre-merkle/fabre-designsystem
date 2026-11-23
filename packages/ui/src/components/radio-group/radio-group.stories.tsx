import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Radio } from "../radio/radio";
import { RadioGroup } from "./radio-group";

/**
 * RadioGroup presents mutually exclusive options with all of them visible. Use Select when
 * the list is long enough that showing it all is noise — the rough line is about five
 * options, after which the set stops being scannable and starts being a wall.
 *
 * The group owns the value, so `defaultValue` and `onValueChange` go here rather than on
 * the individual Radios.
 */
const meta = {
  title: "Components/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const PLANS = [
  { value: "free", label: "Free" },
  { value: "team", label: "Team" },
  { value: "enterprise", label: "Enterprise" },
];

function PlanGroup(args: React.ComponentProps<typeof RadioGroup>) {
  return (
    <RadioGroup aria-label="Plan" {...args}>
      {PLANS.map((plan) => (
        // biome-ignore lint/a11y/noLabelWithoutControl: Radio renders the input inside this label; the rule only sees intrinsic elements, and the play function proves the association by choosing an option from its text.
        <label
          key={plan.value}
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
        >
          <Radio value={plan.value} />
          {plan.label}
        </label>
      ))}
    </RadioGroup>
  );
}

/**
 * The default: nothing chosen. Starting empty is right when there is no sensible default
 * and the choice matters — it forces a real answer rather than letting one slip through.
 */
export const Default: Story = {
  render: (args) => <PlanGroup {...args} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("the group is named and holds every option", async () => {
      expect(canvas.getByRole("radiogroup")).toHaveAccessibleName("Plan");
      expect(canvas.getAllByRole("radio")).toHaveLength(PLANS.length);
    });

    await step("nothing is chosen yet", async () => {
      for (const radio of canvas.getAllByRole("radio")) expect(radio).not.toBeChecked();
    });

    await step("tokens resolved — the circle's border is a real value", async () => {
      expect(getComputedStyle(canvas.getAllByRole("radio")[0]).borderTopColor).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
    });

    await step("clicking an option's label chooses it", async () => {
      await userEvent.click(canvas.getByText("Team"));
      expect(canvas.getByRole("radio", { name: "Team" })).toBeChecked();
    });
  },
};

/**
 * A pre-selected default, for when one option is right for most people. The cost is that a
 * radio cannot be unchosen — once a default is set, "no answer" is no longer reachable.
 */
export const WithADefault: Story = {
  args: { defaultValue: "team" },
  render: (args) => <PlanGroup {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("radio", { name: "Team" })).toBeChecked();
  },
};

/**
 * Arrow keys move between options AND choose as they go — the standard radio model. It is
 * why a radio group takes a single tab stop rather than one per option.
 */
export const KeyboardSelection: Story = {
  args: { defaultValue: "free" },
  render: (args) => <PlanGroup {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole("radio", { name: "Free" });

    first.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(canvas.getByRole("radio", { name: "Team" })).toBeChecked();
    expect(first, "moving the selection also moves it away from the old option").not.toBeChecked();
  },
};

/** The whole set is unavailable. */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "free" },
  render: (args) => <PlanGroup {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("radio", { name: "Free" })).toHaveAttribute("aria-disabled", "true");
  },
};

/**
 * One option disabled while the rest stay available — a plan that cannot be chosen on the
 * current billing period, say. It stays visible so the full set of choices is still legible.
 */
export const WithADisabledOption: Story = {
  render: (args) => (
    <RadioGroup aria-label="Plan" {...args}>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: Radio renders the input inside this label; the rule only sees intrinsic elements. */}
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Radio value="free" />
        Free
      </label>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: Radio renders the input inside this label; the rule only sees intrinsic elements. */}
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Radio value="enterprise" disabled />
        Enterprise
      </label>
    </RadioGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("radio", { name: "Enterprise" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  },
};

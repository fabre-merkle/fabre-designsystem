import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Select } from "./select";

/**
 * Select chooses one value from a list too long to show at once. Use RadioGroup when there
 * are only a few options and seeing them all at a glance matters, and Combobox when the
 * list is long enough that the user will want to type to narrow it.
 *
 * Compose it: `Select.Root` holds a `Select.Trigger` (with `Select.Value` and
 * `Select.Icon`) and a `Select.Popup` of `Select.Item`s, each wrapping a
 * `Select.ItemText`.
 *
 * Give `Select.Root` an `items` map. Without it `Select.Value` renders the RAW value, so
 * a trigger shows `engineer` where the list said "Engineer" — the item's text is not
 * consulted. `items` is what maps one to the other.
 *
 * The popup renders in a portal, outside the story canvas, so these stories query it
 * through `screen` rather than `within(canvasElement)`.
 */
const meta = {
  title: "Components/Select",
  component: Select.Root,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Select.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

const ROLES = [
  { value: "designer", label: "Designer" },
  { value: "engineer", label: "Engineer" },
  { value: "manager", label: "Manager" },
];

function RoleSelect(args: React.ComponentProps<typeof Select.Root>) {
  return (
    <Select.Root items={ROLES} {...args}>
      <Select.Trigger aria-label="Role">
        <Select.Value placeholder="Choose a role" />
        <Select.Icon />
      </Select.Trigger>
      <Select.Popup>
        {ROLES.map((role) => (
          <Select.Item key={role.value} value={role.value}>
            <Select.ItemText>{role.label}</Select.ItemText>
            <Select.ItemIndicator />
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  );
}

/**
 * The default: nothing chosen yet, so the trigger shows its placeholder. A placeholder
 * here is a real affordance, not a label substitute — it says the field is still empty.
 */
export const Default: Story = {
  render: (args) => <RoleSelect {...args} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "Role" });

    await step("the trigger shows the placeholder and carries its size", async () => {
      expect(trigger).toHaveTextContent("Choose a role");
      expect(trigger).toHaveAttribute("data-size", "md");
    });

    await step("tokens resolved — the trigger border is a real value", async () => {
      expect(getComputedStyle(trigger).borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    });

    await step("it opens on click and lists the options", async () => {
      await userEvent.click(trigger);
      await waitFor(() => expect(screen.getByRole("listbox")).toBeVisible());
      expect(screen.getAllByRole("option")).toHaveLength(ROLES.length);
    });

    await step("choosing an option closes the popup and updates the trigger", async () => {
      await userEvent.click(screen.getByRole("option", { name: "Engineer" }));
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
      expect(trigger).toHaveTextContent("Engineer");
    });
  },
};

/** Opening with a value already set — editing something rather than creating it. */
export const WithAValue: Story = {
  args: { defaultValue: "designer" },
  render: (args) => <RoleSelect {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("combobox", { name: "Role" })).toHaveTextContent("Designer");
  },
};

/**
 * The keyboard path: Enter opens the list, arrows move through it, Enter chooses. Worth a
 * test of its own — a select that only works with a mouse is a common regression.
 */
export const KeyboardSelection: Story = {
  render: (args) => <RoleSelect {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "Role" });

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("listbox")).toBeVisible());

    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(trigger, "the trigger should hold whatever the keyboard chose").not.toHaveTextContent(
      "Choose a role",
    );
  },
};

/**
 * Grouped options, with a label per group. Groups help when the list has natural sections;
 * they do not help when it is simply long — that is what Combobox's filtering is for.
 */
export const Grouped: Story = {
  render: (args) => (
    <Select.Root
      items={[
        { label: "Ada", value: "ada" },
        { label: "Grace", value: "grace" },
      ]}
      {...args}
    >
      <Select.Trigger aria-label="Assignee">
        <Select.Value placeholder="Choose a person" />
        <Select.Icon />
      </Select.Trigger>
      <Select.Popup>
        <Select.Group>
          <Select.GroupLabel>Design</Select.GroupLabel>
          <Select.Item value="ada">
            <Select.ItemText>Ada</Select.ItemText>
            <Select.ItemIndicator />
          </Select.Item>
        </Select.Group>
        <Select.Separator />
        <Select.Group>
          <Select.GroupLabel>Engineering</Select.GroupLabel>
          <Select.Item value="grace">
            <Select.ItemText>Grace</Select.ItemText>
            <Select.ItemIndicator />
          </Select.Item>
        </Select.Group>
      </Select.Popup>
    </Select.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox", { name: "Assignee" }));
    await waitFor(() => expect(screen.getByRole("listbox")).toBeVisible());
    expect(screen.getByText("Engineering")).toBeVisible();
  },
};

/** Not editable, and skipped by the keyboard. */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "designer" },
  render: (args) => <RoleSelect {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Base UI marks the disabled trigger with `data-disabled`, which is what the CSS keys
    // off; there is no `aria-disabled` on it.
    expect(canvas.getByRole("combobox", { name: "Role" })).toHaveAttribute("data-disabled");
  },
};

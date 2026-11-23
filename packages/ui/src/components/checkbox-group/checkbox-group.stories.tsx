import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Checkbox } from "../checkbox/checkbox";
import { CheckboxGroup } from "./checkbox-group";

/**
 * CheckboxGroup binds related checkboxes to one value — an array of the names checked.
 * Reach for it when the options belong together and are submitted as one answer; separate
 * Checkboxes are fine when each stands alone.
 *
 * Its other job is the parent checkbox: pass `allValues` and the first child becomes a
 * select-all that reads indeterminate while only some children are checked.
 */
const meta = {
  title: "Components/CheckboxGroup",
  component: CheckboxGroup,
  tags: ["autodocs"],
} satisfies Meta<typeof CheckboxGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const CHANNELS = [
  { name: "email", label: "Email" },
  { name: "sms", label: "SMS" },
  { name: "push", label: "Push" },
];

/** The default: three related options sharing one value. */
export const Default: Story = {
  render: (args) => (
    <CheckboxGroup aria-label="Notification channels" {...args}>
      {CHANNELS.map((channel) => (
        // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders the input inside this label; the rule only sees intrinsic elements, and the play function proves the association by toggling from the label text.
        <label
          key={channel.name}
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
        >
          <Checkbox name={channel.name} />
          {channel.label}
        </label>
      ))}
    </CheckboxGroup>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("every option is present and unchecked", async () => {
      expect(canvas.getAllByRole("checkbox")).toHaveLength(CHANNELS.length);
      for (const box of canvas.getAllByRole("checkbox")) expect(box).not.toBeChecked();
    });

    await step("tokens resolved — the box border is a real value", async () => {
      expect(getComputedStyle(canvas.getAllByRole("checkbox")[0]).borderTopColor).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
    });

    await step("several may be on at once — the whole point of a checkbox group", async () => {
      await userEvent.click(canvas.getByText("Email"));
      await userEvent.click(canvas.getByText("Push"));
      expect(canvas.getByRole("checkbox", { name: "Email" })).toBeChecked();
      expect(canvas.getByRole("checkbox", { name: "Push" })).toBeChecked();
      expect(canvas.getByRole("checkbox", { name: "SMS" })).not.toBeChecked();
    });
  },
};

/** Some options on from the start, through the group's value rather than each child's. */
export const WithDefaults: Story = {
  args: { defaultValue: ["email", "push"] },
  render: (args) => (
    <CheckboxGroup aria-label="Notification channels" {...args}>
      {CHANNELS.map((channel) => (
        // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders the input inside this label; the rule only sees intrinsic elements.
        <label key={channel.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Checkbox name={channel.name} />
          {channel.label}
        </label>
      ))}
    </CheckboxGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("checkbox", { name: "Email" })).toBeChecked();
    expect(canvas.getByRole("checkbox", { name: "SMS" })).not.toBeChecked();
  },
};

/**
 * `allValues` makes the first checkbox a parent. It reads indeterminate while the
 * children disagree, checks them all when clicked, and clears them all when clicked
 * again — the behaviour people expect from a select-all and rarely get.
 */
export const WithASelectAll: Story = {
  args: {
    allValues: CHANNELS.map((channel) => channel.name),
    defaultValue: ["email"],
  },
  render: (args) => (
    <CheckboxGroup aria-label="Notification channels" {...args}>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders the input inside this label; the rule only sees intrinsic elements. */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <Checkbox parent />
        All channels
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingInlineStart: 24 }}>
        {CHANNELS.map((channel) => (
          // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders the input inside this label; the rule only sees intrinsic elements.
          <label
            key={channel.name}
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
          >
            <Checkbox name={channel.name} />
            {channel.label}
          </label>
        ))}
      </div>
    </CheckboxGroup>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const parent = canvas.getByRole("checkbox", { name: "All channels" });

    await step("the parent reads mixed while only some children are on", async () => {
      expect(parent).toHaveAttribute("aria-checked", "mixed");
    });

    await step("clicking it turns everything on", async () => {
      await userEvent.click(parent);
      for (const channel of CHANNELS) {
        expect(canvas.getByRole("checkbox", { name: channel.label })).toBeChecked();
      }
    });
  },
};

/** The whole set is unavailable. */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: ["email"] },
  render: (args) => (
    <CheckboxGroup aria-label="Notification channels" {...args}>
      {CHANNELS.map((channel) => (
        // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders the input inside this label; the rule only sees intrinsic elements.
        <label key={channel.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Checkbox name={channel.name} />
          {channel.label}
        </label>
      ))}
    </CheckboxGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("checkbox", { name: "Email" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  },
};

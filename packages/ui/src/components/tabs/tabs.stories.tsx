import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Tabs } from "./tabs";

/**
 * Tabs switch between views of the same kind of thing in one place. Not for steps in a
 * sequence — that is a wizard, where order matters and going back has meaning — and not
 * for moving between pages, which needs real links so the URL and the back button work.
 *
 * Compose it: `Tabs.Root` holds a `Tabs.List` of `Tabs.Tab`s and one `Tabs.Panel` per tab,
 * matched by `value`.
 */
const meta = {
  title: "Components/Tabs",
  component: Tabs.Root,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["xs", "sm", "md", "lg"] },
    variant: { control: "select", options: ["line", "segment"] },
  },
} satisfies Meta<typeof Tabs.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

const PANELS = [
  { value: "overview", label: "Overview", body: "Traffic, conversion and revenue at a glance." },
  { value: "activity", label: "Activity", body: "Every change, newest first." },
  { value: "settings", label: "Settings", body: "Who can see this project, and how." },
];

/**
 * The default `line` variant: an underline marks the current tab. It sits naturally above
 * a wide body of content, where a segmented control would look like a filter.
 */
export const Line: Story = {
  args: { defaultValue: "overview" },
  render: (args) => (
    <Tabs.Root {...args} style={{ width: 420 }}>
      <Tabs.List>
        {PANELS.map((panel) => (
          <Tabs.Tab key={panel.value} value={panel.value}>
            {panel.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator />
      </Tabs.List>
      {PANELS.map((panel) => (
        <Tabs.Panel key={panel.value} value={panel.value}>
          {panel.body}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("the first tab is selected and its panel is the one shown", async () => {
      expect(canvas.getByRole("tab", { name: "Overview" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(canvas.getByText(PANELS[0].body)).toBeVisible();
    });

    await step("tokens resolved — the tab label colour is a real value", async () => {
      const tab = canvas.getByRole("tab", { name: "Overview" });
      expect(getComputedStyle(tab).color).not.toBe("rgba(0, 0, 0, 0)");
    });

    await step("clicking another tab swaps the panel", async () => {
      await userEvent.click(canvas.getByRole("tab", { name: "Activity" }));
      expect(canvas.getByRole("tab", { name: "Activity" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(canvas.getByText(PANELS[1].body)).toBeVisible();
    });

    await step("arrows move through the tabs and Enter commits the move", async () => {
      // Activation is manual here: the arrow moves focus, and the tab is only selected
      // once it is activated. Asserting the arrow alone would be asserting the other mode.
      await userEvent.keyboard("{ArrowRight}");
      expect(canvas.getByRole("tab", { name: "Settings" })).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      expect(canvas.getByRole("tab", { name: "Settings" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  },
};

/**
 * `segment` encloses the tabs in a track, so the set reads as one control. It suits a
 * narrow column or a toolbar, where an underline would be lost.
 */
export const Segment: Story = {
  args: { defaultValue: "overview", variant: "segment" },
  render: (args) => (
    <Tabs.Root {...args}>
      <Tabs.List>
        {PANELS.map((panel) => (
          <Tabs.Tab key={panel.value} value={panel.value}>
            {panel.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator />
      </Tabs.List>
      {PANELS.map((panel) => (
        <Tabs.Panel key={panel.value} value={panel.value}>
          {panel.body}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  ),
};

/**
 * Opening on a tab other than the first — for returning someone to where they were. The
 * panel follows `defaultValue`; nothing else needs setting.
 */
export const OpenOnASpecificTab: Story = {
  args: { defaultValue: "settings" },
  render: (args) => (
    <Tabs.Root {...args} style={{ width: 420 }}>
      <Tabs.List>
        {PANELS.map((panel) => (
          <Tabs.Tab key={panel.value} value={panel.value}>
            {panel.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator />
      </Tabs.List>
      {PANELS.map((panel) => (
        <Tabs.Panel key={panel.value} value={panel.value}>
          {panel.body}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(PANELS[2].body)).toBeVisible();
  },
};

/**
 * A tab that cannot be chosen yet — a step not unlocked, a section with no permission. It
 * stays visible so the shape of the whole is still legible, and arrow keys skip it.
 */
export const WithADisabledTab: Story = {
  args: { defaultValue: "overview" },
  render: (args) => (
    <Tabs.Root {...args} style={{ width: 420 }}>
      <Tabs.List>
        <Tabs.Tab value="overview">Overview</Tabs.Tab>
        <Tabs.Tab value="activity">Activity</Tabs.Tab>
        <Tabs.Tab value="settings" disabled>
          Settings
        </Tabs.Tab>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Panel value="overview">{PANELS[0].body}</Tabs.Panel>
      <Tabs.Panel value="activity">{PANELS[1].body}</Tabs.Panel>
      <Tabs.Panel value="settings">{PANELS[2].body}</Tabs.Panel>
    </Tabs.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const disabled = canvas.getByRole("tab", { name: "Settings" });
    // Not clicked: the tab carries `pointer-events: none`, so a click would throw in the
    // test runner rather than being quietly ignored the way it is for a real user.
    // A `<button aria-disabled="true">`, not a natively disabled one: Base UI keeps the tab
    // in the accessibility tree so the shape of the whole set stays readable, which is why
    // jest-dom's `toBeDisabled()` does not match it.
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    expect(disabled, "a disabled tab is never the selected one").toHaveAttribute(
      "aria-selected",
      "false",
    );
  },
};

/** Every size at the `line` variant. Reference only. */
export const Sizes: Story = {
  tags: ["!manifest"],
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <Tabs.Root key={size} defaultValue="overview" size={size}>
          <Tabs.List>
            <Tabs.Tab value="overview">Overview</Tabs.Tab>
            <Tabs.Tab value="activity">Activity</Tabs.Tab>
            <Tabs.Indicator />
          </Tabs.List>
        </Tabs.Root>
      ))}
    </div>
  ),
};

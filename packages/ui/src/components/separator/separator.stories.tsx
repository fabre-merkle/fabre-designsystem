import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Separator } from "./separator";

/**
 * Separator draws a boundary the layout alone does not show. A plain rule is decorative:
 * it is there for the eye, and a screen reader gets the same grouping from the headings
 * and landmarks around it.
 *
 * The labelled variants put a word on the rule — "or", "Today", "Archived" — for a
 * boundary that needs naming rather than just drawing.
 */
const meta = {
  title: "Components/Separator",
  component: Separator,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["line", "solid-text", "underline", "content"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
    orientation: { control: "inline-radio", options: ["horizontal", "vertical"] },
  },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: a plain horizontal rule between two blocks of content. */
export const Line: Story = {
  render: (args) => (
    <div style={{ width: 320 }}>
      <p style={{ margin: 0 }}>Invoices for November.</p>
      <Separator {...args} style={{ margin: "12px 0" }} />
      <p style={{ margin: 0 }}>Invoices for October.</p>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const separator = canvas.getByRole("separator");

    await step("it carries its variant and orientation", async () => {
      expect(separator).toHaveAttribute("data-variant", "line");
      expect(separator).toHaveAttribute("aria-orientation", "horizontal");
    });

    await step("tokens resolved — the rule has a real colour", async () => {
      const style = getComputedStyle(separator);
      const painted =
        style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.borderTopWidth !== "0px";
      expect(painted, "the separator should be drawn from a loaded token").toBe(true);
    });
  },
};

/**
 * A label centred on the rule. The classic use is "or" between two ways of signing in,
 * where the word carries as much as the line does.
 */
export const WithALabel: Story = {
  args: { variant: "solid-text" },
  render: (args) => (
    <div style={{ width: 320 }}>
      <Separator {...args}>or</Separator>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("or")).toBeVisible();
  },
};

/**
 * `content` flanks the label with a rule on each side — for a section heading inside a
 * list, where the label names what follows rather than dividing two equals.
 */
export const SectionLabel: Story = {
  args: { variant: "content" },
  render: (args) => (
    <div style={{ width: 320 }}>
      <Separator {...args}>Today</Separator>
    </div>
  ),
};

/**
 * `underline` puts the rule beneath the label, so the label reads as a heading rather
 * than as something interrupting the line.
 */
export const Underline: Story = {
  args: { variant: "underline" },
  render: (args) => (
    <div style={{ width: 320 }}>
      <Separator {...args}>Archived</Separator>
    </div>
  ),
};

/**
 * Vertical separators stretch to fill the cross axis of a flex row — between items in a
 * toolbar or a row of stats. They need a parent with a height to stretch into.
 */
export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div style={{ display: "flex", alignItems: "stretch", gap: 16, height: 40 }}>
      <span>Drafts</span>
      <Separator {...args} />
      <span>Sent</span>
      <Separator {...args} />
      <span>Archive</span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const separators = canvas.getAllByRole("separator");
    expect(separators).toHaveLength(2);
    expect(separators[0]).toHaveAttribute("aria-orientation", "vertical");
  },
};

/** The label sizes. Ignored on the plain `line` variant. Reference only. */
export const Sizes: Story = {
  tags: ["!manifest"],
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 320 }}>
      {(["sm", "md", "lg"] as const).map((size) => (
        <Separator key={size} variant="content" size={size}>
          {size}
        </Separator>
      ))}
    </div>
  ),
};

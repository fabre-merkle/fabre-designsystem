import { ArrowRight, Plus, Trash } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "./button";

/**
 * Button triggers an action in place — submitting, opening a dialog, adding a row. For
 * navigation to another URL, use a link instead, so the browser's own affordances (open in
 * a new tab, copy address) keep working.
 *
 * Three independent axes describe one: `variant` is the semantic role (how important the
 * action is), `mode` is the visual weight at that role, and `size` is the control height.
 * Keep one primary filled Button per view so the main action stays obvious.
 */
const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Save changes" },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "tertiary", "destructive", "inverse"],
    },
    mode: { control: "select", options: ["filled", "stroke", "lighter", "ghost"] },
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg", "icon-xs", "icon-sm", "icon", "icon-lg"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: the one action you most want taken on this view. */
export const Primary: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Save changes" });

    await step("the control carries its semantic data attributes", async () => {
      expect(button).toHaveAttribute("data-variant", "primary");
      expect(button).toHaveAttribute("data-mode", "filled");
      expect(button).toHaveAttribute("data-size", "md");
    });

    await step("tokens resolved — the fill is a real value, not an unset var()", async () => {
      const background = getComputedStyle(button).backgroundColor;
      expect(background, "button fill should come from a loaded token").not.toBe(
        "rgba(0, 0, 0, 0)",
      );
    });

    await step("it is reachable and activatable by keyboard", async () => {
      await userEvent.tab();
      expect(button).toHaveFocus();
    });
  },
};

/**
 * The supporting action beside a primary one — "Cancel" next to "Save". Secondary keeps
 * the same height so the pair sits on one baseline.
 */
export const Secondary: Story = {
  args: { variant: "secondary", mode: "stroke", children: "Cancel" },
};

/**
 * Destructive marks an action that loses data. Reach for it only where the consequence is
 * real; routine actions in a red button teach people to ignore red.
 */
export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete project" },
};

/**
 * `ghost` drops the fill entirely, for dense rows of actions — a toolbar, a table row —
 * where filled buttons would fight the content for attention.
 */
export const Ghost: Story = {
  args: { variant: "secondary", mode: "ghost", children: "Rename" },
};

/**
 * An icon beside the label points at the action's direction or object. Two rules decide
 * whether the component sees it, and both bite silently:
 *
 * 1. The icon must carry `data-icon`. A child counts as an icon only when it is a raw
 *    `svg` or has that attribute, and an icon component (Phosphor, Lucide) is neither
 *    until you add it. Give it a side (`inline-start` / `inline-end`), or a bare
 *    `data-icon=""` to let the children order decide.
 * 2. Pass the label and icon as SIBLINGS, not wrapped in a fragment. The component walks
 *    `React.Children` of what it is given; a fragment is one opaque child, so the icon
 *    inside it is never found and no side is marked.
 */
export const WithIcon: Story = {
  args: { children: undefined },
  render: (args) => (
    <Button {...args}>
      Continue
      <ArrowRight data-icon="inline-end" />
    </Button>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /continue/i });
    // The prop takes `inline-end`; the attribute the CSS keys off is the short `end`.
    expect(button, "an icon after the text should mark the trailing side").toHaveAttribute(
      "data-icon-side",
      "end",
    );
  },
};

/**
 * An `icon-*` size makes a square control. It has no visible text, so it MUST carry an
 * accessible name — the component throws in development without one. `children: undefined`
 * clears the meta-level default label so only the icon is passed.
 */
export const IconOnly: Story = {
  args: {
    children: undefined,
    size: "icon",
    "aria-label": "Add item",
  },
  render: (args) => (
    <Button {...args}>
      <Plus data-icon="" />
    </Button>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Add item" });
    expect(button).toHaveAttribute("data-icon-only", "true");
  },
};

/**
 * A disabled Button stays in the page but stops responding. Prefer leaving the control
 * enabled and explaining the failure on submit — a disabled control gives no reason for
 * being unavailable.
 */
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Save changes" });
    expect(button).toBeDisabled();
  },
};

/**
 * Every size at the same variant, so the steps can be compared directly. Reference only —
 * a real view picks one size and stays with it.
 */
export const Sizes: Story = {
  tags: ["!manifest"],
  args: { children: undefined },
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

/**
 * ANTI-PATTERN — an icon-only button with no accessible name. A screen reader announces
 * only "button". The component throws in development; this story exists to name the
 * mistake, and is kept out of the agent manifest.
 */
export const IconOnlyWithoutNameAntiPattern: Story = {
  tags: ["!manifest", "!test"],
  args: { children: undefined, size: "icon" },
  render: (args) => (
    <Button {...args}>
      <Trash data-icon="" />
    </Button>
  ),
};

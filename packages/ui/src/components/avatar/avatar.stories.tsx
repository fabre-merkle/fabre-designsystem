import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Avatar } from "./avatar";

/**
 * Avatar shows a person or organisation's picture, falling back to initials when there is
 * none. Compose it: `Avatar.Root` holds `Avatar.Image` and `Avatar.Fallback`.
 *
 * Always supply a fallback. It covers three cases that look identical to the user — no
 * image, an image still loading, and an image that failed — and without one the avatar
 * collapses to an empty circle.
 */
const meta = {
  title: "Components/Avatar",
  component: Avatar.Root,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
    shape: { control: "select", options: ["circle", "square"] },
  },
} satisfies Meta<typeof Avatar.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Initials are the common case — most people have no picture. Two letters is the limit at
 * `sm`; more will not fit.
 */
export const Initials: Story = {
  render: (args) => (
    <Avatar.Root {...args}>
      <Avatar.Fallback>AF</Avatar.Fallback>
    </Avatar.Root>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const fallback = canvas.getByText("AF");

    await step("the root carries its size and shape", async () => {
      const root = fallback.closest('[data-ui="avatar"]');
      expect(root).toHaveAttribute("data-size", "md");
      expect(root).toHaveAttribute("data-shape", "circle");
    });

    await step("tokens resolved — the surface fill is a real value", async () => {
      // The fill sits on the root; the fallback is transparent and inherits it.
      const root = fallback.closest('[data-ui="avatar"]');
      if (root) expect(getComputedStyle(root).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    });
  },
};

/**
 * With a picture. The `alt` is empty here because an avatar beside a name that is already
 * on screen is decorative — repeating the name would have a screen reader say it twice.
 */
export const WithImage: Story = {
  render: (args) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Avatar.Root {...args}>
        <Avatar.Image
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23b91c1c'/%3E%3C/svg%3E"
          alt=""
        />
        <Avatar.Fallback>AF</Avatar.Fallback>
      </Avatar.Root>
      Alejandro Fabregat
    </span>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("presentation")).toBeVisible());
  },
};

/**
 * A broken `src` falls back silently — the reason this component takes a fallback at all.
 * The user sees initials, not a broken-image glyph.
 */
export const ImageFailsToLoad: Story = {
  render: (args) => (
    <Avatar.Root {...args}>
      <Avatar.Image src="/does-not-exist.png" alt="" />
      <Avatar.Fallback>AF</Avatar.Fallback>
    </Avatar.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(
        canvas.getByText("AF"),
        "a failed image should leave the fallback showing",
      ).toBeVisible(),
    );
  },
};

/**
 * `square` for an organisation, a project or a repository — anything that is not a person.
 * Keeping people round and things square makes the two scannable at a glance.
 */
export const Square: Story = {
  args: { shape: "square" },
  render: (args) => (
    <Avatar.Root {...args}>
      <Avatar.Fallback>MK</Avatar.Fallback>
    </Avatar.Root>
  ),
};

/** The three sizes side by side. Reference only. */
export const Sizes: Story = {
  tags: ["!manifest"],
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Avatar.Root size="sm">
        <Avatar.Fallback>SM</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root size="md">
        <Avatar.Fallback>MD</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root size="lg">
        <Avatar.Fallback>LG</Avatar.Fallback>
      </Avatar.Root>
    </div>
  ),
};

/**
 * ANTI-PATTERN — no fallback. While the image loads, and forever if it fails, the avatar
 * is an empty shape. Kept out of the manifest.
 */
export const NoFallbackAntiPattern: Story = {
  tags: ["!manifest", "!test"],
  render: (args) => (
    <Avatar.Root {...args}>
      <Avatar.Image src="/does-not-exist.png" alt="" />
    </Avatar.Root>
  ),
};

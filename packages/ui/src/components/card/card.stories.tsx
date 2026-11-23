import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Badge } from "../badge/badge";
import { Button } from "../button/button";
import { Card } from "./index";

/**
 * Card groups related content into one surface. It is a container, not a control: if the
 * whole card should be clickable, put a real link or Button inside it rather than a
 * handler on the surface, so the target is reachable by keyboard and announced as one.
 *
 * The surface comes from Elevated, so a card lands two levels above whatever it sits on —
 * level 3 on the page, level 5 inside another card. Nesting takes care of itself.
 *
 * Compose it: `Card.Root` holds an optional `Card.Header` (with `Card.Title`,
 * `Card.Description` and `Card.Action`), a `Card.Content`, and a `Card.Footer`.
 */
const meta = {
  title: "Components/Card",
  component: Card.Root,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Card.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: a title, supporting text and a body. */
export const Default: Story = {
  render: (args) => (
    <Card.Root {...args} style={{ width: 320 }}>
      <Card.Header>
        {/* biome-ignore lint/a11y/useHeadingContent: useRender injects the title text into this h3; the rule only sees the empty element literal. */}
        <Card.Title render={<h3 />}>Monthly report</Card.Title>
        <Card.Description>Covering 1–30 November.</Card.Description>
      </Card.Header>
      <Card.Content>
        Revenue rose 12% against October, driven mostly by returning customers.
      </Card.Content>
    </Card.Root>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("the title renders as a real heading when asked to", async () => {
      expect(canvas.getByRole("heading", { name: "Monthly report" })).toBeVisible();
    });

    await step("the root carries its size and surface level", async () => {
      const root = canvasElement.querySelector('[data-ui="card"]');
      expect(root).toHaveAttribute("data-size", "md");
      expect(root, "Elevated should have assigned a surface level").toHaveAttribute(
        "data-surface-level",
      );
    });

    await step("tokens resolved — the surface fill is a real value", async () => {
      const root = canvasElement.querySelector('[data-ui="card"]');
      if (root) expect(getComputedStyle(root).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    });
  },
};

/**
 * `Card.Title` is a `div` unless you give it one. Pass `render={<h3 />}` so the card takes
 * its place in the page's heading outline — a screen reader user navigating by heading
 * skips right past a card titled with a `div`.
 */
export const TitleAsAHeading: Story = {
  render: (args) => (
    <Card.Root {...args} style={{ width: 320 }}>
      <Card.Header>
        {/* biome-ignore lint/a11y/useHeadingContent: useRender injects the title text into this h3; the rule only sees the empty element literal. */}
        <Card.Title render={<h3 />}>Billing</Card.Title>
        <Card.Description>Visa ending 4242.</Card.Description>
      </Card.Header>
      <Card.Content>Next charge on 1 December.</Card.Content>
    </Card.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("heading", { level: 3, name: "Billing" })).toBeVisible();
  },
};

/**
 * `Card.Action` sits in the header beside the title and description, not below them — the
 * place for a menu button or a status that belongs to the card as a whole.
 */
export const WithAHeaderAction: Story = {
  render: (args) => (
    <Card.Root {...args} style={{ width: 320 }}>
      <Card.Header>
        {/* biome-ignore lint/a11y/useHeadingContent: useRender injects the title text into this h3; the rule only sees the empty element literal. */}
        <Card.Title render={<h3 />}>Deployment</Card.Title>
        <Card.Description>main@9409172</Card.Description>
        <Card.Action>
          <Badge tone="success" mode="light" size="sm">
            Live
          </Badge>
        </Card.Action>
      </Card.Header>
      <Card.Content>Deployed 12 minutes ago by fabre-merkle.</Card.Content>
    </Card.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Live")).toBeVisible();
  },
};

/**
 * `Card.Footer` holds the actions. Keep them to one or two: a card with a row of equal
 * buttons gives no clue which one is the point of it.
 */
export const WithFooterActions: Story = {
  render: (args) => (
    <Card.Root {...args} style={{ width: 320 }}>
      <Card.Header>
        {/* biome-ignore lint/a11y/useHeadingContent: useRender injects the title text into this h3; the rule only sees the empty element literal. */}
        <Card.Title render={<h3 />}>Invite your team</Card.Title>
        <Card.Description>Three seats are still free on this plan.</Card.Description>
      </Card.Header>
      <Card.Content>Everyone you invite can read every project by default.</Card.Content>
      <Card.Footer>
        <Button size="sm">Send invites</Button>
        <Button size="sm" variant="secondary" mode="ghost">
          Not now
        </Button>
      </Card.Footer>
    </Card.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "Send invites" })).toBeVisible();
  },
};

/**
 * A card inside a card. The nested surface lands two levels above its parent on its own,
 * so nothing needs setting by hand — which is the point of the Elevated surface model.
 */
export const Nested: Story = {
  render: (args) => (
    <Card.Root {...args} style={{ width: 360 }}>
      <Card.Header>
        {/* biome-ignore lint/a11y/useHeadingContent: useRender injects the title text into this h3; the rule only sees the empty element literal. */}
        <Card.Title render={<h3 />}>November</Card.Title>
      </Card.Header>
      <Card.Content>
        <Card.Root size="sm">
          <Card.Header>
            <Card.Title>Revenue</Card.Title>
            <Card.Description>€48,210</Card.Description>
          </Card.Header>
        </Card.Root>
      </Card.Content>
    </Card.Root>
  ),
  play: async ({ canvasElement }) => {
    const cards = canvasElement.querySelectorAll('[data-ui="card"]');
    expect(cards.length).toBe(2);
    const outer = cards[0].getAttribute("data-surface-level");
    const inner = cards[1].getAttribute("data-surface-level");
    expect(Number(inner), "a nested card should sit above its parent").toBeGreaterThan(
      Number(outer),
    );
  },
};

/** The three densities. Size changes spacing only — the type stays put. Reference only. */
export const Sizes: Story = {
  tags: ["!manifest"],
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      {(["sm", "md", "lg"] as const).map((size) => (
        <Card.Root key={size} size={size} style={{ width: 200 }}>
          <Card.Header>
            <Card.Title>{size}</Card.Title>
            <Card.Description>Spacing only.</Card.Description>
          </Card.Header>
          <Card.Content>Body text.</Card.Content>
        </Card.Root>
      ))}
    </div>
  ),
};

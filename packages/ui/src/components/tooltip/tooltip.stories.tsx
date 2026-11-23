import { Gear, Plus, Trash } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../button/button";
import { Tooltip } from "./tooltip";

/**
 * Tooltip gives a short label to a control whose purpose is not obvious — almost always
 * an icon-only button. It appears on hover and on keyboard focus, but **never on touch**,
 * so whatever it says must also be available some other way. Nothing essential belongs in
 * one, and nothing interactive: use Popover for that.
 *
 * Compose it: `Tooltip.Root` holds a `Tooltip.Trigger` and a `Tooltip.Portal` containing
 * `Tooltip.Positioner` > `Tooltip.Popup`.
 *
 * Two things to know before relying on one. The popup renders in a portal, outside the
 * story canvas. And it carries **no `role="tooltip"`** and gives the trigger no
 * `aria-describedby` — it is a visual affordance, not an announced one. So the trigger
 * must carry its own accessible name, and the tooltip should repeat that name rather than
 * add to it. Every story here does exactly that.
 */
const meta = {
  title: "Components/Tooltip",
  component: Tooltip.Root,
  tags: ["autodocs"],
} satisfies Meta<typeof Tooltip.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The popup carries no `role="tooltip"`, so it cannot be queried by role. It is found by
 * its own part attribute instead — see the note on `Default`.
 */
const popup = () => document.querySelector<HTMLElement>('[data-ui="tooltip-popup"]');

/** The default: an icon-only button, named by its tooltip. */
export const Default: Story = {
  render: (args) => (
    <Tooltip.Root {...args}>
      <Tooltip.Trigger
        render={
          <Button size="icon" aria-label="Add item">
            <Plus data-icon="" />
          </Button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>Add item</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Add item" });

    await step("nothing is shown until the trigger is reached", async () => {
      expect(popup()).toBeNull();
    });

    await step("hovering reveals it", async () => {
      await userEvent.hover(trigger);
      await waitFor(() => expect(popup()).toBeVisible());
      expect(popup()).toHaveTextContent("Add item");
    });

    await step("the trigger carries the name; the tooltip only repeats it", async () => {
      // There is no `role="tooltip"` and no `aria-describedby` back to the trigger, so
      // whatever the popup says is never announced. The button's own `aria-label` is what
      // a screen reader hears — which is why the two say the same thing.
      expect(trigger).toHaveAccessibleName("Add item");
    });

    await step("tokens resolved — the popup fill is a real value", async () => {
      const node = popup();
      if (node) expect(getComputedStyle(node).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    });

    await step("moving away hides it again", async () => {
      await userEvent.unhover(trigger);
      await waitFor(() => expect(popup()).toBeNull());
    });
  },
};

/**
 * Keyboard focus shows the tooltip too — the reason it is usable at all without a mouse.
 * A tooltip that only appears on hover is invisible to a keyboard user.
 */
export const ShownOnKeyboardFocus: Story = {
  render: (args) => (
    <Tooltip.Root {...args}>
      <Tooltip.Trigger
        render={
          <Button size="icon" variant="secondary" mode="ghost" aria-label="Settings">
            <Gear data-icon="" />
          </Button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>Settings</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("button", { name: "Settings" }).focus();
    await waitFor(() => expect(popup()).toBeVisible());
    expect(popup()).toHaveTextContent("Settings");
  },
};

/**
 * `Tooltip.Provider` wraps a group so moving between neighbouring triggers skips the
 * opening delay — the row behaves like one toolbar rather than several separate waits.
 */
export const AToolbarOfTriggers: Story = {
  render: () => (
    <Tooltip.Provider>
      <div style={{ display: "flex", gap: 4 }}>
        {[
          { label: "Add item", icon: <Plus data-icon="" /> },
          { label: "Settings", icon: <Gear data-icon="" /> },
          { label: "Delete", icon: <Trash data-icon="" /> },
        ].map((action) => (
          <Tooltip.Root key={action.label}>
            <Tooltip.Trigger
              render={
                <Button size="icon-sm" variant="secondary" mode="ghost" aria-label={action.label}>
                  {action.icon}
                </Button>
              }
            />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>{action.label}</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </div>
    </Tooltip.Provider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(popup()).toHaveTextContent("Delete"));
  },
};

/**
 * ANTI-PATTERN — a tooltip carrying the only copy of something the reader needs. It never
 * appears on touch, so this content simply does not exist on a phone. Kept out of the
 * manifest.
 */
export const EssentialContentAntiPattern: Story = {
  tags: ["!manifest", "!test"],
  render: (args) => (
    <Tooltip.Root {...args}>
      <Tooltip.Trigger render={<Button variant="secondary">Export</Button>} />
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>
            Exports are capped at 10,000 rows and expire after 24 hours.
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  ),
};

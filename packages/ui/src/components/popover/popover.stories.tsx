import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../button/button";
import { Input } from "../input/input";
import { Popover } from "./popover";

/**
 * Popover anchors a panel to the control that opened it, for content the reader may want
 * rather than must answer. It does not block the page the way Dialog does, so it suits
 * filters, a detail card or a short form. Unlike Tooltip it may hold interactive content,
 * and it opens on click, so it works on touch.
 *
 * Compose it: `Popover.Root` holds a `Popover.Trigger` and a `Popover.Portal` containing
 * `Popover.Positioner` > `Popover.Popup`, with optional `Popover.Title`,
 * `Popover.Description` and `Popover.Close`.
 *
 * The popup renders in a portal, outside the story canvas, so these stories query it
 * through `screen` rather than `within(canvasElement)`.
 */
const meta = {
  title: "Components/Popover",
  component: Popover.Root,
  tags: ["autodocs"],
} satisfies Meta<typeof Popover.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: a titled panel opened from a button. */
export const Default: Story = {
  render: (args) => (
    <Popover.Root {...args}>
      <Popover.Trigger render={<Button variant="secondary">Filters</Button>} />
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup>
            <Popover.Title>Filter invoices</Popover.Title>
            <Popover.Description>Only unpaid invoices from this quarter.</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Filters" });

    await step("it starts closed", async () => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    await step("clicking the trigger opens it", async () => {
      await userEvent.click(trigger);
      await waitFor(() => expect(screen.getByRole("dialog")).toBeVisible());
    });

    await step("the title names the panel", async () => {
      expect(screen.getByRole("dialog")).toHaveAccessibleName("Filter invoices");
    });

    await step("tokens resolved — the popup fill is a real value", async () => {
      expect(getComputedStyle(screen.getByRole("dialog")).backgroundColor).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
    });

    await step("Escape closes it and returns focus to the trigger", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(trigger, "focus should come back to where it left").toHaveFocus();
    });
  },
};

/**
 * Interactive content is the whole point of choosing Popover over Tooltip. Keep it short:
 * anything long enough to scroll, or important enough to demand an answer, is a Dialog.
 */
export const WithAForm: Story = {
  render: (args) => (
    <Popover.Root {...args}>
      <Popover.Trigger render={<Button variant="secondary">Rename</Button>} />
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup>
            <Popover.Title>Rename project</Popover.Title>
            <Input aria-label="Project name" defaultValue="Fabre design system" />
            <Popover.Close render={<Button size="sm">Save</Button>} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeVisible());

    const field = screen.getByRole("textbox", { name: "Project name" });
    await userEvent.clear(field);
    await userEvent.type(field, "Fabre DS");
    expect(field).toHaveValue("Fabre DS");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

/**
 * Clicking outside dismisses it. That is the difference from a modal: the reader can walk
 * away without answering, which is why nothing needing an answer belongs here.
 */
export const DismissedByClickingOutside: Story = {
  render: (args) => (
    <Popover.Root {...args}>
      <Popover.Trigger render={<Button variant="secondary">Details</Button>} />
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup>
            <Popover.Title>Invoice INV-1043</Popover.Title>
            <Popover.Description>Paid on 14 November by card.</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Details" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeVisible());

    await userEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

/** Open from the start — for a first-run hint pinned to the control it explains. */
export const OpenByDefault: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Popover.Root {...args}>
      <Popover.Trigger render={<Button variant="secondary">Share</Button>} />
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup>
            <Popover.Title>New: shareable links</Popover.Title>
            <Popover.Description>Anyone with the link can view this project.</Popover.Description>
            <Popover.Close render={<Button size="sm">Got it</Button>} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  ),
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeVisible());
    expect(screen.getByRole("dialog")).toHaveAccessibleName("New: shareable links");
  },
};

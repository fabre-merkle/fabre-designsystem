import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Button } from "../button/button";
import { Spinner } from "./spinner";

/**
 * Spinner says work is happening when the end is unknown. Use Progress when the share
 * done can be measured — a spinner that runs for a minute tells the reader nothing about
 * whether to wait.
 *
 * It carries `role="progressbar"` and names itself "Loading" by default, so it announces
 * itself without extra wiring. Override `label` when the wait has a subject worth naming.
 */
const meta = {
  title: "Components/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["xs", "sm", "md", "lg"] },
    tone: { control: "select", options: ["current", "brand"] },
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: inherits the text colour, and announces itself as "Loading". */
export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const spinner = canvas.getByRole("progressbar");

    await step("it names itself without being asked to", async () => {
      expect(spinner).toHaveAccessibleName("Loading");
    });

    await step("it reports an indeterminate state, not a value", async () => {
      expect(spinner).not.toHaveAttribute("aria-valuenow");
    });

    await step("tokens resolved — the arc stroke is a real value", async () => {
      const arc = canvasElement.querySelector('[data-ui="spinner-arc"]');
      expect(arc).not.toBeNull();
      if (arc) expect(getComputedStyle(arc).stroke).not.toBe("none");
    });
  },
};

/**
 * Name the wait when the page has more than one, or when the subject is not obvious from
 * where the spinner sits. "Loading" three times over tells a screen-reader user nothing.
 */
export const WithALabel: Story = {
  args: { label: "Loading invoices" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("progressbar")).toHaveAccessibleName("Loading invoices");
  },
};

/**
 * Inside a button, during a submit. `tone="current"` makes the arc inherit the button's
 * text colour, so it works on any variant without being told which.
 *
 * Keep the label text in place while it spins — swapping the text for a spinner alone
 * makes the button change width and loses what was being done.
 */
export const InAButton: Story = {
  render: () => (
    <Button disabled>
      <Spinner size="sm" data-icon="" />
      Saving…
    </Button>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /saving/i });
    expect(button).toBeDisabled();
    expect(within(button).getByRole("progressbar")).toBeVisible();
  },
};

/**
 * `brand` paints the arc in the theme-aware brand ink, for a spinner standing alone on a
 * surface rather than sitting inside a control.
 */
export const Brand: Story = {
  args: { tone: "brand" },
};

/** The four sizes, matched to the control icon scale. Reference only. */
export const Sizes: Story = {
  tags: ["!manifest"],
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <Spinner key={size} size={size} label={`Loading ${size}`} />
      ))}
    </div>
  ),
};

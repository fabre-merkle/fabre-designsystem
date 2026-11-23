import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Progress } from "./progress";

/**
 * Progress shows how far along a task is when the share done is known — an upload, an
 * import, a multi-step form. Use Spinner when the end is unknown, and Meter for a static
 * measurement such as disk usage, which is a level rather than progress.
 *
 * Compose it: `Progress.Root` takes the `value` and holds `Progress.Label`,
 * `Progress.Value`, and a `Progress.Track` wrapping `Progress.Indicator`.
 */
const meta = {
  title: "Components/Progress",
  component: Progress.Root,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
    value: { control: { type: "range", min: 0, max: 100 } },
  },
} satisfies Meta<typeof Progress.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default: a labelled bar with its percentage. The label names the task so the number
 * means something — "Uploading", not a bare bar.
 */
export const Default: Story = {
  args: { value: 60 },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Progress.Root {...args}>
        <Progress.Label>Uploading assets</Progress.Label>
        <Progress.Value />
        <Progress.Track>
          <Progress.Indicator />
        </Progress.Track>
      </Progress.Root>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const bar = canvas.getByRole("progressbar");

    await step("the value is exposed to assistive technology", async () => {
      expect(bar).toHaveAttribute("aria-valuenow", "60");
    });

    await step("it is named by its label, not left anonymous", async () => {
      expect(bar).toHaveAccessibleName("Uploading assets");
    });

    await step("tokens resolved — the track fill is a real value", async () => {
      const track = canvasElement.querySelector('[data-ui="progress-track"]');
      expect(track).not.toBeNull();
      if (track) expect(getComputedStyle(track).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    });
  },
};

/** Nothing has happened yet. The bar is present so the layout does not jump on the first byte. */
export const Empty: Story = {
  args: { value: 0 },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Progress.Root {...args}>
        <Progress.Label>Uploading assets</Progress.Label>
        <Progress.Value />
        <Progress.Track>
          <Progress.Indicator />
        </Progress.Track>
      </Progress.Root>
    </div>
  ),
};

/**
 * Finished. Leave the bar up briefly rather than removing it on the last byte — vanishing
 * at 99% reads as a failure.
 */
export const Complete: Story = {
  args: { value: 100 },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Progress.Root {...args}>
        <Progress.Label>Uploading assets</Progress.Label>
        <Progress.Value />
        <Progress.Track>
          <Progress.Indicator />
        </Progress.Track>
      </Progress.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  },
};

/**
 * `value={null}` is the indeterminate state: work is happening, but not how much is left.
 * Prefer a Spinner for short waits — an indeterminate bar implies a measurable task.
 */
export const Indeterminate: Story = {
  args: { value: null },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Progress.Root {...args}>
        <Progress.Label>Preparing export</Progress.Label>
        <Progress.Track>
          <Progress.Indicator />
        </Progress.Track>
      </Progress.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = canvas.getByRole("progressbar");
    expect(bar, "an indeterminate bar reports no current value").not.toHaveAttribute(
      "aria-valuenow",
    );
  },
};

/** The three track heights. Reference only. */
export const Sizes: Story = {
  tags: ["!manifest"],
  args: { value: 45 },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 280 }}>
      {(["sm", "md", "lg"] as const).map((size) => (
        <Progress.Root key={size} value={45} size={size}>
          <Progress.Label>{size}</Progress.Label>
          <Progress.Track>
            <Progress.Indicator />
          </Progress.Track>
        </Progress.Root>
      ))}
    </div>
  ),
};

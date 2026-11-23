import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Slider } from "./slider";

/**
 * Slider picks a number from a range by position, for when the approximate value is what
 * matters — volume, zoom, a price filter. Use NumberField when the exact figure matters,
 * or pair the two when both do: a slider alone cannot be typed into, and dragging to a
 * precise number is slow and fiddly.
 *
 * Compose it: `Slider.Root` holds an optional `Slider.Value` and a `Slider.Control`
 * containing `Slider.Track` > `Slider.Indicator` and one `Slider.Thumb` per value.
 */
const meta = {
  title: "Components/Slider",
  component: Slider.Root,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Slider.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

function VolumeSlider(args: React.ComponentProps<typeof Slider.Root>) {
  return (
    <div style={{ width: 280 }}>
      <Slider.Root {...args}>
        <Slider.Value />
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
            <Slider.Thumb aria-label="Volume" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}

/** The default: a single value, shown above the track. */
export const Default: Story = {
  args: { defaultValue: 40 },
  render: (args) => <VolumeSlider {...args} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const thumb = canvas.getByRole("slider");

    await step("the value is exposed to assistive technology", async () => {
      expect(thumb).toHaveAttribute("aria-valuenow", "40");
    });

    await step("the thumb is named by its own aria-label", async () => {
      // `role="slider"` is the native range input inside Slider.Thumb; a name on the root
      // never reaches it, which is why every thumb is labelled individually.
      expect(thumb).toHaveAccessibleName("Volume");
    });

    await step("tokens resolved — the track fill is a real value", async () => {
      const track = canvasElement.querySelector('[data-ui="slider-track"]');
      if (track) expect(getComputedStyle(track).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    });

    await step("arrow keys change the value — the keyboard path to every number", async () => {
      thumb.focus();
      await userEvent.keyboard("{ArrowRight}");
      expect(thumb).toHaveAttribute("aria-valuenow", "41");
    });
  },
};

/**
 * `step` coarsens the range so every reachable value is a sensible one. A 0–100 slider
 * stepping by 1 offers a precision the control cannot actually deliver by drag.
 */
export const Stepped: Story = {
  args: { defaultValue: 50, step: 10 },
  render: (args) => <VolumeSlider {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const thumb = canvas.getByRole("slider");
    thumb.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(thumb, "one arrow press should move a whole step").toHaveAttribute(
      "aria-valuenow",
      "60",
    );
  },
};

/**
 * A range, with a thumb at each end — a price or date filter. Pass an array of values and
 * one `Slider.Thumb` per entry; each thumb needs its own name so the two are tellable
 * apart when announced.
 */
export const Range: Story = {
  args: { defaultValue: [25, 75] },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Slider.Root aria-label="Price range" {...args}>
        <Slider.Value />
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
            <Slider.Thumb aria-label="Minimum price" />
            <Slider.Thumb aria-label="Maximum price" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const thumbs = canvas.getAllByRole("slider");
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]).toHaveAccessibleName("Minimum price");
    expect(thumbs[1]).toHaveAccessibleName("Maximum price");
  },
};

/**
 * A range other than 0–100. `min` and `max` are announced alongside the value, so the
 * number means something without a visible scale.
 */
export const CustomRange: Story = {
  args: { defaultValue: 18, min: 0, max: 24, step: 1 },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Slider.Root {...args}>
        <Slider.Value />
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
            <Slider.Thumb aria-label="Hour" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const thumb = canvas.getByRole("slider");
    // A native range input reports its bounds through min/max, not the aria-* mirrors.
    expect(thumb).toHaveAttribute("min", "0");
    expect(thumb).toHaveAttribute("max", "24");
  },
};

/** Not editable, and skipped by the keyboard. */
export const Disabled: Story = {
  args: { defaultValue: 40, disabled: true },
  render: (args) => <VolumeSlider {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The input is natively disabled here — unlike Checkbox, Switch and Select, which
    // only mark the state with an attribute.
    expect(canvas.getByRole("slider")).toBeDisabled();
  },
};

/** The three scales. Reference only. */
export const Sizes: Story = {
  tags: ["!manifest"],
  args: { defaultValue: 40 },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: 280 }}>
      {(["sm", "md", "lg"] as const).map((size) => (
        <Slider.Root key={size} defaultValue={40} size={size}>
          <Slider.Control>
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb aria-label={size} />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ))}
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Switch } from "./switch";

/**
 * Switch is for a setting that takes effect the moment it moves — no Save button follows
 * it. That immediacy is the whole distinction: a value submitted with a form is a
 * Checkbox, and one choice among several is a ToggleGroup.
 *
 * It renders the track and thumb alone and takes no children, so every usage needs an
 * accessible name. Label it with the setting ("Two-factor authentication"), not with the
 * state ("On") — the control already announces its own state.
 */
const meta = {
  title: "Components/Switch",
  component: Switch,
  tags: ["autodocs"],
  args: { "aria-label": "Two-factor authentication" },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: off, and flipped by click or by Space. */
export const Off: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole("switch", { name: "Two-factor authentication" });

    await step("it uses the switch role, not checkbox", async () => {
      expect(control).toHaveAttribute("aria-checked", "false");
    });

    await step("tokens resolved — the track fill is a real value", async () => {
      expect(getComputedStyle(control).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    });

    await step("clicking turns it on", async () => {
      await userEvent.click(control);
      expect(control).toBeChecked();
    });

    await step("Space turns it back off", async () => {
      await userEvent.keyboard(" ");
      expect(control).not.toBeChecked();
    });
  },
};

/** Already on — the setting is active and can be turned off. */
export const On: Story = {
  args: { defaultChecked: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("switch", { name: "Two-factor authentication" })).toBeChecked();
  },
};

/**
 * The shape to reach for in a settings list: the setting's name labels the control, and a
 * line of description sits under it. The switch stays on the right, where the eye finds
 * the column of states.
 */
export const InASettingsRow: Story = {
  args: { "aria-label": undefined },
  render: () => (
    // biome-ignore lint/a11y/noLabelWithoutControl: Switch renders the input inside this label; the rule only sees intrinsic elements, and the play function proves the association by flipping the switch from the setting's name.
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        width: 360,
        cursor: "pointer",
      }}
    >
      <span>
        <span style={{ display: "block" }}>Two-factor authentication</span>
        <span style={{ display: "block", fontSize: 13, opacity: 0.7 }}>
          Require a code from your phone at sign-in.
        </span>
      </span>
      <Switch />
    </label>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole("switch", { name: /two-factor authentication/i });
    await userEvent.click(canvas.getByText("Two-factor authentication"));
    expect(control, "clicking the setting's name should flip the switch").toBeChecked();
  },
};

/**
 * Not editable, and skipped by the keyboard. Say elsewhere why it cannot be changed — the
 * control itself gives no reason.
 */
export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole("switch", { name: "Two-factor authentication" });
    // A `span` with `role="switch"`, not an `<input disabled>`: it reports being
    // unavailable through `aria-disabled`, which is what jest-dom's `toBeDisabled()` misses.
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control, "a disabled control is out of the tab order").toHaveAttribute("tabindex", "-1");
  },
};

/**
 * ANTI-PATTERN — labelled with its state instead of its setting. The control already
 * announces "on"/"off", so this reads as "On, on". Kept out of the manifest.
 */
export const LabelledByStateAntiPattern: Story = {
  tags: ["!manifest", "!test"],
  args: { "aria-label": "On", defaultChecked: true },
};

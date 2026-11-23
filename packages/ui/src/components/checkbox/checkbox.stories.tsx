import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Checkbox } from "./checkbox";

/**
 * Checkbox is for choices that are independent of each other — any number may be on at
 * once, and the value is read when the form is submitted. Use Switch when the change takes
 * effect immediately, and RadioGroup when exactly one option may be chosen.
 *
 * It renders the box alone and takes no children, so every usage needs an accessible name
 * from a wrapping `<label>`, `aria-label`, or a FieldLabel via CheckboxGroup.
 */
const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: { "aria-label": "Email notifications" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: unchecked, and toggled by click or by Space. */
export const Unchecked: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox", { name: "Email notifications" });

    await step("it starts unchecked", async () => {
      expect(checkbox).not.toBeChecked();
    });

    await step("tokens resolved — the border is a real value", async () => {
      expect(getComputedStyle(checkbox).borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    });

    await step("clicking checks it", async () => {
      await userEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    await step("Space toggles it back", async () => {
      await userEvent.keyboard(" ");
      expect(checkbox).not.toBeChecked();
    });
  },
};

/** Already on when the form opens — a default the user can turn off. */
export const Checked: Story = {
  args: { defaultChecked: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("checkbox", { name: "Email notifications" })).toBeChecked();
  },
};

/**
 * The mixed state of a parent whose children are only partly checked. It is a summary, not
 * a third user-settable value: clicking resolves it to checked or unchecked.
 */
export const Indeterminate: Story = {
  args: { indeterminate: true, "aria-label": "Select all" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox", { name: "Select all" });
    expect(checkbox).toHaveAttribute("aria-checked", "mixed");
  },
};

/**
 * A label wrapping the control gives it its name AND widens the hit target to the text —
 * the shape to reach for whenever a checkbox has visible text beside it.
 */
export const WithLabel: Story = {
  args: { "aria-label": undefined },
  render: () => (
    // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders the input inside this label; the rule only sees intrinsic elements, and the play function proves the association by toggling the box from the label text.
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <Checkbox />
      Send me product updates
    </label>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox", { name: "Send me product updates" });

    await userEvent.click(canvas.getByText("Send me product updates"));
    expect(checkbox, "clicking the label text should toggle the box").toBeChecked();
  },
};

/**
 * Not editable, and skipped by the keyboard. The state still reads as checked or not.
 *
 * The control is a `span` with `role="checkbox"`, not an `<input disabled>`, so it reports
 * being unavailable through `aria-disabled` and `tabindex="-1"` — assert those, not
 * jest-dom's `toBeDisabled()`, which only looks at real form elements.
 */
export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox", { name: "Email notifications" });
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(checkbox, "a disabled control is out of the tab order").toHaveAttribute(
      "tabindex",
      "-1",
    );
  },
};

/**
 * ANTI-PATTERN — no label and no `aria-label`. The box is announced only as "checkbox",
 * with nothing to say what it controls. Kept out of the manifest.
 */
export const UnnamedAntiPattern: Story = {
  tags: ["!manifest", "!test"],
  args: { "aria-label": undefined },
};

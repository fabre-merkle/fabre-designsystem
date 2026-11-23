import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Input } from "../input/input";
import { Field } from "./index";

/**
 * Field is the anatomy around a form control — its label, description and error. Input,
 * Select and the rest render the control alone, so Field is what makes one usable: it
 * wires the label to the control and the error into `aria-describedby` without ids being
 * passed around by hand.
 *
 * Compose it: `Field.Root` holds a `Field.Label`, a `Field.Control`, an optional
 * `Field.Description`, and a `Field.Error` that appears only when validation fails.
 */
const meta = {
  title: "Components/Field",
  component: Field.Root,
  tags: ["autodocs"],
} satisfies Meta<typeof Field.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default: a labelled control. No `htmlFor`, no `id` — Field generates and connects
 * them, which is the main reason to reach for it over a hand-rolled label.
 */
export const Default: Story = {
  render: (args) => (
    <Field.Root {...args} style={{ width: 280 }}>
      <Field.Label>Email address</Field.Label>
      <Field.Control render={<Input />} placeholder="you@example.com" />
    </Field.Root>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole("textbox", { name: "Email address" });

    await step("the label names the control without an explicit htmlFor", async () => {
      expect(control).toHaveAccessibleName("Email address");
    });

    await step("clicking the label focuses the control", async () => {
      await userEvent.click(canvas.getByText("Email address"));
      expect(control).toHaveFocus();
    });

    await step("tokens resolved — the label colour is a real value", async () => {
      expect(getComputedStyle(canvas.getByText("Email address")).color).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
    });
  },
};

/**
 * A description explains the rule BEFORE the user breaks it. It is wired into the
 * control's accessible description, so a screen reader reads it along with the label
 * rather than leaving it as unattached text nearby.
 */
export const WithADescription: Story = {
  render: (args) => (
    <Field.Root {...args} style={{ width: 280 }}>
      <Field.Label>Workspace name</Field.Label>
      <Field.Control render={<Input />} defaultValue="fabre-design-system" />
      <Field.Description>Lowercase letters, numbers and hyphens only.</Field.Description>
    </Field.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("textbox", { name: "Workspace name" })).toHaveAccessibleDescription(
      "Lowercase letters, numbers and hyphens only.",
    );
  },
};

/**
 * `Field.Error` renders only once the field is invalid, so a form does not open shouting
 * at someone who has not typed anything yet.
 *
 * When that happens is set by `validationMode`, which defaults to `"onSubmit"`: native
 * constraints like `required` are not checked until the form is sent. This story takes
 * the other route — `invalid` on the root, for when an external validator owns the state
 * — which is also what makes the error inspectable without a form around it.
 *
 * `match` is what ties the two together, and the step that is easy to miss: `invalid`
 * alone sets `data-invalid` and `aria-invalid` but leaves `Field.Error` hidden, because
 * the error's visibility is driven by the control's native `ValidityState`. Pass `match`
 * (a `ValidityState` key, or `true` to always show, as here) and an external validator can
 * own the message as well as the state.
 */
export const WithAnError: Story = {
  args: { invalid: true },
  render: (args) => (
    <Field.Root {...args} style={{ width: 280 }}>
      <Field.Label>Email address</Field.Label>
      <Field.Control render={<Input />} defaultValue="not-an-email" />
      <Field.Error match>Enter a complete email address.</Field.Error>
    </Field.Root>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole("textbox", { name: "Email address" });

    await step("the message is shown", async () => {
      expect(canvas.getByText("Enter a complete email address.")).toBeVisible();
    });

    await step("the error is part of the control's description, not loose text", async () => {
      expect(control).toHaveAccessibleDescription(/enter a complete email address/i);
    });

    await step("the invalid state reaches the parts for styling", async () => {
      expect(canvasElement.querySelector('[data-ui="field"]')).toHaveAttribute("data-invalid");
    });
  },
};

/**
 * Both at once. The description stays put and the error joins it, so the rule remains
 * readable while the user fixes the problem — removing the rule at the moment it is
 * needed is a common and unhelpful pattern.
 */
export const DescriptionAndError: Story = {
  args: { invalid: true },
  render: (args) => (
    <Field.Root {...args} style={{ width: 280 }}>
      <Field.Label>Workspace name</Field.Label>
      <Field.Control render={<Input />} defaultValue="Fabre DS" />
      <Field.Description>Lowercase letters, numbers and hyphens only.</Field.Description>
      <Field.Error match>Spaces and capitals are not allowed.</Field.Error>
    </Field.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Lowercase letters, numbers and hyphens only.")).toBeVisible();
    expect(canvas.getByText("Spaces and capitals are not allowed.")).toBeVisible();
  },
};

/** The whole field is unavailable — label, control and description read as disabled. */
export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <Field.Root {...args} style={{ width: 280 }}>
      <Field.Label>Email address</Field.Label>
      <Field.Control render={<Input />} defaultValue="ada@example.com" />
      <Field.Description>Managed by your identity provider.</Field.Description>
    </Field.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("textbox", { name: "Email address" })).toBeDisabled();
  },
};

/**
 * ANTI-PATTERN — the error text sitting outside the Field. It looks identical and is
 * announced by nothing: the control has no `aria-describedby` pointing at it, so a screen
 * reader user hears a field that simply refuses to submit. Kept out of the manifest.
 */
export const ErrorOutsideTheFieldAntiPattern: Story = {
  tags: ["!manifest", "!test"],
  render: (args) => (
    <div style={{ width: 280 }}>
      <Field.Root {...args} invalid>
        <Field.Label>Email address</Field.Label>
        <Field.Control render={<Input />} defaultValue="not-an-email" />
      </Field.Root>
      <p style={{ color: "crimson", margin: "4px 0 0" }}>Enter a complete email address.</p>
    </div>
  ),
};

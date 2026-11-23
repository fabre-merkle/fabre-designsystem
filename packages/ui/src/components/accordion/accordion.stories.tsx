import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Accordion } from "./accordion";

/**
 * Accordion collapses long content into labelled sections the reader opens as needed. It
 * earns its place only when most readers want one section out of several: hiding content
 * costs a click and keeps it out of the browser's in-page search, so an accordion of
 * things everyone reads is a tax rather than a tidy-up.
 *
 * Compose it: `Accordion.Root` holds `Accordion.Item`s, each with an `Accordion.Header`
 * wrapping an `Accordion.Trigger`, and an `Accordion.Panel`.
 */
const meta = {
  title: "Components/Accordion",
  component: Accordion.Root,
  tags: ["autodocs"],
} satisfies Meta<typeof Accordion.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

const SECTIONS = [
  {
    value: "shipping",
    label: "Shipping",
    body: "Ships within 2 business days via standard courier.",
  },
  { value: "returns", label: "Returns", body: "Free returns for 30 days, in any condition." },
  { value: "warranty", label: "Warranty", body: "Two years against manufacturing defects." },
];

function Sections(args: React.ComponentProps<typeof Accordion.Root>) {
  return (
    <Accordion.Root {...args} style={{ width: 360 }}>
      {SECTIONS.map((section) => (
        <Accordion.Item key={section.value} value={section.value}>
          <Accordion.Header>
            <Accordion.Trigger>{section.label}</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{section.body}</Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

/** The default: everything closed, and each section opens on click. */
export const Default: Story = {
  render: (args) => <Sections {...args} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Shipping" });

    await step("every section starts closed", async () => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    await step("tokens resolved — the trigger label has a real colour", async () => {
      expect(getComputedStyle(trigger).color).not.toBe("rgba(0, 0, 0, 0)");
    });

    await step("clicking opens the section and reveals its panel", async () => {
      await userEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(canvas.getByText(SECTIONS[0].body)).toBeVisible();
    });

    await step("clicking the same trigger closes it again", async () => {
      await userEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  },
};

/**
 * Open from the start. Use it for the section most readers came for — leaving everything
 * shut makes the page a row of closed doors.
 */
export const OpenByDefault: Story = {
  args: { defaultValue: ["returns"] },
  render: (args) => <Sections {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "Returns" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  },
};

/**
 * `multiple={false}` makes it an either/or: opening one section closes the last. Good
 * when the sections are alternatives, confusing when a reader may want to compare two.
 */
export const OneAtATime: Story = {
  args: { multiple: false, defaultValue: ["shipping"] },
  render: (args) => <Sections {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Returns" }));

    expect(canvas.getByRole("button", { name: "Returns" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      canvas.getByRole("button", { name: "Shipping" }),
      "opening one section should have closed the other",
    ).toHaveAttribute("aria-expanded", "false");
  },
};

/**
 * Several sections open at once — the default. It suits reference content, where a reader
 * may want two answers side by side.
 */
export const SeveralOpen: Story = {
  args: { defaultValue: ["shipping", "warranty"] },
  render: (args) => <Sections {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "Shipping" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(canvas.getByRole("button", { name: "Warranty" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  },
};

/**
 * A section that cannot be opened yet. It stays visible so the shape of the whole set is
 * still readable.
 */
export const WithADisabledSection: Story = {
  render: (args) => (
    <Accordion.Root {...args} style={{ width: 360 }}>
      <Accordion.Item value="shipping">
        <Accordion.Header>
          <Accordion.Trigger>Shipping</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>{SECTIONS[0].body}</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="warranty" disabled>
        <Accordion.Header>
          <Accordion.Trigger>Warranty</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>{SECTIONS[2].body}</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const disabled = canvas.getByRole("button", { name: "Warranty" });
    // Not clicked: a disabled trigger carries `pointer-events: none`, so the click would
    // throw in the runner rather than being ignored as it is for a real user.
    expect(disabled).toHaveAttribute("aria-expanded", "false");
    expect(disabled).toBeDisabled();
  },
};

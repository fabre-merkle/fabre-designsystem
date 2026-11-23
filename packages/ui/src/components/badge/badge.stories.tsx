import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Badge } from "./badge";

/**
 * Badge labels the thing beside it — a count, a state, a category. It is not a control: it
 * takes no click handler and no focus, so anything the user can act on belongs in a Button
 * instead.
 *
 * `tone` carries the meaning and `mode` the weight. A badge's colour is not an accessible
 * name, so the text must say what the state is; "Critical" in red, never red alone.
 */
const meta = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: { children: "Active" },
  argTypes: {
    tone: { control: "select", options: ["neutral", "info", "success", "warning", "critical"] },
    mode: { control: "select", options: ["filled", "light", "stroke"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: a plain label with no urgency attached. */
export const Neutral: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const badge = canvas.getByText("Active");

    await step("it carries its semantic data attributes", async () => {
      expect(badge).toHaveAttribute("data-tone", "neutral");
      expect(badge).toHaveAttribute("data-mode", "filled");
    });

    await step("tokens resolved — the fill is a real value", async () => {
      expect(getComputedStyle(badge).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    });

    await step("it is not interactive", async () => {
      expect(canvas.queryByRole("button")).toBeNull();
      expect(badge).not.toHaveAttribute("tabindex");
    });
  },
};

/** A state that has gone right — paid, published, verified. */
export const Success: Story = {
  args: { tone: "success", children: "Paid" },
};

/** A state that needs attention but has not failed — expiring, nearly full. */
export const Warning: Story = {
  args: { tone: "warning", children: "Expiring soon" },
};

/**
 * A state that has failed or blocks progress. `critical` maps to the error token family,
 * so it matches an Alert of intent `error` on the same screen.
 */
export const Critical: Story = {
  args: { tone: "critical", children: "Payment failed" },
};

/**
 * `light` tints the container instead of filling it — for a table or list where a row of
 * filled badges would out-shout the data they annotate.
 */
export const LightInATable: Story = {
  args: { children: undefined },
  render: () => (
    <table style={{ borderCollapse: "collapse", fontFamily: "inherit" }}>
      <tbody>
        {[
          { invoice: "INV-1043", tone: "success", label: "Paid" },
          { invoice: "INV-1044", tone: "warning", label: "Due today" },
          { invoice: "INV-1045", tone: "critical", label: "Overdue" },
        ].map((row) => (
          <tr key={row.invoice}>
            <td style={{ padding: "6px 16px 6px 0" }}>{row.invoice}</td>
            <td style={{ padding: "6px 0" }}>
              <Badge tone={row.tone as "success" | "warning" | "critical"} mode="light" size="sm">
                {row.label}
              </Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

/** Every tone at one mode, for comparing the colour steps. Reference only. */
export const Tones: Story = {
  tags: ["!manifest"],
  args: { children: undefined },
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Badge tone="neutral">Neutral</Badge>
      <Badge tone="info">Info</Badge>
      <Badge tone="success">Success</Badge>
      <Badge tone="warning">Warning</Badge>
      <Badge tone="critical">Critical</Badge>
    </div>
  ),
};

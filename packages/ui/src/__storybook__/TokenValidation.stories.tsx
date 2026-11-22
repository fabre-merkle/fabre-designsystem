import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

/**
 * Token-load validation — proves the ThemeProvider/token chain actually loaded.
 *
 * This story renders swatches bound to semantic token custom properties and asserts (in
 * its play function) that those properties resolve to real values, not the inline
 * fallbacks. If the token cascade fails to import or the `data-*` scoping is wrong, this
 * story fails — a fast canary that the workshop is wired to the tokens correctly.
 *
 * It is intentionally component-free so it works in any scaffold, whatever `@workspace/ui`
 * components were installed. It is excluded from the component manifest; real component
 * stories live beside their components and are authored by `@focus/skill-storybook-author`.
 */

const SWATCHES = [
  { label: "Body", varName: "--color-surface-body" },
  { label: "Surface", varName: "--color-surface-level-5" },
  { label: "Primary", varName: "--color-primary-brand" },
  { label: "On surface", varName: "--color-on-surface" },
  { label: "Border", varName: "--color-surface-border-2" },
] as const;

/** Renders a swatch per semantic token so the play function can assert each resolved. */
function TokenSwatches() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }} data-testid="token-swatches">
      {SWATCHES.map((s) => (
        <figure key={s.varName} style={{ margin: 0, textAlign: "center" }}>
          <div
            data-var={s.varName}
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              // Fallback "transparent" lets the play function detect an unresolved token.
              background: `var(${s.varName}, transparent)`,
              border: "1px solid var(--border-subtle, #ccc)",
            }}
          />
          <figcaption style={{ fontSize: 12, marginTop: 6 }}>
            {s.label}
            <br />
            <code style={{ fontSize: 10, opacity: 0.7 }}>{s.varName}</code>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

const meta: Meta<typeof TokenSwatches> = {
  title: "Foundations/Token validation",
  component: TokenSwatches,
  tags: ["!manifest"],
};

export default meta;

type Story = StoryObj<typeof TokenSwatches>;

/** Every semantic token swatch must resolve to a real, non-transparent value. */
export const Resolved: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByTestId("token-swatches");
    for (const swatch of SWATCHES) {
      const el = root.querySelector<HTMLElement>(`[data-var="${swatch.varName}"]`);
      expect(el, `swatch for ${swatch.varName} should render`).not.toBeNull();
      if (!el) continue;
      const bg = getComputedStyle(el).backgroundColor;
      // An unresolved var() collapses to the `transparent` fallback.
      expect(bg, `${swatch.varName} should resolve to a real token value`).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
      expect(bg).not.toBe("transparent");
    }
  },
};

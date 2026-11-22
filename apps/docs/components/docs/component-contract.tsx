import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import type { ReactNode } from "react";
import { componentContractView, type ReferenceTable } from "../../lib/component-contract";

/**
 * A component's compiled Figma contract, read from the project's own compiled artifact (see
 * `lib/component-contract.ts`). The page shows the parts, axes and slots in a "Figma contract"
 * group that is closed until opened. The documented examples and the notes on how React maps to
 * Figma are in the Markdown form only (`lib/component-contract-markdown.tsx`), as context for agents.
 */

/** Inline Markdown cells: backticks become `<code>`. */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("`") ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static text split, order never changes
          <code key={index}>{part.slice(1, -1)}</code>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function ReferenceTableView({ table }: { table: ReferenceTable }) {
  return (
    <table data-docs-table="">
      <thead>
        <tr>
          {table.columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, rowIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional; first cells can repeat
          <tr key={`${rowIndex}-${row[0]}`}>
            {row.map((cell, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
              <td key={index}>
                <Inline text={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/**
 * What the compiler resolved for one component. `heading` says the page has no "## Figma contract"
 * heading of its own (the Markdown form then writes one).
 */
export async function ComponentContract({ slug }: { slug: string; heading?: boolean }) {
  const view = await componentContractView(slug);
  if (!view) return null;
  return (
    <Accordions data-docs-accordion="">
      <Accordion title="Figma contract">
        <p>
          The compiled Figma contract for {view.name}: the parts, axes and slots the compiler
          resolved from the contract and the component source.
        </p>
        {view.tables.map((entry) => (
          <Section key={entry.title} title={entry.title}>
            <ReferenceTableView table={entry.table} />
          </Section>
        ))}
      </Accordion>
    </Accordions>
  );
}

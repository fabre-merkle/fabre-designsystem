import { AutoTypeTable as FumadocsAutoTypeTable } from "fumadocs-typescript/ui";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { groupGenerator, isBaseUIEntry, typeTableGenerator } from "../../lib/type-table-generator";

type AutoTypeTableProps = Omit<React.ComponentProps<typeof FumadocsAutoTypeTable>, "generator">;

/**
 * `<AutoTypeTable path="badge/badge.tsx" name="BadgeProps" />` on a component page: the props
 * table read from the component source, so the JSDoc and `@default` tags are the documentation.
 *
 * The component's own props and the Base UI props that set its behaviour come first. The generic
 * Base UI props (`className`, `render`, `style`, ...) follow in an Accordion that is closed by
 * default. The split lives in `lib/type-table-generator.ts`; the Markdown form applies the same one.
 */
export async function AutoTypeTable(props: AutoTypeTableProps) {
  const docs = await typeTableGenerator.generateTypeTable(
    { name: props.name, path: props.path, type: props.type },
    props.options,
  );
  const hasBaseUI = docs.some((doc) => doc.entries.some(isBaseUIEntry));
  return (
    <>
      <FumadocsAutoTypeTable {...props} generator={groupGenerator("main")} />
      {hasBaseUI ? (
        <Accordions data-docs-accordion="">
          <Accordion title="Base UI props">
            <FumadocsAutoTypeTable {...props} generator={groupGenerator("baseUI")} />
          </Accordion>
        </Accordions>
      ) : null}
    </>
  );
}

/**
 * Finds the `<AutoTypeTable ... />` tags in MDX text and reads their `path`, `name` and `type`
 * attributes. Values may be single- or double-quoted and may contain `>` (a `type` expression such
 * as `React.ComponentProps<typeof X.Image>`). The build-time snapshot script keys its tables from
 * this, so it must read exactly what the page passes to the component.
 */

export type AutoTypeTableProps = { path?: string; name?: string; type?: string };

const TAG = /<AutoTypeTable\b((?:[^>"']|"[^"]*"|'[^']*')*?)\/>/g;

function attribute(attributes: string, name: string): string | undefined {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)')`));
  return match?.[1] ?? match?.[2];
}

export function autoTypeTableTags(text: string): AutoTypeTableProps[] {
  return [...text.matchAll(TAG)].map((match) => ({
    path: attribute(match[1], "path"),
    name: attribute(match[1], "name"),
    type: attribute(match[1], "type"),
  }));
}

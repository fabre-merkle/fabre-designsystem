/** One preset of a docs story: a named set of props the panel starts from. */
export type DocsStoryPreset<Props> = {
  variant: string;
  description?: string;
  initial: Props;
};

/** What a docs story file exports besides `story`, for the Markdown form agents read. */
export type DocsStoryModule<Props> = {
  /** Heading shown on the panel and in the Markdown form. */
  title: string;
  presets: DocsStoryPreset<Props>[];
  /**
   * Arguments that shape the example and are not props of the component. The controls draw them in
   * a "Demo" group under the real props, and the Markdown form lists them apart.
   */
  demoArgs?: readonly string[];
  /** The JSX a reader would write for one preset. */
  snippet: (props: Props) => string;
};

/** A JSX expression written as is, for example `raw("<Info />")` becomes `icon={<Info />}`. */
export function raw(code: string): { readonly raw: string } {
  return { raw: code };
}

function isRaw(value: unknown): value is { raw: string } {
  return typeof value === "object" && value !== null && "raw" in value;
}

type SnippetOptions = {
  /** Text between the tags. Without it the element is self-closing. */
  children?: string;
  /** Return only the opening tag, for an element whose children the caller writes. */
  openOnly?: boolean;
  /** Props equal to their default are left out. */
  defaults?: Record<string, unknown>;
};

/**
 * JSX source for an element: strings as attributes, numbers and `raw()` in braces, `true` as a bare attribute.
 * Unset, `false` and default-valued props are omitted.
 */
export function jsxSnippet(
  tag: string,
  props: Record<string, unknown>,
  { children, defaults = {}, openOnly = false }: SnippetOptions = {},
): string {
  const attributes: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false || value === defaults[key]) continue;
    if (isRaw(value)) attributes.push(`${key}={${value.raw}}`);
    else if (value === true) attributes.push(key);
    else if (typeof value === "number") attributes.push(`${key}={${value}}`);
    else attributes.push(`${key}=${JSON.stringify(value)}`);
  }
  const open = [tag, ...attributes].join(" ");
  if (openOnly) return `<${open}>`;
  return children === undefined ? `<${open} />` : `<${open}>${children}</${tag}>`;
}

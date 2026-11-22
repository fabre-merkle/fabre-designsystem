import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { AutocompleteDemo, type AutocompleteDemoProps } from "./autocomplete-demo";

export const title = "Autocomplete";
// The controls are generated from `AutocompleteDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Autocomplete props: drawn in the "Demo" group. */
export const demoArgs = ["placeholder", "grouped", "showClear"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  disabled: false,
  autoHighlight: false,
  placeholder: "Search fruit...",
  grouped: false,
  showClear: false,
} satisfies AutocompleteDemoProps;

export const presets: DocsStoryPreset<AutocompleteDemoProps>[] = [
  {
    variant: "Default",
    description: "Suggestions filter as you type. The input keeps whatever text you enter.",
    initial: base,
  },
  {
    variant: "Auto highlight",
    description: "The first match is highlighted as you type, so Enter picks it.",
    initial: { ...base, autoHighlight: true },
  },
  {
    variant: "Grouped",
    description: "Autocomplete.Group and Autocomplete.GroupLabel cluster suggestions.",
    initial: { ...base, grouped: true, placeholder: "Pick a fruit..." },
  },
  {
    variant: "With clear",
    description: "Autocomplete.Clear empties the input while it has text.",
    initial: { ...base, showClear: true },
  },
  {
    variant: "Disabled",
    description: "The input does not take focus or open the suggestions.",
    initial: { ...base, disabled: true, placeholder: "Disabled" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: AutocompleteDemoProps): string {
  const { disabled, autoHighlight, placeholder = "Search fruit...", grouped, showClear } = props;
  const root = jsxSnippet(
    "Autocomplete.Root",
    { items: raw(grouped ? "groups" : "fruits"), disabled, autoHighlight },
    { openOnly: true },
  );
  const list = grouped
    ? [
        "      <Autocomplete.List>",
        "        {(group: FruitGroup, index: number) => (",
        "          <Fragment key={group.value}>",
        "            {index > 0 ? <Autocomplete.Separator /> : null}",
        "            <Autocomplete.Group items={group.items}>",
        "              <Autocomplete.GroupLabel>{group.value}</Autocomplete.GroupLabel>",
        "              <Autocomplete.Collection>",
        "                {(item: string) => (",
        "                  <Autocomplete.Item key={item} value={item}>",
        "                    {item}",
        "                  </Autocomplete.Item>",
        "                )}",
        "              </Autocomplete.Collection>",
        "            </Autocomplete.Group>",
        "          </Fragment>",
        "        )}",
        "      </Autocomplete.List>",
        "      <Autocomplete.Empty>No matches.</Autocomplete.Empty>",
      ]
    : [
        "      <Autocomplete.List>",
        "        {(item: string) => (",
        "          <Autocomplete.Item key={item} value={item}>",
        "            {item}",
        "          </Autocomplete.Item>",
        "        )}",
        "      </Autocomplete.List>",
        "      <Autocomplete.Empty>No matches.</Autocomplete.Empty>",
      ];
  return [
    root,
    "  <Autocomplete.InputGroup>",
    `    <Autocomplete.Input placeholder="${placeholder}" />`,
    ...(showClear ? ["    <Autocomplete.Clear>Clear</Autocomplete.Clear>"] : []),
    "  </Autocomplete.InputGroup>",
    "  <Autocomplete.Portal>",
    "    <Autocomplete.Positioner sideOffset={8}>",
    "      <Autocomplete.Popup>",
    ...list.map((line) => `  ${line}`),
    "      </Autocomplete.Popup>",
    "    </Autocomplete.Positioner>",
    "  </Autocomplete.Portal>",
    "</Autocomplete.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Autocomplete",
  Component: AutocompleteDemo,
  args: presets,
});

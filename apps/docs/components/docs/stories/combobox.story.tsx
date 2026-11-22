import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { ComboboxDemo, type ComboboxDemoProps } from "./combobox-demo";

export const title = "Combobox";
// The controls are generated from `ComboboxDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Combobox props: drawn in the "Demo" group. */
export const demoArgs = ["placeholder", "showClear"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  multiple: false,
  disabled: false,
  placeholder: "Search a team",
  showClear: false,
} satisfies ComboboxDemoProps;

export const presets: DocsStoryPreset<ComboboxDemoProps>[] = [
  {
    variant: "Single",
    description: "Type to filter the list, then pick one value.",
    initial: base,
  },
  {
    variant: "Multiple",
    description: "With multiple, the selection shows as removable chips inside the input group.",
    initial: { ...base, multiple: true, placeholder: "Add a team" },
  },
  {
    variant: "With clear",
    description: "Combobox.Clear resets the value while one is set.",
    initial: { ...base, showClear: true },
  },
  {
    variant: "Disabled",
    description: "The input does not take focus or open the list.",
    initial: { ...base, disabled: true, placeholder: "Disabled" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: ComboboxDemoProps): string {
  const { multiple, disabled, placeholder = "Search a team", showClear } = props;
  const root = jsxSnippet(
    "Combobox.Root",
    { items: raw("teams"), multiple, disabled },
    { openOnly: true },
  );
  const input = `<Combobox.Input placeholder="${placeholder}" />`;
  const group = multiple
    ? [
        "    <Combobox.Chips>",
        "      <Combobox.Value>",
        "        {(value: string[]) =>",
        "          value.map((team) => (",
        "            <Combobox.Chip key={team}>",
        "              {team}",
        "              <Combobox.ChipRemove />",
        "            </Combobox.Chip>",
        "          ))",
        "        }",
        "      </Combobox.Value>",
        `      ${input}`,
        "    </Combobox.Chips>",
      ]
    : [`    ${input}`];
  return [
    root,
    "  <Combobox.InputGroup>",
    ...group,
    ...(showClear ? ["    <Combobox.Clear>×</Combobox.Clear>"] : []),
    "    <Combobox.Trigger>",
    "      <Combobox.Icon />",
    "    </Combobox.Trigger>",
    "  </Combobox.InputGroup>",
    "  <Combobox.Portal>",
    "    <Combobox.Positioner>",
    "      <Combobox.Popup>",
    "        <Combobox.Empty>No team found.</Combobox.Empty>",
    "        <Combobox.List>",
    "          {(team: string) => (",
    "            <Combobox.Item key={team} value={team}>",
    "              {team}",
    "              <Combobox.ItemIndicator />",
    "            </Combobox.Item>",
    "          )}",
    "        </Combobox.List>",
    "      </Combobox.Popup>",
    "    </Combobox.Positioner>",
    "  </Combobox.Portal>",
    "</Combobox.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Combobox",
  Component: ComboboxDemo,
  args: presets,
});

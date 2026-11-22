"use client";

/**
 * Live demos for the Autocomplete docs page.
 *
 * Why this file exists: the inline showcase JSX uses Base UI's render-prop
 * children pattern — `<List>{(item) => <Item>{item}</Item>}</List>` — which is
 * idiomatic Base UI but cannot be authored directly inside MDX. MDX bodies are
 * rendered as Server Components by Fumadocs; the function child fails to
 * serialize across the server→client boundary and the static prerender errors
 * with "Functions cannot be passed directly to Client Components". Hoisting
 * the JSX into a "use client" file keeps the render function entirely on the
 * client side, so the MDX page only ever sees a serializable client-component
 * reference.
 *
 * Apply this pattern to any docs page whose inline preview uses render-prop
 * children.
 */

import {
  AutocompleteClear,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteInputGroup,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
  AutocompletePortal,
  AutocompletePositioner,
  AutocompleteRoot,
  AutocompleteSeparator,
} from "../autocomplete-parts";

export function AutocompleteShowcase() {
  return (
    <AutocompleteRoot
      items={[
        "Apple",
        "Apricot",
        "Banana",
        "Blackberry",
        "Blueberry",
        "Cherry",
        "Date",
        "Fig",
        "Grape",
      ]}
    >
      <AutocompleteInputGroup>
        <AutocompleteInput placeholder="Search fruit..." />
        <AutocompleteClear>Clear</AutocompleteClear>
      </AutocompleteInputGroup>
      <AutocompletePortal>
        <AutocompletePositioner sideOffset={8}>
          <AutocompletePopup>
            <AutocompleteList>
              {(item) => (
                <AutocompleteItem key={item as string} value={item}>
                  {item as string}
                </AutocompleteItem>
              )}
            </AutocompleteList>
            <AutocompleteEmpty>No matches.</AutocompleteEmpty>
          </AutocompletePopup>
        </AutocompletePositioner>
      </AutocompletePortal>
    </AutocompleteRoot>
  );
}

export function AutocompleteGroupedDemo() {
  return (
    <AutocompleteRoot
      items={[
        { value: "react", label: "React", group: "Frontend" },
        { value: "vue", label: "Vue", group: "Frontend" },
        { value: "node", label: "Node.js", group: "Backend" },
        { value: "deno", label: "Deno", group: "Backend" },
      ]}
    >
      <AutocompleteInputGroup>
        <AutocompleteInput placeholder="Pick a runtime..." />
      </AutocompleteInputGroup>
      <AutocompletePortal>
        <AutocompletePositioner sideOffset={8}>
          <AutocompletePopup>
            <AutocompleteList>
              <AutocompleteGroup>
                <AutocompleteGroupLabel>Frontend</AutocompleteGroupLabel>
                <AutocompleteItem value="react">React</AutocompleteItem>
                <AutocompleteItem value="vue">Vue</AutocompleteItem>
              </AutocompleteGroup>
              <AutocompleteSeparator />
              <AutocompleteGroup>
                <AutocompleteGroupLabel>Backend</AutocompleteGroupLabel>
                <AutocompleteItem value="node">Node.js</AutocompleteItem>
                <AutocompleteItem value="deno">Deno</AutocompleteItem>
              </AutocompleteGroup>
            </AutocompleteList>
          </AutocompletePopup>
        </AutocompletePositioner>
      </AutocompletePortal>
    </AutocompleteRoot>
  );
}

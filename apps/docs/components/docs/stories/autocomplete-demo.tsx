"use client";
import { Fragment } from "react";
import {
  AutocompleteClear,
  AutocompleteCollection,
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

/** Props of the demo: the Autocomplete props it exposes, then the demo-only settings (see `demoArgs`). */
export type AutocompleteDemoProps = {
  /** Stop the input from taking focus or opening the suggestions. */
  disabled?: boolean;
  /** Highlight the first matching suggestion as you type, so Enter picks it. */
  autoHighlight?: boolean;
  /** The input placeholder. */
  placeholder?: string;
  /** Cluster the suggestions under group labels. */
  grouped?: boolean;
  /** Add a clear button that empties the input. */
  showClear?: boolean;
};

const FRUITS = [
  "Apple",
  "Apricot",
  "Banana",
  "Blackberry",
  "Blueberry",
  "Cherry",
  "Date",
  "Fig",
  "Grape",
];

type FruitGroup = { value: string; items: string[] };

const FRUIT_GROUPS: FruitGroup[] = [
  { value: "Stone fruit", items: ["Apricot", "Cherry"] },
  { value: "Berries", items: ["Blackberry", "Blueberry"] },
];

/**
 * An input that suggests values as you type, from a flat list or two groups. It is keyed by `grouped`
 * so switching the list never keeps a stale query, and its popup portals into the preview island.
 */
export function AutocompleteDemo({
  disabled = false,
  autoHighlight = false,
  placeholder = "Search fruit...",
  grouped = false,
  showClear = false,
}: AutocompleteDemoProps) {
  return (
    <div data-focus-island>
      <AutocompleteRoot
        key={grouped ? "grouped" : "flat"}
        items={grouped ? FRUIT_GROUPS : FRUITS}
        disabled={disabled}
        autoHighlight={autoHighlight}
      >
        <AutocompleteInputGroup>
          <AutocompleteInput aria-label="Search" placeholder={placeholder} />
          {showClear ? <AutocompleteClear>Clear</AutocompleteClear> : null}
        </AutocompleteInputGroup>
        <AutocompletePortal>
          <AutocompletePositioner sideOffset={8}>
            <AutocompletePopup>
              {grouped ? (
                <>
                  <AutocompleteList>
                    {(group: FruitGroup, index: number) => (
                      <Fragment key={group.value}>
                        {index > 0 ? <AutocompleteSeparator /> : null}
                        <AutocompleteGroup items={group.items}>
                          <AutocompleteGroupLabel>{group.value}</AutocompleteGroupLabel>
                          <AutocompleteCollection>
                            {(item: string) => (
                              <AutocompleteItem key={item} value={item}>
                                {item}
                              </AutocompleteItem>
                            )}
                          </AutocompleteCollection>
                        </AutocompleteGroup>
                      </Fragment>
                    )}
                  </AutocompleteList>
                  <AutocompleteEmpty>No matches.</AutocompleteEmpty>
                </>
              ) : (
                <>
                  <AutocompleteList>
                    {(item: string) => (
                      <AutocompleteItem key={item} value={item}>
                        {item}
                      </AutocompleteItem>
                    )}
                  </AutocompleteList>
                  <AutocompleteEmpty>No matches.</AutocompleteEmpty>
                </>
              )}
            </AutocompletePopup>
          </AutocompletePositioner>
        </AutocompletePortal>
      </AutocompleteRoot>
    </div>
  );
}

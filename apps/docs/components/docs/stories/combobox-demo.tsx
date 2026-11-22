"use client";
import {
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxClear,
  ComboboxEmpty,
  ComboboxIcon,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxValue,
} from "../combobox-parts";

/** Props of the demo: the Combobox props it exposes, then the demo-only settings (see `demoArgs`). */
export type ComboboxDemoProps = {
  /** Allow several values. The selection shows as removable chips inside the input group. */
  multiple?: boolean;
  /** Stop the control from opening or taking input. */
  disabled?: boolean;
  /** The input placeholder. */
  placeholder?: string;
  /** Add a clear button that resets the value. */
  showClear?: boolean;
};

const TEAMS = ["Design", "Engineering", "Marketing", "Operations", "Research", "Sales"];

function Popup() {
  return (
    <ComboboxPortal>
      <ComboboxPositioner>
        <ComboboxPopup>
          <ComboboxEmpty>No team found.</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
                <ComboboxItemIndicator />
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </ComboboxPositioner>
    </ComboboxPortal>
  );
}

function Controls({ showClear }: { showClear: boolean }) {
  return (
    <>
      {showClear ? <ComboboxClear aria-label="Clear">×</ComboboxClear> : null}
      <ComboboxTrigger aria-label="Open list">
        <ComboboxIcon />
      </ComboboxTrigger>
    </>
  );
}

/**
 * A filterable list of teams, single or multiple. It is keyed by `multiple` so switching mode never
 * keeps a stale value, and its popup portals into the preview island.
 */
export function ComboboxDemo({
  multiple = false,
  disabled = false,
  placeholder = "Search a team",
  showClear = false,
}: ComboboxDemoProps) {
  return (
    <div data-focus-island>
      {multiple ? (
        <ComboboxRoot key="multiple" multiple items={TEAMS} disabled={disabled}>
          <ComboboxInputGroup>
            <ComboboxChips>
              <ComboboxValue>
                {(value: string[]) =>
                  value.map((team) => (
                    <ComboboxChip key={team}>
                      {team}
                      <ComboboxChipRemove />
                    </ComboboxChip>
                  ))
                }
              </ComboboxValue>
              <ComboboxInput aria-label="Teams" placeholder={placeholder} />
            </ComboboxChips>
            <Controls showClear={showClear} />
          </ComboboxInputGroup>
          <Popup />
        </ComboboxRoot>
      ) : (
        <ComboboxRoot key="single" items={TEAMS} disabled={disabled}>
          <ComboboxInputGroup>
            <ComboboxInput aria-label="Team" placeholder={placeholder} />
            <Controls showClear={showClear} />
          </ComboboxInputGroup>
          <Popup />
        </ComboboxRoot>
      )}
    </div>
  );
}

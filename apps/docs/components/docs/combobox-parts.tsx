"use client";
import { Combobox } from "@workspace/ui/components/combobox";

export const ComboboxRoot = Combobox.Root;
export const ComboboxLabel = Combobox.Label;
export const ComboboxValue = Combobox.Value;
export const ComboboxInput = Combobox.Input;
export const ComboboxInputGroup = Combobox.InputGroup;
export const ComboboxTrigger = Combobox.Trigger;
export const ComboboxList = Combobox.List;
export const ComboboxStatus = Combobox.Status;
export const ComboboxPortal = Combobox.Portal;
export const ComboboxBackdrop = Combobox.Backdrop;
export const ComboboxPositioner = Combobox.Positioner;
export const ComboboxPopup = Combobox.Popup;
export const ComboboxArrow = Combobox.Arrow;
export const ComboboxIcon = Combobox.Icon;
export const ComboboxGroup = Combobox.Group;
export const ComboboxGroupLabel = Combobox.GroupLabel;
export const ComboboxItem = Combobox.Item;
export const ComboboxItemIndicator = Combobox.ItemIndicator;
export const ComboboxChips = Combobox.Chips;
export const ComboboxChip = Combobox.Chip;
export const ComboboxChipRemove = Combobox.ChipRemove;
export const ComboboxRow = Combobox.Row;
export const ComboboxCollection = Combobox.Collection;
export const ComboboxEmpty = Combobox.Empty;
export const ComboboxClear = Combobox.Clear;
export const ComboboxSeparator = Combobox.Separator;

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
  "Mango",
];
const TEAMS = ["Design", "Engineering", "Marketing", "Operations", "Research", "Sales"];
const FRUITS_SHORT = ["Apple", "Banana", "Cherry", "Date"];

export function ComboboxFruitDemo() {
  return (
    <Combobox.Root items={FRUITS}>
      <Combobox.InputGroup>
        <Combobox.Input placeholder="Search a fruit" />
        <Combobox.Trigger>
          <Combobox.Icon />
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.Empty>No fruit found.</Combobox.Empty>
            <Combobox.List>
              {(item: string) => (
                <Combobox.Item key={item} value={item}>
                  {item}
                  <Combobox.ItemIndicator />
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export function ComboboxTeamDemo() {
  return (
    <Combobox.Root multiple items={TEAMS}>
      <Combobox.InputGroup>
        <Combobox.Chips>
          <Combobox.Value>
            {(value: string[]) =>
              value.map((v) => (
                <Combobox.Chip key={v}>
                  {v}
                  <Combobox.ChipRemove />
                </Combobox.Chip>
              ))
            }
          </Combobox.Value>
          <Combobox.Input placeholder="Add a team" />
        </Combobox.Chips>
        <Combobox.Trigger>
          <Combobox.Icon />
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.Empty>No team found.</Combobox.Empty>
            <Combobox.List>
              {(item: string) => (
                <Combobox.Item key={item} value={item}>
                  {item}
                  <Combobox.ItemIndicator />
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export function ComboboxFruitWithClearDemo() {
  return (
    <Combobox.Root items={FRUITS_SHORT}>
      <label data-ui="combobox-label" htmlFor="fruit-input">
        Favourite fruit
      </label>
      <Combobox.InputGroup>
        <Combobox.Input id="fruit-input" placeholder="Pick one" />
        <Combobox.Clear>×</Combobox.Clear>
        <Combobox.Trigger>
          <Combobox.Icon />
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.Empty>No fruit found.</Combobox.Empty>
            <Combobox.List>
              {(item: string) => (
                <Combobox.Item key={item} value={item}>
                  {item}
                  <Combobox.ItemIndicator />
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

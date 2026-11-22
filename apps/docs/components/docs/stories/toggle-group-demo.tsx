"use client";
import { TextB, TextItalic, TextUnderline } from "@phosphor-icons/react/dist/ssr";
import { Toggle } from "@workspace/ui/components/toggle";
import { ToggleGroup, type ToggleGroupProps } from "@workspace/ui/components/toggle-group";

export type ToggleGroupDemoProps = Pick<
  ToggleGroupProps,
  "variant" | "size" | "spacing" | "multiple" | "disabled" | "orientation"
>;

const ITEMS = ["Bold", "Italic", "Underline"] as const;
const ICONS = { Bold: TextB, Italic: TextItalic, Underline: TextUnderline } as const;

/**
 * Three toggles in a Toggle Group. It is keyed by `multiple` so switching selection mode
 * never keeps a stale pressed state.
 */
export function ToggleGroupDemo({
  variant,
  size,
  spacing,
  multiple,
  disabled,
  orientation,
}: ToggleGroupDemoProps) {
  const iconSize = size?.startsWith("icon") ?? false;
  return (
    <div data-focus-island>
      <ToggleGroup
        key={`${multiple ?? false}`}
        aria-label="Text formatting"
        variant={variant}
        size={size}
        spacing={spacing}
        multiple={multiple}
        disabled={disabled}
        orientation={orientation}
        defaultValue={multiple ? ["Bold", "Italic"] : ["Bold"]}
      >
        {ITEMS.map((item) => {
          const Icon = ICONS[item];
          // An icon size makes every item a square icon-only toggle, named by aria-label.
          return iconSize ? (
            <Toggle key={item} value={item} aria-label={item}>
              <Icon aria-hidden="true" weight="bold" />
            </Toggle>
          ) : (
            <Toggle key={item} value={item}>
              {item}
            </Toggle>
          );
        })}
      </ToggleGroup>
    </div>
  );
}

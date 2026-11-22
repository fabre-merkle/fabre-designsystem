"use client";
import type { Select } from "@workspace/ui/components/select";
import type { ComponentProps } from "react";
import {
  SelectGroup,
  SelectGroupLabel,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPopup,
  SelectRoot,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../select-parts";

type SelectRootProps = ComponentProps<typeof Select.Root>;

/** Props of the demo: the Select props it exposes, then the demo-only settings (see `demoArgs`). */
export type SelectDemoProps = Pick<SelectRootProps, "size" | "disabled"> & {
  /** The text shown on the trigger before a value is picked. */
  placeholder?: string;
  /** Cluster the items under group labels, with a separator between the groups. */
  grouped?: boolean;
};

const FRAMEWORKS = ["React", "Vue", "Svelte", "Solid"] as const;

function Option({ value, label }: { value: string; label: string }) {
  return (
    <SelectItem value={value}>
      <SelectItemText>{label}</SelectItemText>
      <SelectItemIndicator />
    </SelectItem>
  );
}

/** A Select with a flat list or two groups. Its popup portals into the preview island. */
export function SelectDemo({
  size = "md",
  disabled = false,
  placeholder = "Pick a framework",
  grouped = false,
}: SelectDemoProps) {
  return (
    <div data-focus-island>
      <SelectRoot key={grouped ? "grouped" : "flat"} size={size} disabled={disabled}>
        <SelectTrigger aria-label="Framework">
          <SelectValue placeholder={placeholder} />
          <SelectIcon />
        </SelectTrigger>
        <SelectPopup>
          {grouped ? (
            <>
              <SelectGroup>
                <SelectGroupLabel>Frontend</SelectGroupLabel>
                <Option value="react" label="React" />
                <Option value="vue" label="Vue" />
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectGroupLabel>Backend</SelectGroupLabel>
                <Option value="node" label="Node.js" />
                <Option value="deno" label="Deno" />
              </SelectGroup>
            </>
          ) : (
            FRAMEWORKS.map((name) => <Option key={name} value={name.toLowerCase()} label={name} />)
          )}
        </SelectPopup>
      </SelectRoot>
    </div>
  );
}

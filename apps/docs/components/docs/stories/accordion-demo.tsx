"use client";
import type { Accordion } from "@workspace/ui/components/accordion";
import type { ComponentProps } from "react";
import {
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  AccordionRoot,
  AccordionTrigger,
} from "../accordion-parts";

type AccordionRootProps = ComponentProps<typeof Accordion.Root>;

/** Props of the demo: the Accordion props it exposes, then the demo-only settings (see `demoArgs`). */
export type AccordionDemoProps = Pick<AccordionRootProps, "multiple" | "disabled"> & {
  /** Disable only the last item, to show the item-level disabled state. */
  disableLastItem?: boolean;
};

const ITEMS = [
  { value: "overview", label: "Overview", text: "A high-level summary of the workspace." },
  { value: "activity", label: "Activity", text: "A chronological feed of recent events." },
  { value: "settings", label: "Settings", text: "Preferences, integrations and defaults." },
] as const;

/** Three sections. It is keyed by `multiple` so switching mode never keeps a stale open set. */
export function AccordionDemo({
  multiple = false,
  disabled = false,
  disableLastItem = false,
}: AccordionDemoProps) {
  return (
    <div data-focus-island>
      <AccordionRoot
        key={multiple ? "multiple" : "single"}
        multiple={multiple}
        disabled={disabled}
        defaultValue={multiple ? ["overview", "activity"] : ["overview"]}
      >
        {ITEMS.map((item, index) => (
          <AccordionItem
            key={item.value}
            value={item.value}
            disabled={disableLastItem && index === ITEMS.length - 1}
          >
            <AccordionHeader>
              <AccordionTrigger>{item.label}</AccordionTrigger>
            </AccordionHeader>
            <AccordionPanel>
              <div>{item.text}</div>
            </AccordionPanel>
          </AccordionItem>
        ))}
      </AccordionRoot>
    </div>
  );
}

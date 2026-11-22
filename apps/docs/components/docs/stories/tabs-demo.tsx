"use client";
import { Tabs } from "@workspace/ui/components/tabs";

/** Props of the demo: the Tabs.Root props it exposes, then the demo-only settings (see `demoArgs`). */
export type TabsDemoProps = {
  /** Visual treatment: an underline indicator or a segmented control. */
  variant?: "line" | "segment";
  /** Control size: padding, gap, text and the segment height. */
  size?: "xs" | "sm" | "md" | "lg";
  /** The axis the tab list runs along. */
  orientation?: "horizontal" | "vertical";
  /** Disable the middle tab. */
  disabledTab?: boolean;
};

const TABS = [
  { value: "overview", label: "Overview", panel: "A high-level summary of the workspace." },
  { value: "activity", label: "Activity", panel: "Recent events across all members." },
  { value: "settings", label: "Settings", panel: "Configure preferences and integrations." },
] as const;

/** Three tabs. It is keyed by `orientation` so the indicator re-measures when the axis changes. */
export function TabsDemo({ variant, size, orientation, disabledTab = false }: TabsDemoProps) {
  return (
    <div data-focus-island>
      <Tabs.Root
        key={orientation ?? "horizontal"}
        defaultValue="overview"
        variant={variant}
        size={size}
        orientation={orientation}
      >
        <Tabs.List>
          {TABS.map((tab) => (
            <Tabs.Tab
              key={tab.value}
              value={tab.value}
              disabled={disabledTab && tab.value === "activity"}
            >
              {tab.label}
            </Tabs.Tab>
          ))}
          <Tabs.Indicator />
        </Tabs.List>
        {TABS.map((tab) => (
          <Tabs.Panel key={tab.value} value={tab.value}>
            {tab.panel}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </div>
  );
}

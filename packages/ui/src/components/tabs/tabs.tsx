"use client";
import "../control/control.css";
import "./tabs.css";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import React from "react";

type TabsSize = "xs" | "sm" | "md" | "lg";
type TabsVariant = "line" | "segment";

interface TabsContextValue {
  size: TabsSize;
  variant: TabsVariant;
}

const TabsContext = React.createContext<TabsContextValue>({
  size: "md",
  variant: "line",
});

interface RootProps extends React.ComponentProps<typeof TabsPrimitive.Root> {
  /**
   * Control size: padding, gap, text and the segment height.
   * @default "md"
   */
  size?: TabsSize;
  /**
   * Visual treatment: underline indicator or segmented control.
   * @default "line"
   */
  variant?: TabsVariant;
}

/**
 * Switches between views of the SAME kind of thing in one place — never for steps in a
 * sequence (use a wizard) or for navigation between pages (use links). All panels stay
 * mounted, so a tab is cheap to return to but not a place to lazily load from.
 *
 * Compose it: `Tabs.Root` holds a `Tabs.List` of `Tabs.Tab`s (plus an optional
 * `Tabs.Indicator`) and one `Tabs.Panel` per tab, matched by `value`.
 */
function Root({ size = "md", variant = "line", ...rest }: RootProps) {
  return (
    <TabsContext.Provider value={{ size, variant }}>
      <TabsPrimitive.Root data-ui="tabs-root" data-variant={variant} data-size={size} {...rest} />
    </TabsContext.Provider>
  );
}

function List(props: React.ComponentProps<typeof TabsPrimitive.List>) {
  const { size, variant } = React.useContext(TabsContext);
  return (
    <TabsPrimitive.List data-ui="tabs-list" data-size={size} data-variant={variant} {...props} />
  );
}

function Tab({ children, ...props }: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  const { size, variant } = React.useContext(TabsContext);
  return (
    <TabsPrimitive.Tab data-ui="tabs-tab" data-size={size} data-variant={variant} {...props}>
      <span data-ui="tabs-tab-label">{children}</span>
    </TabsPrimitive.Tab>
  );
}

function Indicator(props: React.ComponentProps<typeof TabsPrimitive.Indicator>) {
  const { variant } = React.useContext(TabsContext);
  return <TabsPrimitive.Indicator data-ui="tabs-indicator" data-variant={variant} {...props} />;
}

function Panel(props: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return <TabsPrimitive.Panel data-ui="tabs-panel" {...props} />;
}

export const Tabs = {
  Root,
  List,
  Tab,
  Indicator,
  Panel,
};

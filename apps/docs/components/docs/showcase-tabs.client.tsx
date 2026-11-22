"use client";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Children, type ReactNode } from "react";

export function ShowcaseTabs({ labels, children }: { labels: string[]; children: ReactNode }) {
  const panels = Children.toArray(children);
  return (
    <Tabs items={labels} data-docs-tabs="">
      {labels.map((label, i) => (
        <Tab key={label} value={label}>
          {panels[i]}
        </Tab>
      ))}
    </Tabs>
  );
}

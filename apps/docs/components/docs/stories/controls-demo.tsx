"use client";
import { Button } from "@workspace/ui/components/button";
import { Tabs } from "@workspace/ui/components/tabs";
import { Toggle } from "@workspace/ui/components/toggle";
import { ToggleGroup } from "@workspace/ui/components/toggle-group";

/** The Control sizes. `xs` and `sm` share one text style. */
type ControlSize = "xs" | "sm" | "md" | "lg";

/** Props of the demo: the Control size, then the demo-only scene (see `demoArgs`). */
export type ControlsDemoProps = {
  /** Height, padding, gap and text of every Control in the scene. The Sizes scene shows all four. */
  size: ControlSize;
  /** Which set of Controls to show. */
  scene: "row" | "sizes" | "emphasis" | "segmented";
};

const SIZES = ["xs", "sm", "md", "lg"] as const;

/**
 * Controls of one size side by side. The Controls are the real Button, Toggle Group and Tabs, so
 * they take their height, padding and text from the same `control.*` tokens the rules describe.
 */
export function ControlsDemo({ size, scene }: ControlsDemoProps) {
  return (
    <div data-focus-island>
      {scene === "row" && (
        <>
          <Button size={size} mode="lighter">
            Share
          </Button>
          <ToggleGroup size={size} defaultValue={["week"]} aria-label="Range">
            <Toggle value="day">Day</Toggle>
            <Toggle value="week">Week</Toggle>
            <Toggle value="month">Month</Toggle>
          </ToggleGroup>
          <Tabs.Root defaultValue="list" size={size} variant="segment">
            <Tabs.List>
              <Tabs.Tab value="list">List</Tabs.Tab>
              <Tabs.Tab value="board">Board</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
          <Button size={size}>Publish</Button>
        </>
      )}
      {scene === "sizes" &&
        SIZES.map((item) => (
          <Button key={item} size={item}>
            {item}
          </Button>
        ))}
      {scene === "emphasis" && (
        <>
          <Button size={size} mode="filled">
            Primary
          </Button>
          <Button size={size} mode="lighter">
            Secondary
          </Button>
          <Button size={size} mode="ghost">
            Tertiary
          </Button>
        </>
      )}
      {scene === "segmented" && (
        <>
          <ToggleGroup size={size} defaultValue={["b"]} aria-label="Joined">
            <Toggle value="a">Joined</Toggle>
            <Toggle value="b">Items</Toggle>
            <Toggle value="c">Here</Toggle>
          </ToggleGroup>
          <ToggleGroup size={size} spacing="gapped" defaultValue={["b"]} aria-label="Gapped">
            <Toggle value="a">Gapped</Toggle>
            <Toggle value="b">Items</Toggle>
            <Toggle value="c">Here</Toggle>
          </ToggleGroup>
        </>
      )}
    </div>
  );
}

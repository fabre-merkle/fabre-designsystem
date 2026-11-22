"use client";

import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Elevated } from "@workspace/ui/components/elevated";
import { Menu } from "@workspace/ui/components/menu";
import { Popover } from "@workspace/ui/components/popover";
import { Select } from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import { type ReactNode, useId } from "react";
import {
  ElevationExample,
  type ExampleButtonProps,
  type ExampleChoiceProps,
  ExampleComponentsProvider,
  type ExampleSurfaceProps,
  type ExampleToggleProps,
} from "./foundation-examples";

function ElevatedSurface({ level, shadowLevel, children, className = "" }: ExampleSurfaceProps) {
  return (
    <Elevated
      className={`docs-example-surface ${className}`}
      level={level}
      shadowLevel={shadowLevel}
    >
      {children}
    </Elevated>
  );
}

function Panel({ level, shadowLevel, children, className }: ExampleSurfaceProps) {
  return (
    <Card.Root className={className} size="sm" level={level} shadowLevel={shadowLevel}>
      <Card.Content>{children}</Card.Content>
    </Card.Root>
  );
}

function Choice({ label, value, options, disabled, onChange }: ExampleChoiceProps) {
  const id = useId();
  return (
    <div className="docs-example-choice">
      <span id={id}>{label}</span>
      <Select.Root
        value={value}
        items={options}
        disabled={disabled}
        size="sm"
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
      >
        <Select.Trigger aria-labelledby={id}>
          <Select.Value />
          <Select.Icon />
        </Select.Trigger>
        <Select.Popup>
          {options.map((option) => (
            <Select.Item key={option.value} value={option.value}>
              <Select.ItemText>{option.label}</Select.ItemText>
              <Select.ItemIndicator />
            </Select.Item>
          ))}
        </Select.Popup>
      </Select.Root>
    </div>
  );
}

function Toggle({ label, checked, onChange }: ExampleToggleProps) {
  const id = useId();
  return (
    <label htmlFor={id}>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

function Action({ appearance = "secondary", ...props }: ExampleButtonProps) {
  return <Button size="sm" mode={appearance === "primary" ? "filled" : "stroke"} {...props} />;
}

const components = { Surface: ElevatedSurface, Panel, Choice, Toggle, Action };

export function FoundationExamplesProvider({ children }: { children?: ReactNode }) {
  return <ExampleComponentsProvider value={components}>{children}</ExampleComponentsProvider>;
}

export function ElevationExampleWithComponents() {
  return (
    <FoundationExamplesProvider>
      <ElevationExample Popover={Popover} Menu={Menu} />
    </FoundationExamplesProvider>
  );
}

"use client";
/*
 * Adapted from @fumadocs/story (MIT, Copyright (c) 2023 Fuma): the story panel's select.
 * Icons are Phosphor; the popup takes a `className` so a menu can set its own width.
 */
import { Select } from "@base-ui/react/select";
import { CaretDown, Check } from "@phosphor-icons/react";
import type { ComponentProps } from "react";
import { cn } from "./cn";

/** Base UI accepts a class function; these wrappers take a plain string. */
type StringClass<T> = Omit<T, "className"> & { className?: string };

const SelectRoot = Select.Root;
const SelectValue = Select.Value;

function SelectTrigger({
  className,
  children,
  ...props
}: StringClass<ComponentProps<typeof Select.Trigger>>) {
  return (
    <Select.Trigger
      className={cn(
        "flex w-full items-center gap-2 rounded-md border bg-fd-secondary p-2 text-start text-sm text-fd-secondary-foreground hover:bg-fd-accent focus:outline-none focus:ring focus:ring-fd-ring disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-fd-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <Select.Icon className="ms-auto shrink-0 text-fd-muted-foreground">
        <CaretDown aria-hidden="true" className="size-3.5" />
      </Select.Icon>
    </Select.Trigger>
  );
}

const scrollArrowClassName = "inset-x-0 z-10 h-6 from-fd-popover to-transparent";

function SelectContent({
  className,
  children,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  ...props
}: StringClass<ComponentProps<typeof Select.Popup>> &
  Pick<ComponentProps<typeof Select.Positioner>, "align" | "side" | "sideOffset">) {
  return (
    <Select.Portal>
      <Select.Positioner align={align} side={side} sideOffset={sideOffset} className="z-50">
        <Select.Popup
          className={cn(
            "relative z-50 min-w-[calc(var(--anchor-width)+--spacing(2))] overflow-hidden rounded-lg border bg-fd-popover text-fd-popover-foreground shadow-md",
            className,
          )}
          {...props}
        >
          <Select.ScrollUpArrow className={cn(scrollArrowClassName, "top-0 bg-linear-to-b")}>
            {null}
          </Select.ScrollUpArrow>
          <Select.List className="p-1">{children}</Select.List>
          <Select.ScrollDownArrow className={cn(scrollArrowClassName, "bottom-0 bg-linear-to-t")}>
            {null}
          </Select.ScrollDownArrow>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: StringClass<ComponentProps<typeof Select.Item>>) {
  return (
    <Select.Item
      className={cn(
        "flex select-none flex-row items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-fd-accent data-[highlighted]:text-fd-accent-foreground data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="ms-auto shrink-0">
        <Check aria-hidden="true" className="size-3.5 text-fd-primary" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}

export { SelectContent, SelectItem, SelectRoot as Select, SelectTrigger, SelectValue };

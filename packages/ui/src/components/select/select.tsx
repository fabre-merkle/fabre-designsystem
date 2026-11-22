"use client";
import "./select.css";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CaretDown, Check } from "@phosphor-icons/react";
import React from "react";
import {
  SHADOW_LEVEL,
  SURFACE_OFFSET,
  SurfaceLevel,
  useElevation,
} from "../elevated/surface-level";

type SelectSize = "sm" | "md" | "lg";

const SelectContext = React.createContext<{ size: SelectSize }>({ size: "md" });

interface RootProps extends React.ComponentProps<typeof SelectPrimitive.Root> {
  /**
   * Trigger height. Passed to the trigger through context.
   * @default "md"
   */
  size?: SelectSize;
}

function Root({ size = "md", children, ...rest }: RootProps) {
  return (
    <SelectContext.Provider value={{ size }}>
      <SelectPrimitive.Root {...rest}>{children}</SelectPrimitive.Root>
    </SelectContext.Provider>
  );
}

function Trigger(props: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  const { size } = React.useContext(SelectContext);
  return <SelectPrimitive.Trigger data-ui="select-trigger" data-size={size} {...props} />;
}

function Value(props: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-ui="select-value" {...props} />;
}

function Icon({ children, ...props }: React.ComponentProps<typeof SelectPrimitive.Icon>) {
  return (
    <SelectPrimitive.Icon data-ui="select-icon" {...props}>
      {children ?? <CaretDown weight="bold" />}
    </SelectPrimitive.Icon>
  );
}

type PopupProps = React.ComponentProps<typeof SelectPrimitive.Popup> & {
  /** Portal target. Defaults to `document.body`. */
  container?: React.ComponentProps<typeof SelectPrimitive.Portal>["container"];
  /** Collision boundary for the positioner. Defaults to the clipping ancestors. */
  collisionBoundary?: React.ComponentProps<typeof SelectPrimitive.Positioner>["collisionBoundary"];
  /** Collision strategy; `{ side: "none" }` keeps the popup on its side instead of flipping. */
  collisionAvoidance?: React.ComponentProps<
    typeof SelectPrimitive.Positioner
  >["collisionAvoidance"];
  /** Overlay the selected item on the trigger (Base UI default) or open below it. */
  alignItemWithTrigger?: boolean;
};

function Popup({
  container,
  collisionBoundary,
  collisionAvoidance,
  alignItemWithTrigger,
  ...props
}: PopupProps) {
  const level = useElevation(SURFACE_OFFSET.overlay);
  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Positioner
        data-slot="select-positioner"
        collisionBoundary={collisionBoundary}
        collisionAvoidance={collisionAvoidance}
        alignItemWithTrigger={alignItemWithTrigger}
      >
        <SurfaceLevel level={level}>
          <SelectPrimitive.Popup
            data-ui="select-popup"
            data-surface-level={level}
            data-shadow-level={SHADOW_LEVEL.overlay}
            {...props}
          />
        </SurfaceLevel>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function Item(props: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item data-ui="select-item" {...props} />;
}

function ItemText(props: React.ComponentProps<typeof SelectPrimitive.ItemText>) {
  return <SelectPrimitive.ItemText data-ui="select-item-text" {...props} />;
}

function ItemIndicator({
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ItemIndicator>) {
  return (
    <SelectPrimitive.ItemIndicator data-ui="select-item-indicator" {...props}>
      {children ?? <Check weight="bold" />}
    </SelectPrimitive.ItemIndicator>
  );
}

function Separator(props: React.HTMLAttributes<HTMLElement>): React.JSX.Element {
  return <SelectPrimitive.Separator data-ui="select-separator" {...props} />;
}

function Group(props: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-ui="select-group" {...props} />;
}

function GroupLabel(props: React.ComponentProps<typeof SelectPrimitive.GroupLabel>) {
  return <SelectPrimitive.GroupLabel data-ui="select-group-label" {...props} />;
}

export const Select = {
  Root,
  Trigger,
  Value,
  Icon,
  Popup,
  Item,
  ItemText,
  ItemIndicator,
  Separator,
  Group,
  GroupLabel,
};

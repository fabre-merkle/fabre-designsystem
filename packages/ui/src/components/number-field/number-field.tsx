"use client";
import "./number-field.css";
import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import React from "react";

type NumberFieldSize = "sm" | "md" | "lg";

interface NumberFieldSizeContextValue {
  size: NumberFieldSize;
}

const NumberFieldSizeContext = React.createContext<NumberFieldSizeContextValue | null>(null);

export type NumberFieldProps = React.ComponentProps<typeof NumberFieldPrimitive.Root> &
  Partial<{
    /**
     * Control height. Passed to the group, input, increment and decrement
     * parts through context.
     * @default "md"
     */
    size: NumberFieldSize;
    /**
     * Marks the field invalid by setting `data-invalid` for error styling.
     * Pair it with field validation where possible.
     */
    invalid: boolean;
  }>;

/**
 * A numeric input with stepper buttons, for a number the user may want to nudge rather
 * than type — a quantity, a count, a duration. Use Input with `type="number"` only when
 * stepping makes no sense, and Slider when the approximate value is enough.
 *
 * Compose it: `NumberField.Root` holds a `NumberField.Group` containing
 * `NumberField.Decrement`, `NumberField.Input` and `NumberField.Increment`. The stepper
 * buttons are not keyboard stops of their own — arrow keys in the input do the same job —
 * so they need accessible names for pointer users.
 */
function Root({ size = "md", invalid, ...rest }: NumberFieldProps) {
  const contextValue = React.useMemo(() => ({ size }), [size]);
  return (
    <NumberFieldSizeContext.Provider value={contextValue}>
      <NumberFieldPrimitive.Root
        {...rest}
        data-ui="number-field"
        data-size={size}
        data-invalid={invalid ? "" : undefined}
      />
    </NumberFieldSizeContext.Provider>
  );
}

function Group(props: React.ComponentProps<typeof NumberFieldPrimitive.Group>) {
  const ctx = React.useContext(NumberFieldSizeContext);
  return (
    <NumberFieldPrimitive.Group
      {...props}
      data-ui="number-field-group"
      data-size={ctx?.size ?? "md"}
    />
  );
}

function Input(props: React.ComponentProps<typeof NumberFieldPrimitive.Input>) {
  const ctx = React.useContext(NumberFieldSizeContext);
  return (
    <NumberFieldPrimitive.Input
      {...props}
      data-ui="number-field-input"
      data-size={ctx?.size ?? "md"}
    />
  );
}

function Increment(props: React.ComponentProps<typeof NumberFieldPrimitive.Increment>) {
  const ctx = React.useContext(NumberFieldSizeContext);
  return (
    <NumberFieldPrimitive.Increment
      {...props}
      data-ui="number-field-increment"
      data-size={ctx?.size ?? "md"}
    />
  );
}

function Decrement(props: React.ComponentProps<typeof NumberFieldPrimitive.Decrement>) {
  const ctx = React.useContext(NumberFieldSizeContext);
  return (
    <NumberFieldPrimitive.Decrement
      {...props}
      data-ui="number-field-decrement"
      data-size={ctx?.size ?? "md"}
    />
  );
}

function ScrubArea(props: React.ComponentProps<typeof NumberFieldPrimitive.ScrubArea>) {
  return <NumberFieldPrimitive.ScrubArea {...props} data-ui="number-field-scrub-area" />;
}

function ScrubAreaCursor(props: React.ComponentProps<typeof NumberFieldPrimitive.ScrubAreaCursor>) {
  return (
    <NumberFieldPrimitive.ScrubAreaCursor {...props} data-ui="number-field-scrub-area-cursor" />
  );
}

export const NumberField = {
  Root,
  Group,
  Input,
  Increment,
  Decrement,
  ScrubArea,
  ScrubAreaCursor,
};

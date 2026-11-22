"use client";
import "./slider.css";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import React from "react";

type SliderSize = "sm" | "md" | "lg";

interface SliderSizeContextValue {
  size: SliderSize;
}

const SliderSizeContext = React.createContext<SliderSizeContextValue | null>(null);

export type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> &
  Partial<{
    /**
     * Track and thumb scale. Passed to the value, control, track and thumb
     * parts through context.
     * @default "md"
     */
    size: SliderSize;
  }>;

function Root({ size = "md", ...rest }: SliderProps) {
  const contextValue = React.useMemo(() => ({ size }), [size]);
  return (
    <SliderSizeContext.Provider value={contextValue}>
      <SliderPrimitive.Root {...rest} data-ui="slider" data-size={size} />
    </SliderSizeContext.Provider>
  );
}

function Value(props: React.ComponentProps<typeof SliderPrimitive.Value>) {
  const ctx = React.useContext(SliderSizeContext);
  return <SliderPrimitive.Value {...props} data-ui="slider-value" data-size={ctx?.size ?? "md"} />;
}

function Control(props: React.ComponentProps<typeof SliderPrimitive.Control>) {
  const ctx = React.useContext(SliderSizeContext);
  return (
    <SliderPrimitive.Control {...props} data-ui="slider-control" data-size={ctx?.size ?? "md"} />
  );
}

function Track(props: React.ComponentProps<typeof SliderPrimitive.Track>) {
  const ctx = React.useContext(SliderSizeContext);
  return <SliderPrimitive.Track {...props} data-ui="slider-track" data-size={ctx?.size ?? "md"} />;
}

function Indicator(props: React.ComponentProps<typeof SliderPrimitive.Indicator>) {
  return <SliderPrimitive.Indicator {...props} data-ui="slider-indicator" />;
}

function Thumb(props: React.ComponentProps<typeof SliderPrimitive.Thumb>) {
  const ctx = React.useContext(SliderSizeContext);
  return <SliderPrimitive.Thumb {...props} data-ui="slider-thumb" data-size={ctx?.size ?? "md"} />;
}

export const Slider = {
  Root,
  Value,
  Control,
  Track,
  Indicator,
  Thumb,
};

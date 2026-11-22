"use client";
import "./meter.css";
import { Meter as MeterPrimitive } from "@base-ui/react/meter";
import React from "react";

type MeterSize = "sm" | "md" | "lg";
type MeterTone = "neutral" | "success" | "warning" | "critical";

const MeterContext = React.createContext<{ size: MeterSize }>({ size: "md" });

type RootProps = React.ComponentProps<typeof MeterPrimitive.Root> & {
  /**
   * Track height: `sm` 4px, `md` 8px, `lg` 12px. Passed to the track through context.
   * @default "md"
   */
  size?: MeterSize;
  /**
   * Indicator colour. Use it to communicate threshold semantics, such as
   * nearly-full storage as `critical`.
   * @default "neutral"
   */
  tone?: MeterTone;
};

function Root({ size = "md", tone = "neutral", ...rest }: RootProps) {
  return (
    <MeterContext.Provider value={{ size }}>
      <MeterPrimitive.Root {...rest} data-ui="meter" data-size={size} data-tone={tone} />
    </MeterContext.Provider>
  );
}

function Label(props: React.ComponentProps<typeof MeterPrimitive.Label>) {
  return <MeterPrimitive.Label {...props} data-ui="meter-label" />;
}

function Value(props: React.ComponentProps<typeof MeterPrimitive.Value>) {
  return <MeterPrimitive.Value {...props} data-ui="meter-value" />;
}

function Track(props: React.ComponentProps<typeof MeterPrimitive.Track>) {
  const { size } = React.useContext(MeterContext);
  return <MeterPrimitive.Track {...props} data-ui="meter-track" data-size={size} />;
}

function Indicator(props: React.ComponentProps<typeof MeterPrimitive.Indicator>) {
  return <MeterPrimitive.Indicator {...props} data-ui="meter-indicator" />;
}

export const Meter = {
  Root,
  Label,
  Value,
  Track,
  Indicator,
};

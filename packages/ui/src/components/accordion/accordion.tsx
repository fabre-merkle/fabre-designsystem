"use client";
import "./accordion.css";
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { CaretDown } from "@phosphor-icons/react";
import type React from "react";

/**
 * Collapses long content into labelled sections the reader opens as needed. Worth it only
 * when most readers want one section: hiding content costs a click and keeps it out of
 * in-page search, so an accordion of things everyone reads is a tax, not a tidy-up.
 *
 * Compose it: `Accordion.Root` holds `Accordion.Item`s, each with an
 * `Accordion.Header` + `Accordion.Trigger` and an `Accordion.Panel`. Several panels may
 * be open at once unless `multiple={false}`.
 */
function Root(props: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-ui="accordion-root" {...props} />;
}

function Item(props: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item data-ui="accordion-item" {...props} />;
}

function Header(props: React.ComponentProps<typeof AccordionPrimitive.Header>) {
  return <AccordionPrimitive.Header data-ui="accordion-header" {...props} />;
}

function Trigger({ children, ...rest }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Trigger data-ui="accordion-trigger" {...rest}>
      <span data-ui="accordion-trigger-label">{children}</span>
      <CaretDown data-ui="accordion-trigger-icon" aria-hidden weight="bold" />
    </AccordionPrimitive.Trigger>
  );
}

function Panel(props: React.ComponentProps<typeof AccordionPrimitive.Panel>) {
  return <AccordionPrimitive.Panel data-ui="accordion-panel" {...props} />;
}

export const Accordion = {
  Root,
  Item,
  Header,
  Trigger,
  Panel,
};

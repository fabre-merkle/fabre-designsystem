"use client";
import "./card.css";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";
import { createContext, useContext } from "react";
import { Elevated, type ElevatedProps } from "../elevated/elevated";

/** Card sizes, spacing only: `md` for a standalone card, `sm` for dense grids and nested cards, `lg` for a standalone or hero card that needs more room. */
export type CardSize = "sm" | "md" | "lg";

/**
 * Props of the Card root. The surface comes from Elevated, so `offset`, `level`, `shadowLevel`
 * and `hoverable` are Elevated's props, forwarded as they are; `size` is the Card's own.
 */
export type CardProps = ElevatedProps & {
  /**
   * Padding and gap for the whole card. The parts follow it. Size is density only: the title and
   * the content keep the same type at every size.
   * @default "md"
   */
  size?: CardSize;
};

/** Part props: a `div` by default, re-tagged with `render`. */
export type CardPartProps = useRender.ComponentProps<"div">;

// The parts read the size from the root so each can carry its own `data-size`: the size rules
// stay one selector per part and the Figma contract reads them as an axis on that part.
const CardSizeContext = createContext<CardSize>("md");

/**
 * The card surface. It is an `Elevated`, so it reads the surface level it sits on and lands two
 * levels above it (level 3 on the page, level 5 inside another card), with a shadow level of 1
 * that nesting never raises. Pass `offset`, `level` or `shadowLevel` to change either knob.
 */
function Root({ size = "md", ...props }: CardProps) {
  return (
    <CardSizeContext.Provider value={size}>
      <Elevated {...props} data-ui="card" data-size={size} />
    </CardSizeContext.Provider>
  );
}

/**
 * Groups the title, the description and an optional action at the top of the card. The title and
 * description stack in the first column and the action takes the second, beside both.
 */
function Header({ render, ...props }: CardPartProps) {
  const size = useContext(CardSizeContext);
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      { "data-ui": "card-header", "data-size": size } as React.ComponentProps<"div">,
      props,
    ),
  });
}

/** The card heading. A `div` by default; pass `render={<h3 />}` for a real heading. */
function Title({ render, ...props }: CardPartProps) {
  const size = useContext(CardSizeContext);
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      { "data-ui": "card-title", "data-size": size } as React.ComponentProps<"div">,
      props,
    ),
  });
}

/** Supporting text under the title. */
function Description({ render, ...props }: CardPartProps) {
  const size = useContext(CardSizeContext);
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      { "data-ui": "card-description", "data-size": size } as React.ComponentProps<"div">,
      props,
    ),
  });
}

/** A control beside the title and description, such as a menu button. Place it inside the header. */
function Action({ render, ...props }: CardPartProps) {
  const size = useContext(CardSizeContext);
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      { "data-ui": "card-action", "data-size": size } as React.ComponentProps<"div">,
      props,
    ),
  });
}

/** The card body. Accepts any children. */
function Content({ render, ...props }: CardPartProps) {
  const size = useContext(CardSizeContext);
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      { "data-ui": "card-content", "data-size": size } as React.ComponentProps<"div">,
      props,
    ),
  });
}

/** A row at the bottom of the card, usually actions. Items align to the start. */
function Footer({ render, ...props }: CardPartProps) {
  const size = useContext(CardSizeContext);
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      { "data-ui": "card-footer", "data-size": size } as React.ComponentProps<"div">,
      props,
    ),
  });
}

export { Action, Content, Description, Footer, Header, Root, Title };

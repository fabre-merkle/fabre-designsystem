"use client";
import {
  PreviewCardArrow,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardRoot,
  PreviewCardTrigger,
} from "../preview-card-parts";

/** Props of the demo: the PreviewCard props it exposes, then the demo-only content (see `demoArgs`). */
export type PreviewCardDemoProps = {
  /** The link text that opens the card. */
  triggerLabel?: string;
  /** The card heading. */
  heading?: string;
  /** The card body. */
  description?: string;
  /** Show an arrow pointing at the trigger. */
  showArrow?: boolean;
  /** Milliseconds the pointer rests on the trigger before the card opens. */
  delay?: number;
  /** Milliseconds before the card closes after the pointer leaves. */
  closeDelay?: number;
  /** Which side of the trigger the card sits on. */
  side?: "top" | "right" | "bottom" | "left";
  /** How the card aligns along that side. */
  align?: "start" | "center" | "end";
};

/** A link that previews its target on hover or focus. The popup portals into the preview island. */
export function PreviewCardDemo({
  triggerLabel = "@acme",
  heading = "Acme",
  description = "A customer experience company.",
  showArrow = false,
  delay = 600,
  closeDelay = 300,
  side = "bottom",
  align = "center",
}: PreviewCardDemoProps) {
  return (
    <div data-focus-island>
      <PreviewCardRoot>
        <PreviewCardTrigger
          delay={delay}
          closeDelay={closeDelay}
          href="#"
          style={{ color: "var(--color-primary)", textDecoration: "underline" }}
        >
          {triggerLabel}
        </PreviewCardTrigger>
        <PreviewCardPortal>
          <PreviewCardPositioner side={side} align={align}>
            <PreviewCardPopup>
              {showArrow ? <PreviewCardArrow /> : null}
              <strong>{heading}</strong>
              <span style={{ color: "var(--color-on-surface-subtle)" }}>{description}</span>
            </PreviewCardPopup>
          </PreviewCardPositioner>
        </PreviewCardPortal>
      </PreviewCardRoot>
    </div>
  );
}

"use client";
import { Button } from "@workspace/ui/components/button";
import {
  PopoverArrow,
  PopoverClose,
  PopoverDescription,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverRoot,
  PopoverTitle,
  PopoverTrigger,
} from "../popover-parts";

/** Props of the demo: the Popover props it exposes, then the demo-only content (see `demoArgs`). */
export type PopoverDemoProps = {
  /** The trigger button label. */
  triggerLabel?: string;
  /** The popover title. */
  title?: string;
  /** The popover description. */
  description?: string;
  /** Show an arrow pointing at the trigger. */
  showArrow?: boolean;
  /** Add a Close button inside the popover. */
  showClose?: boolean;
  /** Open on hover as well as on click. */
  openOnHover?: boolean;
  /** Make the page behind the popover inert while it is open. */
  modal?: boolean;
  /** Which side of the trigger the popover sits on. */
  side?: "top" | "right" | "bottom" | "left";
  /** How the popover aligns along that side. */
  align?: "start" | "center" | "end";
  /** Distance from the trigger, in pixels. */
  sideOffset?: number;
};

/** A popover opened from a Button. Its popup portals into the preview island. */
export function PopoverDemo({
  triggerLabel = "Show details",
  title = "Account status",
  description = "Your account is in good standing. Renewal is automatic on the first of each month.",
  showArrow = false,
  showClose = false,
  openOnHover = false,
  modal = false,
  side = "bottom",
  align = "center",
  sideOffset = 8,
}: PopoverDemoProps) {
  return (
    <div data-focus-island>
      <PopoverRoot modal={modal}>
        <PopoverTrigger
          openOnHover={openOnHover}
          render={<Button variant="secondary">{triggerLabel}</Button>}
        />
        <PopoverPortal>
          <PopoverPositioner side={side} align={align} sideOffset={sideOffset}>
            <PopoverPopup>
              {showArrow ? <PopoverArrow /> : null}
              <PopoverTitle>{title}</PopoverTitle>
              <PopoverDescription>{description}</PopoverDescription>
              {showClose ? (
                <PopoverClose
                  render={
                    <Button size="sm" mode="ghost" variant="secondary">
                      Close
                    </Button>
                  }
                />
              ) : null}
            </PopoverPopup>
          </PopoverPositioner>
        </PopoverPortal>
      </PopoverRoot>
    </div>
  );
}

"use client";
import { Button } from "@workspace/ui/components/button";
import {
  TooltipArrow,
  TooltipPopup,
  TooltipPortal,
  TooltipPositioner,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "../tooltip-parts";

/** Props of the demo: the Tooltip props it exposes, then the demo-only copy (see `demoArgs`). */
export type TooltipDemoProps = {
  /** The trigger button label. */
  triggerLabel?: string;
  /** The tooltip text. */
  content?: string;
  /** Show an arrow pointing at the trigger. */
  showArrow?: boolean;
  /** Stop the tooltip from opening. */
  disabled?: boolean;
  /** Which side of the trigger the tooltip sits on. */
  side?: "top" | "right" | "bottom" | "left";
  /** How the tooltip aligns along that side. */
  align?: "start" | "center" | "end";
  /** Milliseconds the pointer rests on the trigger before the tooltip opens. */
  delay?: number;
  /** Let the tooltip follow the cursor along an axis instead of anchoring to the trigger. */
  trackCursorAxis?: "none" | "x" | "y" | "both";
};

/** A tooltip on a Button. Its popup portals into the preview island. */
export function TooltipDemo({
  triggerLabel = "Hover me",
  content = "Saves your changes immediately",
  showArrow = false,
  disabled = false,
  side = "top",
  align = "center",
  delay = 600,
  trackCursorAxis = "none",
}: TooltipDemoProps) {
  return (
    <div data-focus-island>
      <TooltipProvider delay={delay}>
        <TooltipRoot disabled={disabled} trackCursorAxis={trackCursorAxis}>
          <TooltipTrigger render={<Button>{triggerLabel}</Button>} />
          <TooltipPortal>
            <TooltipPositioner side={side} align={align}>
              <TooltipPopup>
                {showArrow ? <TooltipArrow /> : null}
                {content}
              </TooltipPopup>
            </TooltipPositioner>
          </TooltipPortal>
        </TooltipRoot>
      </TooltipProvider>
    </div>
  );
}

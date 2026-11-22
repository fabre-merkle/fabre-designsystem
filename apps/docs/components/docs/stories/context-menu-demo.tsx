"use client";
import { useState } from "react";
import {
  ContextMenuCheckboxItem,
  ContextMenuCheckboxItemIndicator,
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuPortal,
  ContextMenuPositioner,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuRadioItemIndicator,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuSubmenuRoot,
  ContextMenuSubmenuTrigger,
  ContextMenuTrigger,
} from "../context-menu-parts";

/** Props of the demo: ContextMenu has no props of its own, so these shape the example (see `demoArgs`). */
export type ContextMenuDemoProps = {
  /** The text inside the right-click area. */
  triggerLabel?: string;
  /** What the popup holds. */
  content?: "actions" | "checkboxes" | "radios" | "submenu";
};

function Checkboxes() {
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(false);
  return (
    <ContextMenuGroup>
      <ContextMenuGroupLabel>View</ContextMenuGroupLabel>
      <ContextMenuCheckboxItem checked={showGrid} onCheckedChange={setShowGrid}>
        <ContextMenuCheckboxItemIndicator />
        Show grid
      </ContextMenuCheckboxItem>
      <ContextMenuCheckboxItem checked={showRulers} onCheckedChange={setShowRulers}>
        <ContextMenuCheckboxItemIndicator />
        Show rulers
      </ContextMenuCheckboxItem>
    </ContextMenuGroup>
  );
}

function Radios() {
  return (
    <ContextMenuRadioGroup defaultValue="name">
      <ContextMenuGroupLabel>Sort by</ContextMenuGroupLabel>
      {["Name", "Date", "Size"].map((label) => (
        <ContextMenuRadioItem key={label} value={label.toLowerCase()}>
          <ContextMenuRadioItemIndicator />
          {label}
        </ContextMenuRadioItem>
      ))}
    </ContextMenuRadioGroup>
  );
}

/** A right-click area that opens a context menu at the pointer. Its popup portals into the preview island. */
export function ContextMenuDemo({
  triggerLabel = "Right-click anywhere in this area",
  content = "actions",
}: ContextMenuDemoProps) {
  return (
    <div data-focus-island>
      <ContextMenuRoot key={content}>
        <ContextMenuTrigger
          style={{
            display: "grid",
            placeItems: "center",
            minHeight: 140,
            minWidth: 280,
            padding: "var(--spacing-400)",
            borderRadius: "var(--radius-default)",
            border: "1px dashed var(--color-surface-border-1)",
            color: "var(--color-on-surface-subtle)",
            fontFamily: "var(--typography-paragraph-md-font-family)",
            fontSize: "var(--typography-paragraph-md-font-size)",
          }}
        >
          {triggerLabel}
        </ContextMenuTrigger>
        <ContextMenuPortal>
          <ContextMenuPositioner>
            <ContextMenuPopup>
              {content === "checkboxes" ? <Checkboxes /> : null}
              {content === "radios" ? <Radios /> : null}
              {content === "actions" || content === "submenu" ? (
                <>
                  <ContextMenuItem>Copy</ContextMenuItem>
                  <ContextMenuItem>Paste</ContextMenuItem>
                  {content === "submenu" ? (
                    <ContextMenuSubmenuRoot>
                      <ContextMenuSubmenuTrigger>Share</ContextMenuSubmenuTrigger>
                      <ContextMenuPortal>
                        <ContextMenuPositioner>
                          <ContextMenuPopup>
                            <ContextMenuItem>Copy link</ContextMenuItem>
                            <ContextMenuItem>Email</ContextMenuItem>
                          </ContextMenuPopup>
                        </ContextMenuPositioner>
                      </ContextMenuPortal>
                    </ContextMenuSubmenuRoot>
                  ) : (
                    <ContextMenuItem>Duplicate</ContextMenuItem>
                  )}
                  <ContextMenuSeparator />
                  <ContextMenuItem>Delete</ContextMenuItem>
                </>
              ) : null}
            </ContextMenuPopup>
          </ContextMenuPositioner>
        </ContextMenuPortal>
      </ContextMenuRoot>
    </div>
  );
}

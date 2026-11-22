"use client";
import { Button } from "@workspace/ui/components/button";
import { useState } from "react";
import {
  MenuCheckboxItem,
  MenuCheckboxItemIndicator,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuRoot,
  MenuSeparator,
  MenuSubmenuRoot,
  MenuSubmenuTrigger,
  MenuTrigger,
} from "../menu-parts";

/** Props of the demo: the Menu props it exposes, then the demo-only settings (see `demoArgs`). */
export type MenuDemoProps = {
  /** Make the page behind the menu inert while it is open. */
  modal?: boolean;
  /** Stop the trigger from opening the menu. */
  disabled?: boolean;
  /** The trigger button label. */
  triggerLabel?: string;
  /** What the popup holds. */
  content?: "actions" | "checkboxes" | "radios" | "submenu";
};

function Checkboxes() {
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(false);
  return (
    <MenuGroup>
      <MenuGroupLabel>View</MenuGroupLabel>
      <MenuCheckboxItem checked={showGrid} onCheckedChange={setShowGrid}>
        <MenuCheckboxItemIndicator />
        Show grid
      </MenuCheckboxItem>
      <MenuCheckboxItem checked={showRulers} onCheckedChange={setShowRulers}>
        <MenuCheckboxItemIndicator />
        Show rulers
      </MenuCheckboxItem>
    </MenuGroup>
  );
}

function Radios() {
  return (
    <MenuRadioGroup defaultValue="name">
      <MenuGroupLabel>Sort by</MenuGroupLabel>
      {["Name", "Date", "Size"].map((label) => (
        <MenuRadioItem key={label} value={label.toLowerCase()}>
          <MenuRadioItemIndicator />
          {label}
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
}

/** A menu opened from a Button. Its popup portals into the preview island. */
export function MenuDemo({
  modal = true,
  disabled = false,
  triggerLabel = "Actions",
  content = "actions",
}: MenuDemoProps) {
  return (
    <div data-focus-island>
      <MenuRoot key={content} modal={modal} disabled={disabled}>
        <MenuTrigger render={<Button variant="secondary">{triggerLabel}</Button>} />
        <MenuPortal>
          <MenuPositioner sideOffset={8}>
            <MenuPopup>
              {content === "checkboxes" ? <Checkboxes /> : null}
              {content === "radios" ? <Radios /> : null}
              {content === "actions" || content === "submenu" ? (
                <>
                  <MenuItem>Edit</MenuItem>
                  <MenuItem>Duplicate</MenuItem>
                  {content === "submenu" ? (
                    <MenuSubmenuRoot>
                      <MenuSubmenuTrigger>Share</MenuSubmenuTrigger>
                      <MenuPortal>
                        <MenuPositioner>
                          <MenuPopup>
                            <MenuItem>Copy link</MenuItem>
                            <MenuItem>Email</MenuItem>
                          </MenuPopup>
                        </MenuPositioner>
                      </MenuPortal>
                    </MenuSubmenuRoot>
                  ) : (
                    <MenuItem>Share</MenuItem>
                  )}
                  <MenuSeparator />
                  <MenuItem>Delete</MenuItem>
                </>
              ) : null}
            </MenuPopup>
          </MenuPositioner>
        </MenuPortal>
      </MenuRoot>
    </div>
  );
}

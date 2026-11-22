"use client";
import {
  MenuItem,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuRoot,
  MenuSeparator,
} from "../menu-parts";
import { MenubarRoot, MenubarTrigger } from "../menubar-parts";

/** Props of the demo: the Menubar props it exposes. */
export type MenubarDemoProps = {
  /** Make the page behind an open menu inert. */
  modal?: boolean;
  /** Stop every menu in the bar from opening. */
  disabled?: boolean;
  /** The direction the bar runs, which also sets the arrow keys that move between menus. */
  orientation?: "horizontal" | "vertical";
  /** Wrap focus from the last menu back to the first, and the reverse. */
  loopFocus?: boolean;
};

const MENUS = [
  { label: "File", items: ["New", "Open…", "-", "Save"] },
  { label: "Edit", items: ["Undo", "Redo", "-", "Cut", "Copy", "Paste"] },
  { label: "View", items: ["Zoom In", "Zoom Out", "Reset Zoom"] },
] as const;

/** A File, Edit and View menu bar. Each popup portals into the preview island. */
export function MenubarDemo({
  modal = true,
  disabled = false,
  orientation = "horizontal",
  loopFocus = true,
}: MenubarDemoProps) {
  return (
    <div data-focus-island>
      <MenubarRoot
        modal={modal}
        disabled={disabled}
        orientation={orientation}
        loopFocus={loopFocus}
      >
        {MENUS.map((menu) => (
          <MenuRoot key={menu.label}>
            <MenubarTrigger>{menu.label}</MenubarTrigger>
            <MenuPortal>
              <MenuPositioner sideOffset={8}>
                <MenuPopup>
                  {menu.items.map((item, index) =>
                    item === "-" ? (
                      // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of separators
                      <MenuSeparator key={index} />
                    ) : (
                      <MenuItem key={item}>{item}</MenuItem>
                    ),
                  )}
                </MenuPopup>
              </MenuPositioner>
            </MenuPortal>
          </MenuRoot>
        ))}
      </MenubarRoot>
    </div>
  );
}

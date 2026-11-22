"use client";
import type { Toolbar } from "@workspace/ui/components/toolbar";
import type { ComponentProps } from "react";
import {
  ToolbarButton,
  ToolbarGroup,
  ToolbarInput,
  ToolbarLink,
  ToolbarRoot,
  ToolbarSeparator,
} from "../toolbar-parts";

type ToolbarRootProps = ComponentProps<typeof Toolbar.Root>;

/** Props of the demo: the Toolbar props it exposes. */
export type ToolbarDemoProps = Pick<ToolbarRootProps, "orientation" | "disabled" | "loopFocus">;

/** A formatting Toolbar: two groups, a separator, a search input and a link. */
export function ToolbarDemo({
  orientation = "horizontal",
  disabled = false,
  loopFocus = true,
}: ToolbarDemoProps) {
  return (
    <div data-focus-island>
      <ToolbarRoot
        aria-label="Formatting"
        orientation={orientation}
        disabled={disabled}
        loopFocus={loopFocus}
      >
        <ToolbarGroup>
          <ToolbarButton aria-pressed="true">Bold</ToolbarButton>
          <ToolbarButton>Italic</ToolbarButton>
          <ToolbarButton>Underline</ToolbarButton>
        </ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarGroup>
          <ToolbarButton>Left</ToolbarButton>
          <ToolbarButton>Center</ToolbarButton>
          <ToolbarButton>Right</ToolbarButton>
        </ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarInput aria-label="Search" placeholder="Search" defaultValue="" />
        <ToolbarLink
          href="https://base-ui.com/react/components/toolbar"
          target="_blank"
          rel="noreferrer"
        >
          Docs
        </ToolbarLink>
      </ToolbarRoot>
    </div>
  );
}

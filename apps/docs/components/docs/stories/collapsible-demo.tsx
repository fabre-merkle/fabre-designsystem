"use client";
import { Button } from "@workspace/ui/components/button";
import type { Collapsible } from "@workspace/ui/components/collapsible";
import type { ComponentProps } from "react";
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from "../collapsible-parts";

type CollapsibleRootProps = ComponentProps<typeof Collapsible.Root>;

/** Props of the demo: the Collapsible props it exposes, then the demo-only settings (see `demoArgs`). */
export type CollapsibleDemoProps = Pick<CollapsibleRootProps, "defaultOpen" | "disabled"> & {
  /** Let the browser's find-in-page open the panel when the match is inside it (a Panel prop). */
  hiddenUntilFound?: boolean;
};

/** A Collapsible with a Button trigger. It is keyed by `defaultOpen` so the control resets it. */
export function CollapsibleDemo({
  defaultOpen = false,
  disabled = false,
  hiddenUntilFound = false,
}: CollapsibleDemoProps) {
  return (
    <div data-focus-island>
      <CollapsibleRoot key={`${defaultOpen}`} defaultOpen={defaultOpen} disabled={disabled}>
        <CollapsibleTrigger render={<Button variant="secondary">Toggle details</Button>} />
        <CollapsiblePanel hiddenUntilFound={hiddenUntilFound}>
          <div>
            Collapsible reveals a single panel of content under a trigger. Use it for inline
            progressive disclosure where the contents stay in the document flow.
          </div>
        </CollapsiblePanel>
      </CollapsibleRoot>
    </div>
  );
}

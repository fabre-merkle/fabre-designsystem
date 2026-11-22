"use client";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field } from "@workspace/ui/components/field";
import {
  DrawerBackdrop,
  DrawerClose,
  DrawerDescription,
  DrawerPopup,
  DrawerPortal,
  DrawerRoot,
  DrawerTitle,
  DrawerTrigger,
  DrawerViewport,
} from "../drawer-parts";

/** Props of the demo: the Drawer props it exposes, then the demo-only copy (see `demoArgs`). */
export type DrawerDemoProps = {
  /** The trigger button label. */
  triggerLabel?: string;
  /** The drawer title. */
  title?: string;
  /** The drawer description. */
  description?: string;
  /** The viewport edge the drawer docks to. */
  side?: "down" | "up" | "left" | "right";
  /** Whether the page behind is inert and focus is trapped. */
  modal?: boolean;
  /** Keep the drawer open on an outside click. */
  disablePointerDismissal?: boolean;
};

const OPTIONS = [
  { name: "email", label: "Email notifications", hint: "Receive updates by email", on: true },
  { name: "push", label: "Push notifications", hint: "Get notified in your browser", on: true },
  { name: "digest", label: "Weekly digest", hint: "A summary sent every Monday", on: false },
] as const;

/** A preferences drawer. Its popup portals into the preview island, so it renders as a project gets it. */
export function DrawerDemo({
  triggerLabel = "Open drawer",
  title = "Notification preferences",
  description = "Choose how and when you'd like to be notified.",
  side = "down",
  modal = true,
  disablePointerDismissal = false,
}: DrawerDemoProps) {
  const horizontal = side === "down" || side === "up";
  return (
    <div data-focus-island>
      <DrawerRoot
        key={side}
        side={side}
        modal={modal}
        disablePointerDismissal={disablePointerDismissal}
      >
        <DrawerTrigger render={<Button>{triggerLabel}</Button>} />
        <DrawerPortal>
          <DrawerBackdrop />
          <DrawerViewport>
            <DrawerPopup>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--spacing-400)",
                  width: "100%",
                  maxWidth: horizontal ? "60%" : undefined,
                  marginInline: horizontal ? "auto" : undefined,
                }}
              >
                <DrawerTitle>{title}</DrawerTitle>
                <DrawerDescription>{description}</DrawerDescription>
                {OPTIONS.map((option) => (
                  <Field.Root
                    key={option.name}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: "var(--spacing-300)",
                    }}
                  >
                    <Checkbox name={option.name} defaultChecked={option.on} />
                    <span style={{ display: "flex", flexDirection: "column" }}>
                      <Field.Label>{option.label}</Field.Label>
                      <Field.Description>{option.hint}</Field.Description>
                    </span>
                  </Field.Root>
                ))}
                <div
                  style={{ display: "flex", gap: "var(--spacing-200)", justifyContent: "center" }}
                >
                  <DrawerClose
                    render={
                      <Button variant="secondary" mode="ghost">
                        Cancel
                      </Button>
                    }
                  />
                  <DrawerClose render={<Button>Save preferences</Button>} />
                </div>
              </div>
            </DrawerPopup>
          </DrawerViewport>
        </DrawerPortal>
      </DrawerRoot>
    </div>
  );
}

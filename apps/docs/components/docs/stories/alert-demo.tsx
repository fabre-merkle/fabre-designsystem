"use client";
import { Lightbulb } from "@phosphor-icons/react/dist/ssr";
import { Alert, type AlertProps } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";

/** Props of the demo: the Alert props it exposes, then the demo-only settings (see `demoArgs`). */
export type AlertDemoProps = Pick<AlertProps, "intent"> & {
  /** The headline above the description. */
  title?: string;
  /** The description, passed as the Alert's children. */
  description?: string;
  /** The leading icon: the intent's default, or a Phosphor icon passed as the first child. */
  icon?: "default" | "custom";
  /** Add Save and Discard buttons under the description. */
  showActions?: boolean;
};

/** One Alert. A custom icon is the first child; the actions setting maps to the `actions` prop. */
export function AlertDemo({
  intent = "info",
  title = "Heads up",
  description = "A new token release is available.",
  icon = "default",
  showActions = false,
}: AlertDemoProps) {
  return (
    <div data-focus-island>
      <div style={{ width: "100%", maxWidth: "36rem" }}>
        <Alert
          intent={intent}
          title={title}
          actions={
            showActions ? (
              <>
                <Button size="sm" variant="primary" mode="filled">
                  Save
                </Button>
                <Button size="sm" variant="secondary" mode="stroke">
                  Discard
                </Button>
              </>
            ) : undefined
          }
        >
          {icon === "custom" ? <Lightbulb weight="fill" /> : null}
          {description}
        </Alert>
      </div>
    </div>
  );
}

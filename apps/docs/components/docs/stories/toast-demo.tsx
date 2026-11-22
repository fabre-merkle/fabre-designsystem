"use client";
import { Button } from "@workspace/ui/components/button";
import {
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
  useToastManager,
} from "../toast-parts";

/** Props of the demo: the Toast props it exposes, then the demo-only copy (see `demoArgs`). */
export type ToastDemoProps = {
  /** The trigger button label. */
  triggerLabel?: string;
  /** The toast title. */
  title?: string;
  /** The toast description. */
  description?: string;
  /** Add an Undo action to the toast. */
  showAction?: boolean;
  /** Milliseconds before a toast dismisses itself. `0` keeps it until it is closed. */
  timeout?: number;
  /** The most toasts shown at once. */
  limit?: number;
};

type ToastCopy = Pick<ToastDemoProps, "triggerLabel" | "title" | "description" | "showAction">;

function ToastList() {
  const { toasts } = useToastManager();
  return (
    <>
      {toasts.map((toast) => (
        <ToastRoot key={toast.id} toast={toast}>
          <ToastContent>
            {toast.title ? <ToastTitle /> : null}
            {toast.description ? <ToastDescription /> : null}
            {toast.actionProps ? <ToastAction /> : null}
          </ToastContent>
          <ToastClose aria-label="Close" />
        </ToastRoot>
      ))}
    </>
  );
}

function ToastTrigger({ triggerLabel, title, description, showAction }: ToastCopy) {
  const manager = useToastManager();
  return (
    <Button
      onClick={() =>
        manager.add({
          title,
          description,
          actionProps: showAction ? { children: "Undo" } : undefined,
        })
      }
    >
      {triggerLabel}
    </Button>
  );
}

/** A button that queues a toast. The viewport portals into the preview island. */
export function ToastDemo({
  triggerLabel = "Show toast",
  title = "Changes saved",
  description = "Your workspace settings have been updated.",
  showAction = false,
  timeout = 5000,
  limit = 3,
}: ToastDemoProps) {
  return (
    <div data-focus-island>
      <ToastProvider timeout={timeout} limit={limit}>
        <ToastTrigger
          triggerLabel={triggerLabel}
          title={title}
          description={description}
          showAction={showAction}
        />
        <ToastPortal>
          <ToastViewport>
            <ToastList />
          </ToastViewport>
        </ToastPortal>
      </ToastProvider>
    </div>
  );
}

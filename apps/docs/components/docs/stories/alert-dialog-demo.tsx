"use client";
import { Button } from "@workspace/ui/components/button";
import {
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../alert-dialog-parts";

/** Props of the demo: AlertDialog has no props of its own, so these shape the example (see `demoArgs`). */
export type AlertDialogDemoProps = {
  /** The trigger button label. */
  triggerLabel?: string;
  /** The dialog title. */
  title?: string;
  /** The dialog description. */
  description?: string;
  /** Label of the confirm action. */
  confirmLabel?: string;
  /** Label of the cancel action. */
  cancelLabel?: string;
  /** The look of the confirm action: `destructive` for data loss, `primary` otherwise. */
  tone?: "destructive" | "primary";
  /** Offer a Cancel action next to the confirm action. Without it the dialog only acknowledges. */
  showCancel?: boolean;
};

/** A confirmation dialog. Its popup portals into the preview island, so it renders as a project gets it. */
export function AlertDialogDemo({
  triggerLabel = "Delete account",
  title = "Delete account?",
  description = "This action is permanent. All of your data will be removed from our servers and cannot be recovered.",
  confirmLabel = "Delete",
  cancelLabel = "Keep account",
  tone = "destructive",
  showCancel = true,
}: AlertDialogDemoProps) {
  const variant = tone === "destructive" ? "destructive" : "primary";
  return (
    <div data-focus-island>
      <AlertDialogRoot>
        <AlertDialogTrigger render={<Button variant={variant}>{triggerLabel}</Button>} />
        <AlertDialogPortal>
          <AlertDialogBackdrop />
          <AlertDialogPopup>
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {showCancel ? (
                <AlertDialogClose
                  render={
                    <Button variant="secondary" mode="ghost">
                      {cancelLabel}
                    </Button>
                  }
                />
              ) : null}
              <AlertDialogClose render={<Button variant={variant}>{confirmLabel}</Button>} />
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialogPortal>
      </AlertDialogRoot>
    </div>
  );
}

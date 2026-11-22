"use client";
import { Button } from "@workspace/ui/components/button";
import {
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "../dialog-parts";

/** Props of the demo: the Dialog props it exposes, then the demo-only copy (see `demoArgs`). */
export type DialogDemoProps = {
  /** The trigger button label. */
  triggerLabel?: string;
  /** The dialog title. */
  title?: string;
  /** The dialog description. */
  description?: string;
  /** Label of the destructive action. */
  confirmLabel?: string;
  /** Whether the page behind is inert and focus is trapped. */
  modal?: boolean;
  /** Keep the dialog open on an outside click. */
  disablePointerDismissal?: boolean;
};

/** A confirm dialog. Its popup portals into the preview island, so it renders as a project gets it. */
export function DialogDemo({
  triggerLabel = "Open dialog",
  title = "Confirm action",
  description = "This will permanently remove the selected item. You can't undo this.",
  confirmLabel = "Delete",
  modal = true,
  disablePointerDismissal = false,
}: DialogDemoProps) {
  return (
    <div data-focus-island>
      <DialogRoot modal={modal} disablePointerDismissal={disablePointerDismissal}>
        <DialogTrigger render={<Button>{triggerLabel}</Button>} />
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose
                render={
                  <Button variant="secondary" mode="ghost">
                    Cancel
                  </Button>
                }
              />
              <DialogClose render={<Button variant="destructive">{confirmLabel}</Button>} />
            </DialogFooter>
          </DialogPopup>
        </DialogPortal>
      </DialogRoot>
    </div>
  );
}

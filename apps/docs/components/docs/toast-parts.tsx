"use client";
import { Button } from "@workspace/ui/components/button";
import { Toast } from "@workspace/ui/components/toast";

export const ToastProvider = Toast.Provider;
export const ToastViewport = Toast.Viewport;
export const ToastPortal = Toast.Portal;
export const ToastPositioner = Toast.Positioner;
export const ToastRoot = Toast.Root;
export const ToastContent = Toast.Content;
export const ToastTitle = Toast.Title;
export const ToastDescription = Toast.Description;
export const ToastAction = Toast.Action;
export const ToastClose = Toast.Close;
export const ToastArrow = Toast.Arrow;
export const useToastManager = Toast.useToastManager;

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return (
    <>
      {toasts.map((toast) => (
        <Toast.Root key={toast.id} toast={toast}>
          <Toast.Content>
            {toast.title ? <Toast.Title /> : null}
            {toast.description ? <Toast.Description /> : null}
          </Toast.Content>
          <Toast.Close aria-label="Close" />
        </Toast.Root>
      ))}
    </>
  );
}

function ToastTriggerButton() {
  const toastManager = Toast.useToastManager();
  return (
    <Button
      onClick={() =>
        toastManager.add({
          title: "Changes saved",
          description: "Your workspace settings have been updated.",
        })
      }
    >
      Show toast
    </Button>
  );
}

export function ToastDemo() {
  return (
    <Toast.Provider>
      <ToastTriggerButton />
      <Toast.Portal>
        <Toast.Viewport>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

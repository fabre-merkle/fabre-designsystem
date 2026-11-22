import "./component-preview.css";
import type { ReactNode } from "react";

type ComponentPreviewProps = {
  children: ReactNode;
  /** Use on variant section previews — reduces vertical padding */
  variant?: boolean;
};

export function ComponentPreview({ children, variant }: ComponentPreviewProps) {
  return (
    <div data-component-preview data-variant-preview={variant || undefined} data-focus-island>
      {children}
    </div>
  );
}

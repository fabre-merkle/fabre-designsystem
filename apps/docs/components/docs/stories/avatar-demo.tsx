"use client";
import type { AvatarProps } from "@workspace/ui/components/avatar";
import { AvatarFallback, AvatarImage, AvatarRoot } from "../avatar-parts";

/** Props of the demo: the Avatar props it exposes, then the demo-only settings (see `demoArgs`). */
export type AvatarDemoProps = Pick<AvatarProps, "size" | "shape"> & {
  /** The fallback text, shown with no photo or while it loads. */
  initials?: string;
  /** Load a photo. Off, only the fallback renders. */
  showImage?: boolean;
};

/** One Avatar with an optional photo and a fallback. */
export function AvatarDemo({
  size = "md",
  shape = "circle",
  initials = "AL",
  showImage = true,
}: AvatarDemoProps) {
  return (
    <div data-focus-island>
      <AvatarRoot size={size} shape={shape}>
        {showImage ? (
          <AvatarImage src="https://i.pravatar.cc/80?img=12" alt="Ada Lovelace" />
        ) : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </AvatarRoot>
    </div>
  );
}

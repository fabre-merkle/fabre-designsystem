"use client";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { MarkdownCopyButton } from "fumadocs-ui/layouts/docs/page";

/**
 * "Copy as Markdown" and "View as Markdown" for a docs page. Deliberately not
 * `ViewOptionsPopover`, which adds "Open in ChatGPT / Claude / Cursor" links: those hand the
 * page URL to a third-party service that cannot read it.
 */
export function PageActions({ markdownUrl }: { markdownUrl: string }) {
  return (
    <div className="flex flex-row flex-wrap items-center gap-2 border-b pb-6">
      <MarkdownCopyButton markdownUrl={markdownUrl}>Copy as Markdown</MarkdownCopyButton>
      <a href={markdownUrl} className={buttonVariants({ variant: "secondary", size: "sm" })}>
        View as Markdown
      </a>
    </div>
  );
}

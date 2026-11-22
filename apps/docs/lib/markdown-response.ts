/**
 * Headers for every Markdown response. The Markdown forms serve the same audience as the
 * pages, so they are never stored by a shared cache and vary on `Accept`.
 */
export const MARKDOWN_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Accept",
  "X-Content-Type-Options": "nosniff",
} as const;

export function markdownResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { ...MARKDOWN_HEADERS, "Content-Type": "text/markdown; charset=utf-8" },
  });
}

export function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { ...MARKDOWN_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** The `.md` URL of a page URL: `/docs` becomes `/docs.md`, `/docs/a` becomes `/docs/a.md`. */
export function markdownUrl(pageUrl: string): string {
  return `${pageUrl.replace(/\/$/, "")}.md`;
}

/** Point every page link of an `llms.txt` index at the page's `.md` URL. */
export function withMarkdownLinks(index: string): string {
  return index.replace(
    /\]\((\/docs(?:\/[^)\s]*)?)\)/g,
    (_, url: string) => `](${markdownUrl(url)})`,
  );
}

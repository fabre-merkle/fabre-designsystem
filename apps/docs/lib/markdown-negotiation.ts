import { isMarkdownPreferred } from "fumadocs-core/negotiation";
import { type NextRequest, NextResponse } from "next/server";

/** The route that renders a docs page as Markdown (`app/llms.mdx/docs/[[...slug]]`). */
export const MARKDOWN_ROUTE = "/llms.mdx";

/** The Markdown route for a docs page path, or `false` when the path is not a docs page. */
export function markdownRouteFor(pathname: string): string | false {
  // A `.md` URL asked for with `Accept: text/markdown` names the page, not a slug ending in `.md`.
  const path = pathname.replace(/\/$/, "").replace(/\.md$/, "");
  if (path === "/docs") return `${MARKDOWN_ROUTE}/docs`;
  if (!path.startsWith("/docs/")) return false;
  return `${MARKDOWN_ROUTE}${path}`;
}

/** `NextResponse.next()` is the only response that lets the request continue to the app. */
function continues(response: Response): boolean {
  return response.headers.has("x-middleware-next");
}

/**
 * Rewrite a docs page request to its Markdown form when the client prefers Markdown
 * (`Accept: text/markdown`). `response` is the pass-through response of the access check; its
 * headers (refreshed session cookies, forwarded request headers) carry over to the rewrite.
 */
export function negotiateMarkdown(request: NextRequest, response: NextResponse): NextResponse {
  if (!["GET", "HEAD"].includes(request.method)) return response;
  const target = markdownRouteFor(request.nextUrl.pathname);
  if (!target) return response;
  response.headers.append("Vary", "Accept");
  if (!isMarkdownPreferred(request)) return response;

  const url = request.nextUrl.clone();
  url.pathname = target;
  const rewrite = NextResponse.rewrite(url);
  response.headers.forEach((value, key) => {
    if (key === "x-middleware-next" || key === "set-cookie") return;
    rewrite.headers.set(key, value);
  });
  for (const cookie of response.headers.getSetCookie())
    rewrite.headers.append("set-cookie", cookie);
  return rewrite;
}

/**
 * Put Markdown negotiation behind an access check. `gate` is the project's own proxy
 * (a login redirect, a 403, or pass-through): negotiation runs only when it lets the request
 * continue, so a client that asks for Markdown is turned away exactly like one that asks for HTML.
 */
export function withMarkdownNegotiation(
  gate: (request: NextRequest) => Promise<Response> | Response,
): (request: NextRequest) => Promise<Response> {
  return async (request) => {
    const response = await gate(request);
    if (!continues(response)) return response;
    return negotiateMarkdown(request, response as NextResponse);
  };
}

import { NextResponse } from "next/server";
import { withMarkdownNegotiation } from "./lib/markdown-negotiation";

// Serves a docs page as Markdown when the client sends `Accept: text/markdown`.
//
// This project adds no login. If the docs sit behind your own access check, wrap that check
// instead, so negotiation runs only after it lets the request through. Keep the matcher below
// (or one that covers the same paths) so the llms routes sit behind that check too:
//
//   export default withMarkdownNegotiation(yourAccessCheck);
export default withMarkdownNegotiation(() => NextResponse.next());

export const config = {
  matcher: ["/docs", "/docs.md", "/docs/:path*", "/llms.txt", "/llms-full.txt", "/llms.mdx/:path*"],
};

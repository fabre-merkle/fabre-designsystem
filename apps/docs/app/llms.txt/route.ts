import { llmsRenderer } from "../../lib/llms";
import { textResponse, withMarkdownLinks } from "../../lib/markdown-response";

// Read per request, never prerendered or cached: the response is for signed-in readers only.
export const dynamic = "force-dynamic";

export async function GET() {
  return textResponse(withMarkdownLinks(await llmsRenderer.index()));
}

import { llmsRenderer } from "../../lib/llms";
import { textResponse } from "../../lib/markdown-response";

export const dynamic = "force-dynamic";

export async function GET() {
  return textResponse(await llmsRenderer.full());
}

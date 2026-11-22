import { markdownResponse } from "../../../../lib/markdown-response";
import { getPageMarkdown } from "../../../../lib/page-markdown";
import { source } from "../../../../lib/source";

// Reached through the `.md` rewrite and Accept negotiation, both behind the access check.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, props: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await props.params;
  const page = source.getPage(slug);
  if (!page) return markdownResponse("# Not found\n", 404);
  return markdownResponse(await getPageMarkdown(page));
}

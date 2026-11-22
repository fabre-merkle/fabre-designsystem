import { createFromSource } from "fumadocs-core/search/server";
import { source } from "../../../lib/source";

// A page title, its headings and its body text are separate index entries in one field, so a
// field boost cannot tell them apart; a custom `sortBy` can. A title hit then outranks the same
// score from a heading, and a heading outranks body text. Results stay grouped by page.
const TYPE_WEIGHT: Record<string, number> = { page: 4, heading: 2, text: 1 };

// Backs the Fumadocs search dialog (RootProvider fetches /api/search). Relative
// import (not `@/`) so the path survives shadcn's monorepo import rewriting.
export const { GET } = createFromSource(source, {
  search: {
    sortBy: ([, scoreA, docA], [, scoreB, docB]) =>
      scoreB * (TYPE_WEIGHT[docB.type] ?? 1) - scoreA * (TYPE_WEIGHT[docA.type] ?? 1),
  },
});

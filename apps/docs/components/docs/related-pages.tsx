import { asMarkdown, md } from "fumadocs-core/server";
import { Card } from "fumadocs-ui/components/card";
import type { ReactNode } from "react";

type ResolvePage = (href: string) => string | undefined;
type RelatedPageProps = { href: string; children: ReactNode };
type RelatedCardProps = RelatedPageProps & { title: string };

function resolveHref(resolve: ResolvePage, href: string): string | undefined {
  const suffixStart = href.search(/[?#]/);
  const path = suffixStart === -1 ? href : href.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? "" : href.slice(suffixStart);
  if (!path.startsWith("/") || path.startsWith("//")) return undefined;
  const normalizedPath = path.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  const url = resolve(normalizedPath);
  return url ? `${url}${suffix}` : undefined;
}

/** Related content only appears when its destination exists in the current documentation. */
export function relatedPageComponents(resolve: ResolvePage) {
  function RelatedPage({ href, children }: RelatedPageProps) {
    const url = resolveHref(resolve, href);
    return url ? (
      <p>
        <a href={url}>{children}</a>
      </p>
    ) : null;
  }

  function RelatedCard({ href, title, children }: RelatedCardProps) {
    const url = resolveHref(resolve, href);
    return url ? <Card href={url} title={title} description={children} /> : null;
  }

  return { RelatedPage, RelatedCard };
}

/** Preserve the same availability decisions for agent-readable Markdown. */
export function relatedPageMarkdownComponents(resolve: ResolvePage) {
  async function RelatedPage({ href, children }: RelatedPageProps) {
    asMarkdown();
    const url = resolveHref(resolve, href);
    if (!url) return "";
    return `\n[${(await md`${children}`).trim()}](${url})\n\n`;
  }

  async function RelatedCard({ href, title, children }: RelatedCardProps) {
    asMarkdown();
    const url = resolveHref(resolve, href);
    if (!url) return "";
    return `- [${title}](${url}): ${(await md`${children}`).trim()}\n`;
  }

  return { RelatedPage, RelatedCard };
}

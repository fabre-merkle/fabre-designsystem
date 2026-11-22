import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { notFound, redirect } from "next/navigation";
import { tokenReferenceToc } from "../../../components/docs/token-reference";
import { PageActions } from "../../../components/page-actions";
import { source } from "../../../lib/source";
import { getMDXComponents } from "../../../mdx-components";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    if (params.slug?.length) notFound();
    const first = source.getPages().find((candidate) => candidate.url !== "/docs");
    if (first) redirect(first.url);
    return (
      <DocsPage toc={[]}>
        <DocsTitle>Documentation</DocsTitle>
        <DocsBody>
          <p>No documentation pages have been added yet.</p>
        </DocsBody>
      </DocsPage>
    );
  }

  const MDX = page.data.body;
  const toc = [...tokenReferenceToc(await page.data.getText("raw")), ...page.data.toc];

  return (
    <DocsPage toc={toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <PageActions markdownUrl={`${page.url}.md`} />
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  const params = source.generateParams();
  return source.getPage([]) ? params : [...params, { slug: [] }];
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    if (params.slug?.length) notFound();
    return { title: "Documentation" };
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
}

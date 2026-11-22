import { remarkHeading } from "fumadocs-core/mdx-plugins";
import { asMarkdown } from "fumadocs-core/server";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TokenCategory } from "../../lib/design-tokens";
import { type ProjectDocumentProps, readProjectDocument } from "../../lib/project-document";
import { documentationHref } from "../../lib/project-document-data";
import { TypographyExamples } from "./foundation-examples";
import { TokenReference } from "./token-reference";

type DocumentPart =
  | { key: string; markdown: string }
  | {
      key: string;
      category: TokenCategory;
      selection: { name: string; description: string }[];
    };

function documentParts(body: string, design: boolean): DocumentPart[] {
  if (!design) return [{ key: "markdown:0", markdown: body }];
  const categories = ["colour", "typography", "spacing-sizing", "elevation", "radius"] as const;
  const lines = body.split("\n");
  const parts: DocumentPart[] = [];
  let start = 0;
  let fence: { character: string; length: number } | undefined;
  for (let index = 0; index < lines.length; index++) {
    const delimiter = /^ {0,3}(`{3,}|~{3,})/.exec(lines[index])?.[1];
    if (delimiter) {
      if (!fence) fence = { character: delimiter[0], length: delimiter.length };
      else if (delimiter[0] === fence.character && delimiter.length >= fence.length)
        fence = undefined;
      continue;
    }
    if (fence) continue;
    const marker = /^<!-- design-reference:start ([\w-]+) -->$/.exec(lines[index]);
    const category = categories.find((candidate) => candidate === marker?.[1]);
    if (!category) continue;
    const end = lines.indexOf("<!-- design-reference:end -->", index + 1);
    if (end < 0) throw new Error(`Unclosed DESIGN.md quick reference: ${category}`);
    const selection = lines.slice(index + 1, end).flatMap((line) => {
      const cells = line.split(/(?<!\\)\|/);
      const name = /^`([^`]+)`$/.exec(cells[1]?.trim() ?? "")?.[1];
      return name ? [{ name, description: (cells[3] ?? "").trim().replace(/\\\|/g, "|") }] : [];
    });
    if (!selection.length) throw new Error(`Empty DESIGN.md quick reference: ${category}`);
    parts.push(
      { key: `markdown:${start}`, markdown: lines.slice(start, index).join("\n") },
      { key: `reference:${index}`, category, selection },
    );
    start = end + 1;
    index = end;
  }
  parts.push({ key: `markdown:${start}`, markdown: lines.slice(start).join("\n") });
  return parts;
}

export async function ProjectDocument(props: ProjectDocumentProps) {
  const document = await readProjectDocument(props);
  const filename = document.path.split("/").at(-1);
  return (
    <Tabs items={["Rendered", `Raw ${filename}`]} data-docs-tabs="">
      <Tab value="Rendered">
        {documentParts(document.body, props.kind === "design").map((part) =>
          "category" in part ? (
            <TokenReference key={part.key} category={part.category} selection={part.selection}>
              {part.category === "typography" ? <TypographyExamples /> : null}
            </TokenReference>
          ) : (
            <Markdown
              key={part.key}
              remarkPlugins={[remarkGfm, [remarkHeading, { generateToc: false }]]}
              components={{
                h1: ({ id, children }) => <h3 id={id}>{children}</h3>,
                h2: ({ id, children }) => <h4 id={id}>{children}</h4>,
                h3: ({ id, children }) => <h5 id={id}>{children}</h5>,
                pre: ({ children }) => (
                  <CodeBlock>
                    <Pre>{children}</Pre>
                  </CodeBlock>
                ),
                table: ({ children }) => <table data-docs-table="">{children}</table>,
                a: ({ href, children }) => {
                  const url = documentationHref(href);
                  return url ? (
                    <a href={url}>{children}</a>
                  ) : (
                    <span>
                      {children} (<code>{href}</code> in the project source)
                    </span>
                  );
                },
              }}
            >
              {part.markdown}
            </Markdown>
          ),
        )}
      </Tab>
      <Tab value={`Raw ${filename}`}>
        <ServerCodeBlock
          code={document.raw}
          lang="md"
          codeblock={{ title: document.path }}
          themes={{ light: "github-light", dark: "github-dark" }}
        />
      </Tab>
    </Tabs>
  );
}

export async function ProjectDocumentMarkdown(props: ProjectDocumentProps) {
  asMarkdown();
  return `\n${(await readProjectDocument(props)).raw.trim()}\n\n`;
}

import "./component-showcase.css";
import { readFile } from "node:fs/promises";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import type { ReactNode } from "react";
import { type ComponentFile, componentRegistry } from "../../lib/component-registry";
import { ShowcaseTabs } from "./showcase-tabs.client";

type ComponentShowcaseProps = {
  name: string;
  /**
   * Render `children` as the Preview tab as they are, without the preview island around them. For
   * a story panel (`DocsStory`), which carries its own controls.
   */
  bare?: boolean;
  children?: ReactNode;
};

export async function ComponentShowcase({ name, bare, children }: ComponentShowcaseProps) {
  const entry = componentRegistry[name];
  if (!entry) throw new Error(`Unknown component in registry: ${name}`);
  const langLabels: Record<ComponentFile["lang"], string> = {
    tsx: "TypeScript",
    css: "CSS",
  };
  const langCount = (lang: ComponentFile["lang"]) =>
    entry.files.filter((file) => file.lang === lang).length;
  const fileLabels = entry.files.map((file) =>
    langCount(file.lang) > 1 ? file.name : langLabels[file.lang],
  );
  return (
    <ShowcaseTabs labels={["Preview", ...fileLabels]}>
      {bare ? (
        children
      ) : (
        <div data-component-showcase-preview data-focus-island>
          {children}
        </div>
      )}
      {entry.files.map((f) => (
        <SourceFile key={f.name} file={f} />
      ))}
    </ShowcaseTabs>
  );
}

/**
 * One source tab: the component file in Fumadocs' native code block (frame, copy button and
 * line height included), highlighted at build time with the same themes the MDX code fences use
 * (`rehypeCodeOptions` in source.config.ts).
 */
async function SourceFile({ file }: { file: ComponentFile }) {
  return (
    <ServerCodeBlock
      code={await readFile(file.path, "utf8")}
      lang={file.lang}
      themes={{ light: "github-light", dark: "github-dark" }}
    />
  );
}

import { asMarkdown, md } from "fumadocs-core/server";
import type { MDXComponents } from "mdx/types";
import { Children, isValidElement, type ReactNode } from "react";
import { markdownConfig } from "./markdown-config";

/**
 * Markdown forms of the docs components. Each calls `asMarkdown()`, so `renderToMarkdown`
 * uses its output instead of serializing the component as JSX. They are passed as the
 * `components` option of `page.data.getText("processed", …)`; the visual components on the
 * pages are unchanged.
 */

export function fence(code: string, lang = "", title?: string): string {
  const text = code.replace(/\n+$/, "");
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = "`".repeat(Math.max(3, longest + 1));
  const meta = title ? ` title=${JSON.stringify(title)}` : "";
  return `\n${ticks}${lang}${meta}\n${text}\n${ticks}\n\n`;
}

function cell(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

/** A rendered example: the JSX the author wrote, as a fenced code block. */
async function example(children: ReactNode, label?: string): Promise<string> {
  const code = (await md`${children}`).trim();
  if (!code) return "";
  return `${label ? `\n**${label}**\n` : ""}${fence(code, "tsx")}`;
}

function ComponentPreview({ children }: { children?: ReactNode }) {
  asMarkdown();
  return example(children);
}

function ComponentShowcase({
  name,
  type,
  children,
}: {
  name: string;
  type?: "block";
  children?: ReactNode;
}) {
  asMarkdown();
  if (type === "block") return `\nFull-page example: \`${name}\`.\n\n`;
  return example(children, `Example: ${name}`);
}

type TypeTableEntry = {
  type?: ReactNode;
  typeDescription?: ReactNode;
  description?: ReactNode;
  default?: ReactNode;
  required?: boolean;
  deprecated?: boolean;
};

async function TypeTable({ type }: { type: Record<string, TypeTableEntry> }) {
  asMarkdown();
  const rows = await Promise.all(
    Object.entries(type).map(async ([name, entry]) => {
      const [kind, kindDescription, description, fallback] = await Promise.all([
        md`${entry.type}`,
        md`${entry.typeDescription}`,
        md`${entry.description}`,
        md`${entry.default}`,
      ]);
      const flags = `${entry.required ? " (required)" : ""}${entry.deprecated ? " (deprecated)" : ""}`;
      const typeCell = kindDescription.trim()
        ? `\`${cell(kind)}\` (${cell(kindDescription)})`
        : `\`${cell(kind)}\``;
      const defaultCell = fallback.trim() ? `\`${cell(fallback)}\`` : "";
      return `| \`${name}\`${flags} | ${typeCell} | ${defaultCell} | ${cell(description)} |`;
    }),
  );
  return `\n| Prop | Type | Default | Description |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n\n`;
}

function Tabs({ children }: { children?: ReactNode }) {
  asMarkdown();
  return md`${children}`;
}

function Tab({ value, children }: { value?: string; children?: ReactNode }) {
  asMarkdown();
  return value ? md`\n**${value}**\n\n${children}\n` : md`${children}`;
}

async function Steps({ children }: { children?: ReactNode }) {
  asMarkdown();
  const steps = Children.toArray(children).filter(isValidElement);
  const rendered = await Promise.all(
    steps.map(async (step, index) => {
      const body = await md`${(step.props as { children?: ReactNode }).children}`;
      return `\n**Step ${index + 1}**\n\n${body.trim()}\n`;
    }),
  );
  return `${rendered.join("\n")}\n\n`;
}

function Step({ children }: { children?: ReactNode }) {
  asMarkdown();
  return md`${children}`;
}

async function Callout({
  title,
  type,
  children,
}: {
  title?: ReactNode;
  type?: string;
  children?: ReactNode;
}) {
  asMarkdown();
  const heading =
    (await md`${title}`).trim() || (type ? type[0].toUpperCase() + type.slice(1) : "");
  return md.linePrefix("> ")`${heading ? `**${heading}**\n\n` : ""}${children}`;
}

function Cards({ children }: { children?: ReactNode }) {
  asMarkdown();
  return md`\n${children}\n`;
}

async function Card({
  title,
  description,
  href,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  href?: string;
  children?: ReactNode;
}) {
  asMarkdown();
  const name = (await md`${title}`).trim();
  const summary = (await md`${description ?? children}`).trim();
  const label = href ? `[${name}](${href})` : name;
  return `- ${label}${summary ? `: ${summary.replace(/\s*\n\s*/g, " ")}` : ""}\n`;
}

export const defaultMarkdownComponents: MDXComponents = {
  ComponentPreview,
  ComponentShowcase,
  TypeTable,
  Tabs,
  Tab,
  Steps,
  Step,
  Callout,
  Cards,
  Card,
};

/** The components for `getText("processed", { components })`. */
export function getMarkdownComponents(components?: MDXComponents): MDXComponents {
  return { ...defaultMarkdownComponents, ...markdownConfig.components, ...components };
}

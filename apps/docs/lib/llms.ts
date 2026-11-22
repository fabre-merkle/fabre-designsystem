import { llms } from "fumadocs-core/source";
import { getPageMarkdown } from "./page-markdown";
import { source } from "./source";

export const llmsRenderer = llms(source, { renderPage: getPageMarkdown });

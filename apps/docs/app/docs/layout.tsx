import "./ask-ai.css";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { ProjectDocsLayout } from "../../components/ai/docs-layout";
import { source } from "../../lib/source";
import { baseOptions } from "../layout.config";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <ProjectDocsLayout tree={source.pageTree} {...baseOptions}>
      {children}
    </ProjectDocsLayout>
  );
}

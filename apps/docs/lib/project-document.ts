import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PROJECT_RUNBOOKS } from "./project-document-data";

export { PROJECT_RUNBOOKS } from "./project-document-data";

export type ProjectDocumentProps =
  | { kind: "design" }
  | { kind: "skill"; slug: string }
  | { kind: "runbook"; name: keyof typeof PROJECT_RUNBOOKS };

export async function readProjectDocument(props: ProjectDocumentProps) {
  let path: string;
  if (props.kind === "design") path = "DESIGN.md";
  else if (props.kind === "skill" && /^[a-z0-9][a-z0-9-]*$/.test(props.slug))
    path = `.agents/skills/${props.slug}/SKILL.md`;
  else if (props.kind === "runbook" && Object.hasOwn(PROJECT_RUNBOOKS, props.name))
    path = PROJECT_RUNBOOKS[props.name];
  else throw new Error("Unknown project document or invalid skill slug.");
  const raw = await readFile(resolve(process.cwd(), "../..", path), "utf8");
  return { path, raw, body: raw.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").trim() };
}

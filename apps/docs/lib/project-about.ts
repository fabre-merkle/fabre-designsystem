import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export type ProjectAboutVersionSource =
  | { kind: "package"; name: string; directories: string[] }
  | { kind: "package-manager"; name: string }
  | { kind: "standard" }
  | { kind: "service" };

export type ProjectAboutEntry = {
  id: string;
  name: string;
  role: string;
  href: string;
  version: ProjectAboutVersionSource;
};

export type ProjectAboutMetadata = {
  schemaVersion: 1;
  groups: { id: string; title: string; entries: ProjectAboutEntry[] }[];
};

export type ProjectAboutData = {
  groups: {
    id: string;
    title: string;
    entries: (Omit<ProjectAboutEntry, "version"> & { version: string })[];
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(path: string): Record<string, unknown> | undefined {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return undefined;
    throw new Error(`Could not read About metadata: ${path}`, { cause: error });
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`Malformed About metadata: ${path}`, { cause: error });
  }
  if (!isRecord(value)) throw new Error(`Expected an object in About metadata: ${path}`);
  return value;
}

const packageName = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i;
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const topicId = /^about-[a-z0-9-]+$/;
const unavailable = "Unavailable — dependency metadata not found";

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validDirectory(value: unknown): value is string {
  return text(value) && (value === "." || /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i.test(value));
}

function validSource(value: unknown): value is ProjectAboutVersionSource {
  if (!isRecord(value)) return false;
  if (value.kind === "service" || value.kind === "standard") return true;
  if (!text(value.name) || !packageName.test(value.name)) return false;
  if (value.kind === "package-manager") return true;
  return (
    value.kind === "package" &&
    Array.isArray(value.directories) &&
    value.directories.length > 0 &&
    value.directories.every(validDirectory)
  );
}

function validateMetadata(
  value: Record<string, unknown> | undefined,
  path: string,
): ProjectAboutMetadata {
  const invalid = () => new Error(`Invalid project About configuration: ${path}`);
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.groups)) throw invalid();
  const seen = new Set<string>();
  const id = (value: unknown) => {
    if (!text(value) || !topicId.test(value) || seen.has(value)) return false;
    seen.add(value);
    return true;
  };
  for (const group of value.groups) {
    if (!isRecord(group) || !id(group.id) || !text(group.title) || !Array.isArray(group.entries))
      throw invalid();
    for (const entry of group.entries) {
      if (
        !isRecord(entry) ||
        !id(entry.id) ||
        !text(entry.name) ||
        !text(entry.role) ||
        !text(entry.href) ||
        !URL.canParse(entry.href) ||
        new URL(entry.href).protocol !== "https:" ||
        !validSource(entry.version)
      )
        throw invalid();
    }
  }
  return value as ProjectAboutMetadata;
}

function declaredVersion(
  manifest: Record<string, unknown>,
  name: string,
  path: string,
): string | undefined {
  let declared: string | undefined;
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    const section = manifest[field];
    if (section === undefined) continue;
    if (!isRecord(section)) throw new Error(`Invalid ${field} in ${path}`);
    const value = section[name];
    if (value === undefined) continue;
    if (!text(value)) throw new Error(`Invalid dependency ${name} in ${path}`);
    declared ??= value;
  }
  return declared;
}

function resolvedVersion(root: string, directory: string, name: string): string | undefined {
  let current = resolve(root, directory);
  for (;;) {
    const path = join(current, "node_modules", name, "package.json");
    const installed = readRecord(path);
    if (installed) {
      if (!text(installed.version) || !exactVersion.test(installed.version)) {
        throw new Error(`Invalid installed version for ${name} in ${path}`);
      }
      return installed.version;
    }
    // Never resolve into the scaffolder or another project above this monorepo.
    if (current === root) return undefined;
    current = dirname(current);
  }
}

function versionFor(root: string, source: ProjectAboutVersionSource): string {
  if (source.kind === "service") return "Not applicable — hosted service";
  if (source.kind === "standard") return "Not applicable — standard";
  if (source.kind === "package-manager") {
    const manifest = readRecord(join(root, "package.json"));
    if (!manifest) return unavailable;
    if (manifest.packageManager !== undefined) {
      if (!text(manifest.packageManager))
        throw new Error("Invalid packageManager in project package.json");
      const prefix = `${source.name}@`;
      if (manifest.packageManager.startsWith(prefix)) {
        const version = manifest.packageManager.slice(prefix.length);
        if (!version) throw new Error("Invalid packageManager in project package.json");
        return `Declared package manager: ${version}`;
      }
    }
    if (manifest.engines !== undefined && !isRecord(manifest.engines))
      throw new Error("Invalid engines in project package.json");
    const engine = isRecord(manifest.engines) ? manifest.engines[source.name] : undefined;
    if (engine !== undefined && !text(engine))
      throw new Error(`Invalid ${source.name} engine in project package.json`);
    return text(engine) ? `Declared engine: ${engine}` : unavailable;
  }
  const versions: string[] = [];
  for (const directory of source.directories) {
    const path = resolve(root, directory, "package.json");
    const manifest = readRecord(path);
    if (!manifest) continue;
    const declared = declaredVersion(manifest, source.name, path);
    const installed = resolvedVersion(root, directory, source.name);
    if (installed) versions.push(`Resolved: ${installed} (${directory})`);
    else if (declared) versions.push(`Declared: ${declared} (${directory})`);
  }
  return versions.length ? versions.join("; ") : unavailable;
}

/** Uncached: both the HTML and Markdown build read the current project's own dependency metadata. */
export function readProjectAbout(
  docsDirectory = resolve(
    process.cwd(),
    existsSync(join(process.cwd(), "content/docs")) ? "." : "apps/docs",
  ),
): ProjectAboutData {
  const root = resolve(docsDirectory, "../..");
  if (relative(root, docsDirectory) !== join("apps", "docs"))
    throw new Error("About must be read from apps/docs");
  const path = join(docsDirectory, "project-about.json");
  const metadata = validateMetadata(readRecord(path), path);
  return {
    groups: metadata.groups.map((group) => ({
      ...group,
      entries: group.entries.map((entry) => ({
        ...entry,
        version: versionFor(root, entry.version),
      })),
    })),
  };
}

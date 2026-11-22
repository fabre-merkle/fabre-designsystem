export function cssTokenName(name: string): string {
  return `--${name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\./g, "-")
    .toLowerCase()}`;
}

export function tokenGroupId(category: string, label: string): string {
  return `${category}-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

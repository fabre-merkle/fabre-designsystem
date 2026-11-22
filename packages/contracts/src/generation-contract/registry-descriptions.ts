export interface RegistryItemLike {
  name: string;
  title?: string;
  description?: string;
}

const UI_ITEM_PREFIX = "ui-";
const UI_PACKAGE_ITEM = "ui-package";

export function registryDescriptionsBySlug(
  items: readonly RegistryItemLike[],
): ReadonlyMap<string, string> {
  const descriptions = new Map<string, string>();
  for (const item of items) {
    if (!item.name.startsWith(UI_ITEM_PREFIX) || item.name === UI_PACKAGE_ITEM) continue;
    const slug = item.name.slice(UI_ITEM_PREFIX.length);
    const description = item.description?.trim();
    if (!description) {
      throw new Error(`registry.json item "${item.name}" has no description.`);
    }
    descriptions.set(slug, description);
  }
  return descriptions;
}

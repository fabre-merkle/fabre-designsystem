import iconRegistry from "./phosphor-icons.json";
import type { IconRegistry } from "./types";

const registry = iconRegistry as IconRegistry;

export { ICON_REGISTRY_SCHEMA_VERSION, type IconRegistry } from "./types";
export { PHOSPHOR_ICON_WHITELIST } from "./whitelist";

/** Returns the icon's complete `<svg>...</svg>` element string, or `null` if unknown. */
export function resolveIconSvg(name: string): string | null {
  return registry.icons[name] ?? null;
}

export function getIconRegistry(): IconRegistry {
  return registry;
}

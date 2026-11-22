export const ICON_REGISTRY_SCHEMA_VERSION = 2 as const;

export interface IconRegistry {
  schemaVersion: typeof ICON_REGISTRY_SCHEMA_VERSION;
  phosphorVersion: string;
  /** Each value is a COMPLETE `<svg>...</svg>` element string, root attributes included. */
  icons: Record<string, string>;
}

/**
 * Where the Markdown form of `<AutoTypeTable>` gets its rows.
 *
 * Development always runs the live generator, so edits show at once and a snapshot left by an
 * earlier build is never read. Production reads the build-time snapshot only: a missing snapshot or
 * a missing entry means the build did not run `generate:prop-tables` (or the page changed since),
 * and that is an error, not a reason to start the TypeScript generator inside a request.
 */
export async function resolveTable<T>(
  key: string,
  options: {
    production: boolean;
    readSnapshot: () => Promise<Record<string, T> | undefined>;
    live: () => Promise<T>;
  },
): Promise<T> {
  if (!options.production) return options.live();
  const tables = await options.readSnapshot();
  const table = tables?.[key];
  if (!table) {
    throw new Error(
      `.generated/prop-tables.json has no table for ${key}; run generate:prop-tables before the build`,
    );
  }
  return table;
}

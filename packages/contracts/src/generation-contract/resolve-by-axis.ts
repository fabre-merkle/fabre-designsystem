export function resolveByAxis<T>(
  byAxis: { axis: string; values: Partial<Record<string, T>> } | undefined,
  base: T | undefined,
  cellKey: Readonly<Record<string, string>>,
): T | undefined {
  if (!byAxis) return base;
  return byAxis.values[cellKey[byAxis.axis]] ?? base;
}

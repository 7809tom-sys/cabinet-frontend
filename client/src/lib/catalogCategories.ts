/**
 * Returns only category labels backed by at least one sellable product in the
 * currently selected door style. The category taxonomy can be broader than a
 * particular style, so empty labels must not become dead catalog filters.
 */
export function nonEmptyStyleCategories(
  categoryNames: readonly string[],
  categoryCounts: Readonly<Record<string, number>> | null | undefined,
): string[] {
  if (!categoryCounts) return [];
  return categoryNames.filter((category) => (categoryCounts[category] ?? 0) > 0);
}

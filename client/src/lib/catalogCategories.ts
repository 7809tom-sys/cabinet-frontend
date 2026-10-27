import { catalogCategoryCount, normalizeCatalogCategoryValue } from "@shared/catalogCategorySpelling";

/**
 * Returns only category labels backed by at least one sellable product in the
 * currently selected door style. The category taxonomy can be broader than a
 * particular style, so empty labels must not become dead catalog filters.
 * Molding and Moulding count as the same category.
 */
export function nonEmptyStyleCategories(
  categoryNames: readonly string[],
  categoryCounts: Readonly<Record<string, number>> | null | undefined,
): string[] {
  if (!categoryCounts) return [];
  const seen = new Set<string>();
  return categoryNames.filter((category) => {
    const key = normalizeCatalogCategoryValue(category);
    if (seen.has(key)) return false;
    if (catalogCategoryCount(categoryCounts, category) <= 0) return false;
    seen.add(key);
    return true;
  });
}

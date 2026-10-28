export type CatalogSearchRequest =
  | { kind: "style" }
  | { kind: "catalog"; search: string }
  | { kind: "prompt" };

/**
 * Which catalog request a shopper's search box should make.
 * A door style searches that line. A query with no style searches the whole
 * public catalog. Neither one yet means the page should ask for a style.
 */
export function catalogSearchRequest(styleId: number | null, search: string): CatalogSearchRequest {
  if (styleId != null) return { kind: "style" };
  const term = search.trim();
  if (term) return { kind: "catalog", search: term };
  return { kind: "prompt" };
}

/**
 * Term sent to the public `cabinets.list` search.
 *
 * Descriptions are stored in title case ("Wall Wine Rack Cabinet", "Lattice
 * Wine Rack") and that column's match is case-sensitive until the backend
 * patch in docs/patches/cabinet-backend-catalog-search-case.patch is applied.
 * Title-casing each word makes "wine rack" match those phrases on the live
 * API. The patch lowercases both sides, so this same term still matches after
 * it ships. Digits are unchanged, so "3015" still matches WRC3015 and DN-W3015.
 */
export function catalogGlobalSearchTerm(search: string): string {
  return search.trim().replace(/\p{L}+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/**
 * Stable catalog category key for every supplier.
 *
 * Cabinet lines and non-cabinet suppliers (Pelican countertops, sinks,
 * flooring, range tops, and any later import) store the category as text.
 * This key is that text, trimmed. It is not a slug and not a numeric id.
 * Empty text is uncategorized.
 *
 * Sales forecast grouping should pair this key with the vendor scope:
 * `pelican` for the Pelican approved-vendor record (sourceKey "pelican"),
 * or `dist:<distributorId>` for a cabinet or hardware supply line.
 * Do not slugify names that contain spaces, ampersands, or parentheses.
 */
export function catalogCategoryKey(category: string | null | undefined): string | null {
  const key = category?.trim() ?? "";
  return key.length > 0 ? key : null;
}

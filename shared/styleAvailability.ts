// ─── Style availability guard ──────────────────────────────────────────────
// A door style should only be shown on public surfaces (storefront catalog +
// Design Tool picker) when it has at least one *orderable* cabinet — i.e. a
// published + available SKU on an active, in-designer, non-conflict cabinet.
//
// The DB query that computes the set of orderable styleIds lives in the server
// (server/routers/catalog.ts). This module holds the pure, DB-free filtering
// logic so it can be unit-tested in isolation and reused anywhere.

/** Minimal shape needed to filter a style by id. */
export interface HasStyleId {
  id: number;
}

/**
 * Keep only the styles whose id is present in `availableStyleIds` — the set of
 * styleIds that have at least one orderable SKU. Styles with an empty catalog
 * (e.g. a line whose SKUs were never imported) are dropped so they never reach
 * a customer. Admin/back-office callers should NOT use this filter.
 */
export function filterStylesByAvailability<T extends HasStyleId>(
  styles: readonly T[],
  availableStyleIds: ReadonlySet<number>
): T[] {
  return styles.filter((s) => availableStyleIds.has(s.id));
}

/**
 * True when a single style is orderable (has at least one available SKU).
 * Handy for guarding a style-detail page.
 */
export function isStyleAvailable(
  styleId: number,
  availableStyleIds: ReadonlySet<number>
): boolean {
  return availableStyleIds.has(styleId);
}

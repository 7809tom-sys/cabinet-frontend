/**
 * The public priced list is the sellable set. A door style opened from Featured
 * Styles stays sellable for this session once `doorStyles.byId` loads it, and
 * while that lookup is still running. A restored historic finish is unchanged.
 */
export function sessionSellableStyleIds(
  catalogStyleIds: readonly number[],
  opened: { styleId: number; usable: boolean } | null,
): number[] {
  if (!opened?.usable || catalogStyleIds.includes(opened.styleId)) return [...catalogStyleIds];
  return [...catalogStyleIds, opened.styleId];
}

export function unavailableSavedStyleIds(
  activeStyleId: number | null,
  placedStyleIds: Array<number | null | undefined>,
  currentlySellableStyleIds: Iterable<number>,
): number[] {
  const sellable = new Set(currentlySellableStyleIds);
  const referenced = new Set([activeStyleId, ...placedStyleIds]);
  return Array.from(referenced)
    .filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0 && !sellable.has(id))
    .sort((a, b) => a - b);
}

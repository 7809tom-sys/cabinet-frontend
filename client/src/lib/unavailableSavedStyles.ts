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

export const FAVORITES_KEY_PREFIX = "cabinetdealz:favorite-families:";

export function favoriteStorageKey(scope?: string | null): string {
  return `${FAVORITES_KEY_PREFIX}${scope || "main"}`;
}

export function parseFavoriteFamilyIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => typeof id === "number" && Number.isFinite(id));
  } catch {
    return [];
  }
}

export function toggleFavoriteFamilyId(ids: number[], styleId: number): number[] {
  return ids.includes(styleId)
    ? ids.filter((id) => id !== styleId)
    : [...ids, styleId];
}

export function filterFavoriteFamilies<T extends { styleId: number }>(families: T[], ids: number[]): T[] {
  const favoriteIds = new Set(ids);
  return families.filter((family) => favoriteIds.has(family.styleId));
}

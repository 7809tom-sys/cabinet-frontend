function setPricingIdentity(
  ids: Map<string, number | null>,
  key: string,
  id: number,
) {
  const current = ids.get(key);
  if (current === undefined) ids.set(key, id);
  else if (current !== id) ids.set(key, null);
}

function normalizedPricingCode(masterCode: string): string {
  return masterCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Legacy saved plans used WFR#### for an ordinary W#### wall cabinet in a few
 * early refrigerator/island workflows. The live catalog never had a separate
 * WFR product; the dimensions and description remained those of the canonical
 * W cabinet. Keep an exact WFR catalog row primary if one is introduced later,
 * otherwise use the unambiguous normalized W identity only for live pricing.
 */
function legacyWallPricingCode(masterCode: string): string | null {
  const normalized = normalizedPricingCode(masterCode);
  const match = /^WFR(\d{2})(\d{2})$/.exec(normalized);
  return match ? `W${match[1]}${match[2]}` : null;
}

/**
 * Build a catalog-price identity map. A master code that resolves to different
 * active IDs is deliberately marked ambiguous so a saved placement cannot be
 * silently repriced through an unrelated duplicate record.
 */
export function activeCatalogPricingIdsByMasterCode(
  catalog: readonly { id: number; masterCode: string | null | undefined }[],
): Map<string, number | null> {
  const ids = new Map<string, number | null>();
  for (const item of catalog) {
    const code = item.masterCode?.trim();
    if (!code || !Number.isFinite(item.id) || item.id <= 0) continue;
    setPricingIdentity(ids, code, item.id);
    setPricingIdentity(ids, normalizedPricingCode(code), item.id);
  }
  return ids;
}

/**
 * Saved plans keep their original cabinet identity for geometry, but pricing may
 * follow one unambiguous active catalog record with the same exact master code.
 * Ambiguous codes retain their persisted ID rather than borrowing another SKU's
 * distributor/style price.
 */
export function currentCatalogPricingCabinetId(
  placed: { cabinetId: number; masterCode: string },
  activeCatalogIdByMasterCode: ReadonlyMap<string, number | null | undefined>,
): number {
  const exactId = activeCatalogIdByMasterCode.get(placed.masterCode);
  if (typeof exactId === "number" && exactId > 0) return exactId;

  const normalizedId = activeCatalogIdByMasterCode.get(normalizedPricingCode(placed.masterCode));
  if (typeof normalizedId === "number" && normalizedId > 0) return normalizedId;

  const legacyWallCode = legacyWallPricingCode(placed.masterCode);
  const legacyWallId = legacyWallCode ? activeCatalogIdByMasterCode.get(legacyWallCode) : null;
  return typeof legacyWallId === "number" && legacyWallId > 0 ? legacyWallId : placed.cabinetId;
}

/**
 * The 3-inch dishwasher return panel is sold under more than one master code.
 * Auto Design and the Designer treat these as the same panel. A line still
 * keeps whichever code it actually sells; nothing in the catalog is renamed.
 *
 *   BEP(DWR)3  — Ashford, Madison, Preston (and most other lines)
 *   DWR3       — Designer Warehouse
 *   DW3        — accepted as the same panel, even though no live product
 *                currently uses this spelling
 */
export const DISHWASHER_PANEL_ALIAS_CODES = ["BEP(DWR)3", "DWR3", "DW3"] as const;

export type DishwasherPanelAliasCode = (typeof DISHWASHER_PANEL_ALIAS_CODES)[number];

/** Uppercase letters and digits only, so `BEP(DWR)3` and `BEPDWR3` match. */
export function dishwasherPanelAliasKey(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const DISHWASHER_PANEL_ALIAS_KEYS = new Set(
  DISHWASHER_PANEL_ALIAS_CODES.map((code) => dishwasherPanelAliasKey(code)),
);

/** True when the code is one of DWR3, DW3, or BEP(DWR)3 (any punctuation). */
export function isDishwasherPanelAliasCode(value: string | null | undefined): boolean {
  const key = dishwasherPanelAliasKey(value);
  return key.length > 0 && DISHWASHER_PANEL_ALIAS_KEYS.has(key);
}

/** True when both codes are in the dishwasher-panel alias family. */
export function sameDishwasherPanelAlias(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return isDishwasherPanelAliasCode(left)
    && isDishwasherPanelAliasCode(right);
}

/**
 * Catalog cabinet ids that belong to the same dishwasher-panel alias family,
 * starting with `item`'s own id so a direct hit wins.
 */
export function dishwasherPanelAliasIds(
  item: { id: number; masterCode?: string | null },
  catalog: readonly { id: number; masterCode?: string | null }[],
): number[] {
  const ids: number[] = [];
  const remember = (id: number) => {
    if (!Number.isFinite(id) || id <= 0 || ids.includes(id)) return;
    ids.push(id);
  };
  remember(item.id);
  if (!isDishwasherPanelAliasCode(item.masterCode)) return ids;
  for (const other of catalog) {
    if (isDishwasherPanelAliasCode(other.masterCode)) remember(other.id);
  }
  return ids;
}

/**
 * Price for a dishwasher-panel alias. A DWR3 (or DW3) row uses a priced
 * BEP(DWR)3 entry on the same style when its own id has no price, and the
 * other way around. Codes outside the alias family look up only their own id.
 * Returns null when none of the aliases has a positive price — a price is
 * never invented.
 */
export function resolveDishwasherPanelAliasPrice(
  item: { id: number; masterCode?: string | null },
  styleId: number | null | undefined,
  priceByCabinetAndStyle: ReadonlyMap<string, number>,
  catalog: readonly { id: number; masterCode?: string | null }[] = [],
): number | null {
  if (styleId == null) return null;
  for (const id of dishwasherPanelAliasIds(item, catalog)) {
    const price = priceByCabinetAndStyle.get(`${id}:${styleId}`);
    if (price != null && price > 0) return price;
  }
  return null;
}

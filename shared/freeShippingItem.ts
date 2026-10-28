/**
 * Catalog free shipping is a property of the cabinet master, not a supplier
 * freight rule and not the temporary one-dollar checkout SKU.
 *
 * The temporary SKU stays a separate, hard-coded exception. This flag is the
 * admin choice on a real catalog item. Checkout may trust it only after the
 * server has read cabinets.freeShipping; the client flag is a display hint.
 */

export function isCatalogFreeShippingFlag(value: unknown): boolean {
  return value === true || value === 1;
}

export type CatalogFreightIdentity = {
  cabinetId?: number | null;
  masterCode?: string | null;
  rawCode?: string | null;
  productKind?: string | null;
};

export type CatalogFreeShippingIndex = {
  cabinetIds: ReadonlySet<number>;
  masterCodes: ReadonlySet<string>;
};

export const EMPTY_CATALOG_FREE_SHIPPING_INDEX: CatalogFreeShippingIndex = {
  cabinetIds: new Set<number>(),
  masterCodes: new Set<string>(),
};

function normalizedCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/**
 * True when this cabinet master is flagged free shipping in the database.
 * Surfaces, hardware, and samples are never covered by the cabinet flag.
 */
export function isCatalogFreeShippingIdentity(
  item: CatalogFreightIdentity,
  index: CatalogFreeShippingIndex,
): boolean {
  if (item.productKind === "surface" || item.productKind === "hardware" || item.productKind === "sample") {
    return false;
  }
  if (typeof item.cabinetId === "number" && item.cabinetId > 0 && index.cabinetIds.has(item.cabinetId)) {
    return true;
  }
  const code = normalizedCode(item.masterCode ?? item.rawCode);
  return code.length > 0 && index.masterCodes.has(code);
}

export function catalogFreeShippingIndexFromRows(
  rows: Array<{ id: number; masterCode: string | null; freeShipping: unknown }>,
): CatalogFreeShippingIndex {
  const cabinetIds = new Set<number>();
  const masterCodes = new Set<string>();
  for (const row of rows) {
    if (!isCatalogFreeShippingFlag(row.freeShipping)) continue;
    cabinetIds.add(row.id);
    const code = normalizedCode(row.masterCode);
    if (code) masterCodes.add(code);
  }
  return { cabinetIds, masterCodes };
}

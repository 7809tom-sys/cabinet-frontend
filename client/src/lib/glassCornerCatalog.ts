import type { DesignCabinet } from "@/lib/design";

export type GlassCornerCatalogChoice = DesignCabinet & {
  displayMasterCode: string;
  glassDoor: true;
  glassDoorAddonCode: string;
};

function normalizedCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Builds a visible glass-corner choice without inventing a combined commerce
 * SKU. The placed cabinet keeps the real WDC base ID/code, while the unique
 * active PGWDC product remains the separately priced glass-door add-on.
 */
export function buildGlassCornerCatalogChoices(
  cornerWallCabinets: readonly DesignCabinet[],
  activeCatalogProducts: readonly DesignCabinet[],
): GlassCornerCatalogChoice[] {
  const productsByCode = new Map<string, Map<number, DesignCabinet>>();
  for (const product of activeCatalogProducts) {
    const code = normalizedCode(product.masterCode);
    const byId = productsByCode.get(code) ?? new Map<number, DesignCabinet>();
    byId.set(Number(product.id), product);
    productsByCode.set(code, byId);
  }

  return cornerWallCabinets.flatMap((cabinet) => {
    const match = normalizedCode(cabinet.masterCode).match(/^WDC24(30|36|42)$/);
    if (!match) return [];
    const expectedAddOnCode = `PGWDC${match[1]}`;
    const matches = Array.from(productsByCode.get(expectedAddOnCode)?.values() ?? []);
    if (matches.length !== 1) return [];
    const addOn = matches[0];
    return [{
      ...cabinet,
      displayMasterCode: `${cabinet.masterCode}GD`,
      description: `${cabinet.description} — Glass Door (${addOn.masterCode})`,
      glassDoor: true,
      glassDoorAddonCode: addOn.masterCode,
    }];
  });
}

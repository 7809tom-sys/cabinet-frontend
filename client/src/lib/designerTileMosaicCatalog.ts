/**
 * Designer Tile & Mosaic visibility.
 *
 * The public storefront catalog (`pelican.byCategory` scope `catalog`) returns
 * every active, priced Tile & Mosaic product. The Designer scope then drops any
 * row that fails `isPelicanDesignerSelectable` in cabinet-backend, and that
 * helper still requires an approved repeatable swatch for backsplash. On the
 * live catalog that leaves 7 of 51 products. Countertops already stay
 * selectable without a swatch and render a labeled neutral preview; tile and
 * mosaic follow that same commercial rule here.
 *
 * Catalog photography stays on the product card. It is never promoted to a 3D
 * texture. `isPelicanDesignerReady` on the server should remain the gate for an
 * exact material render.
 */

export const TILE_MOSAIC_CATEGORY = "Tile & Mosaic";

export type DesignerPaletteRow = {
  category: string;
  pelicanCode?: string | null;
  materialImageUrl?: string | null;
  showInDesigner?: boolean | null;
  isActive?: boolean | null;
  sellPrice?: number | string | null;
};

export function hasPositiveSellPrice(value: number | string | null | undefined): boolean {
  if (value == null || value === "") return false;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

/** Priced, Designer-enabled tile and mosaic rows, with or without a material swatch. */
export function isSelectableDesignerTileMosaic(item: DesignerPaletteRow): boolean {
  if (item.category !== TILE_MOSAIC_CATEGORY) return false;
  if (item.isActive === false || item.showInDesigner === false) return false;
  return hasPositiveSellPrice(item.sellPrice);
}

/**
 * Palette filter for the Designer surfaces dialog.
 * Bathroom fixtures keep the server's own family filter. Tile & Mosaic is
 * included from the storefront catalog, so it is filtered here even in a
 * bathroom wall-tile tab.
 */
export function isDesignerPaletteItemVisible(
  item: DesignerPaletteRow,
  options: {
    isBathroom: boolean;
    hasVerifiedFixtureProfile: (code: string | null | undefined) => boolean;
    matchesCountertopSwatch: (item: DesignerPaletteRow) => boolean;
  },
): boolean {
  if (item.category === TILE_MOSAIC_CATEGORY) return isSelectableDesignerTileMosaic(item);
  if (options.isBathroom) return true;
  if (item.isActive === false || item.showInDesigner === false) return false;
  if (item.category === "Sinks & Faucets") return options.hasVerifiedFixtureProfile(item.pelicanCode);
  if (item.category === "Quartz Slabs (Countertops)") return options.matchesCountertopSwatch(item);
  // Flooring still needs an approved repeatable swatch. A staged product photo
  // is not a tileable floor map.
  if (item.category === "Flooring") return Boolean(item.materialImageUrl?.trim());
  return false;
}

/**
 * Saved favorites still resolve through `surfaces.designerByIds`, which applies
 * the same swatch gate. Fill Tile & Mosaic gaps from `surfaces.byIds` (no
 * readiness gate) without replacing a row the Designer endpoint already returned.
 */
export function mergePreferredPaletteProducts<T extends { id: number; category: string }>(
  designerRows: readonly T[],
  catalogRows: readonly T[],
): T[] {
  const byId = new Map<number, T>();
  for (const row of designerRows) byId.set(row.id, row);
  for (const row of catalogRows) {
    if (row.category !== TILE_MOSAIC_CATEGORY || byId.has(row.id)) continue;
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

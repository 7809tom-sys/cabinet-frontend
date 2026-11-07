/**
 * Designer Tile & Mosaic and flooring visibility.
 *
 * Flooring planks come from the Designer endpoints: `surfaces.recommended`
 * with `{ role: "flooring", limit: 500 }`, and the kitchen Flooring tab /
 * Browse all via `pelican.byCategory` scope `designer` with limit 200. Paired
 * cabinet-backend#27 stamps `designerRenderReady` and `hasSwatch` on those
 * products. `designerRenderReady` is true only when the plank may be drawn as
 * a real 3D material. `materialImageUrl` is the floor texture in that case.
 * When no dedicated swatch exists, `imageUrl` (the catalog photo) is tiled
 * across the floor so the 3D floor matches the selected product. A plank with
 * no photo at all still uses the neutral preview.
 * Until that backend deploys, missing flags are inferred from a non-empty
 * `materialImageUrl`.
 *
 * Tile & Mosaic still loads the storefront catalog. Designer scope continues
 * to require a swatch for backsplash. Catalog photography stays on the tile
 * card and is also the 3D backsplash texture when the row has no approved
 * repeatable swatch. The Designer tiles that picture at the product's sheet
 * size instead of substituting a generic tile. Moldings & Trim and Underlayment
 * stay out of the flooring palette; they remain accessory suggestions.
 */

import { catalogCategoryValuesEqual } from "@shared/catalogCategorySpelling";
import { threeDTextureUrlIsColorMap } from "@/lib/flooringMaterialAppearance";

export const TILE_MOSAIC_CATEGORY = "Tile & Mosaic";
export const FLOORING_CATEGORY = "Flooring";
export const FLOORING_PLANKS_SUBCATEGORY = "Planks & Flooring";

export type DesignerPaletteRow = {
  category: string;
  subCategory?: string | null;
  pelicanCode?: string | null;
  materialImageUrl?: string | null;
  imageUrl?: string | null;
  /** Backend swatch gate. When present it wins over inferring from materialImageUrl. */
  designerRenderReady?: boolean | null;
  /** Alternate name for the same backend swatch gate. */
  hasSwatch?: boolean | null;
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
 * Priced, Designer-enabled flooring planks, with or without a material swatch.
 * Moldings & Trim and Underlayment are not floor materials.
 */
export function isSelectableDesignerFlooringPlank(item: DesignerPaletteRow): boolean {
  if (item.category !== FLOORING_CATEGORY) return false;
  if (!catalogCategoryValuesEqual(item.subCategory, FLOORING_PLANKS_SUBCATEGORY)) return false;
  if (item.isActive === false || item.showInDesigner === false) return false;
  return hasPositiveSellPrice(item.sellPrice);
}

/**
 * Exact 3D texture gate. An explicit backend flag wins. When neither flag is
 * present, a non-empty materialImageUrl is the approved swatch. A catalog
 * photo (`imageUrl`) is never a swatch.
 */
export function designerMaterialRenderReady(
  item: Pick<DesignerPaletteRow, "designerRenderReady" | "hasSwatch" | "materialImageUrl"> | null | undefined,
): boolean {
  if (!item) return false;
  if (typeof item.designerRenderReady === "boolean") return item.designerRenderReady;
  if (typeof item.hasSwatch === "boolean") return item.hasSwatch;
  return Boolean(item.materialImageUrl?.trim());
}

/** Read swatch flags without requiring them on the current router type. */
export function readDesignerRenderFlags(record: object | null | undefined): {
  designerRenderReady?: boolean;
  hasSwatch?: boolean;
} {
  if (!record) return {};
  const source = record as { designerRenderReady?: unknown; hasSwatch?: unknown };
  return {
    ...(typeof source.designerRenderReady === "boolean" ? { designerRenderReady: source.designerRenderReady } : {}),
    ...(typeof source.hasSwatch === "boolean" ? { hasSwatch: source.hasSwatch } : {}),
  };
}

/**
 * URL passed into the 3D floor mesh.
 * An approved material swatch wins. A built-in curated map wins when the
 * product is not render-ready. Otherwise the catalog photo (`imageUrl`) is
 * tiled as the floor so a selected plank is not drawn as default brown wood.
 * A product with neither a swatch nor a catalog photo returns null.
 */
export function flooringSceneTextureUrl(
  item: (Pick<DesignerPaletteRow, "materialImageUrl" | "imageUrl" | "designerRenderReady" | "hasSwatch"> & { id?: number | null }) | null | undefined,
  curatedByProductId: Readonly<Record<number, string>> = {},
): string | null {
  if (!item) return null;
  const curated = item.id == null ? null : curatedByProductId[Number(item.id)] ?? null;
  if (designerMaterialRenderReady(item)) return item.materialImageUrl?.trim() || curated;
  if (curated) return curated;
  const catalogPhoto = item.imageUrl?.trim() || "";
  if (catalogPhoto && threeDTextureUrlIsColorMap(catalogPhoto)) return catalogPhoto;
  return null;
}

/** Flooring card copy: the catalog photo is the 3D floor when no swatch exists. */
export function flooringFollowsCatalogPhoto(
  item: Pick<DesignerPaletteRow, "category" | "imageUrl" | "materialImageUrl" | "designerRenderReady" | "hasSwatch"> | null | undefined,
): boolean {
  if (!item || item.category !== FLOORING_CATEGORY) return false;
  if (designerMaterialRenderReady(item)) return false;
  const catalogPhoto = item.imageUrl?.trim() || "";
  return Boolean(catalogPhoto) && threeDTextureUrlIsColorMap(catalogPhoto);
}

/**
 * Palette filter for the Designer surfaces dialog.
 * Bathroom fixtures keep the server's own family filter. Tile & Mosaic is
 * loaded from the storefront catalog, and flooring planks are checked again
 * here so molding, trim, and underlayment never become the floor.
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
  if (item.category === FLOORING_CATEGORY) return isSelectableDesignerFlooringPlank(item);
  if (options.isBathroom) return true;
  if (item.isActive === false || item.showInDesigner === false) return false;
  if (item.category === "Sinks & Faucets") return options.hasVerifiedFixtureProfile(item.pelicanCode);
  if (item.category === "Quartz Slabs (Countertops)") return options.matchesCountertopSwatch(item);
  return false;
}

/**
 * Saved favorites still resolve through `surfaces.designerByIds`, which applies
 * the swatch gate. Fill Tile & Mosaic and flooring-plank gaps from
 * `surfaces.byIds` (no readiness gate) without replacing a row the Designer
 * endpoint already returned.
 */
export function mergePreferredPaletteProducts<T extends { id: number; category: string }>(
  designerRows: readonly T[],
  catalogRows: readonly T[],
): T[] {
  const byId = new Map<number, T>();
  for (const row of designerRows) byId.set(row.id, row);
  for (const row of catalogRows) {
    if (byId.has(row.id)) continue;
    if (row.category === TILE_MOSAIC_CATEGORY || isSelectableDesignerFlooringPlank(row as DesignerPaletteRow)) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

/** Join storefront pages without duplicating a product that appears on both. */
export function concatCatalogPages<T extends { id: number }>(pages: readonly (readonly T[] | undefined)[]): T[] {
  const byId = new Map<number, T>();
  for (const page of pages) {
    for (const item of page ?? []) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

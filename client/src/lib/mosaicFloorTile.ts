/**
 * Mosaic sheets are wall backsplash unless a vendor checks "Use as floor tile".
 *
 * The flag lives on the Pelican product (`usableAsFloor`). Until
 * docs/sql/0244_pelican_floor_tile.tidb.sql and the paired backend patch are
 * deployed, list payloads omit the field. Missing means unchecked.
 *
 * A checked mosaic stays a backsplash and may also be chosen as the room floor.
 * The floor pattern is saved with the design, not on the product. Straight (90°)
 * keeps the sheet grid square to the walls. Diagonal (45°) rotates that same
 * seamless sheet. Offset/brick is not offered: a half-sheet row shift moves an
 * interlocking mosaic off its pitch and would draw a sheet seam. The continuous
 * field rule forbids that.
 */

import { catalogCategoryValuesEqual } from "@shared/catalogCategorySpelling";
import {
  hasPositiveSellPrice,
  TILE_MOSAIC_CATEGORY,
  type DesignerPaletteRow,
} from "@/lib/designerTileMosaicCatalog";

export const MOSAIC_SUBCATEGORY = "Mosaic";

export const MOSAIC_FLOOR_PATTERNS = [
  { id: "straight", label: "Straight (90°)", degrees: 0 },
  { id: "diagonal", label: "Diagonal (45°)", degrees: 45 },
] as const;

export type MosaicFloorPattern = (typeof MOSAIC_FLOOR_PATTERNS)[number]["id"];

export type MosaicFloorProduct = {
  category?: string | null;
  subCategory?: string | null;
  name?: string | null;
  usableAsFloor?: unknown;
  isActive?: boolean | null;
  showInDesigner?: boolean | null;
  sellPrice?: number | string | null;
  installedAs?: "flooring" | "backsplash" | null;
};

/** True only for an explicit on value. Absent, false, and junk stay off. */
export function readUsableAsFloor(record: object | null | undefined): boolean {
  if (!record || typeof record !== "object") return false;
  const value = (record as { usableAsFloor?: unknown }).usableAsFloor;
  return value === true || value === 1 || value === "1" || value === "true";
}

export function isMosaicCatalogItem(item: {
  category?: string | null;
  subCategory?: string | null;
} | null | undefined): boolean {
  if (!item) return false;
  return item.category === TILE_MOSAIC_CATEGORY
    && catalogCategoryValuesEqual(item.subCategory, MOSAIC_SUBCATEGORY);
}

/**
 * A floor installation of a mosaic. Flooring-category planks are never mosaics,
 * even when the product name mentions a mosaic look.
 */
export function isMosaicFloorProduct(item: {
  category?: string | null;
  subCategory?: string | null;
  name?: string | null;
} | null | undefined): boolean {
  if (!item || item.category === "Flooring") return false;
  if (isMosaicCatalogItem(item)) return true;
  return item.category === TILE_MOSAIC_CATEGORY && /mosaic/i.test(item.name ?? "");
}

/** Priced Designer mosaic that the vendor marked as a floor tile. */
export function isSelectableDesignerFloorMosaic(item: DesignerPaletteRow & { usableAsFloor?: unknown }): boolean {
  if (!isMosaicCatalogItem(item)) return false;
  if (!readUsableAsFloor(item)) return false;
  if (item.isActive === false || item.showInDesigner === false) return false;
  return hasPositiveSellPrice(item.sellPrice);
}

export function floorCapableMosaics<T extends DesignerPaletteRow & { usableAsFloor?: unknown }>(rows: readonly T[]): T[] {
  return rows.filter((row) => isSelectableDesignerFloorMosaic(row));
}

export function isMosaicFloorPattern(value: unknown): value is MosaicFloorPattern {
  return value === "straight" || value === "diagonal";
}

/** Older designs omit the pattern. That is Straight (90°). */
export function mosaicFloorPatternOrStraight(value: unknown): MosaicFloorPattern {
  return isMosaicFloorPattern(value) ? value : "straight";
}

export function mosaicFloorPatternLabel(pattern: MosaicFloorPattern | null | undefined): string {
  const id = mosaicFloorPatternOrStraight(pattern);
  return MOSAIC_FLOOR_PATTERNS.find((entry) => entry.id === id)?.label ?? "Straight (90°)";
}

/**
 * Texture rotation for the seamless sheet. Straight (90°) is square to the
 * walls, so the sheet is not turned. Diagonal turns the same unit 45°.
 */
export function mosaicFloorPatternDegrees(pattern: MosaicFloorPattern | null | undefined): 0 | 45 {
  return mosaicFloorPatternOrStraight(pattern) === "diagonal" ? 45 : 0;
}

/**
 * Floor UVs measured in whole seamless sheets. Rotation is applied to the
 * floor inches before dividing by the pitch, so RepeatWrapping stays on the
 * sheet lattice. A 45° turn does not cut the field into sheet rectangles.
 */
export function mosaicFloorUv(
  xIn: number,
  yIn: number,
  pitchXIn: number,
  pitchYIn: number,
  pattern: MosaicFloorPattern | null | undefined,
): { u: number; v: number } {
  const radians = (mosaicFloorPatternDegrees(pattern) * Math.PI) / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  const xr = xIn * c + yIn * s;
  const yr = -xIn * s + yIn * c;
  return {
    u: xr / Math.max(0.125, pitchXIn),
    v: yr / Math.max(0.125, pitchYIn),
  };
}

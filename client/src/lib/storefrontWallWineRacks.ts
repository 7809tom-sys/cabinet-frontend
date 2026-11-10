import { withWallWineRacks, type WallWineRackFields } from "@shared/wallWineRack";

/**
 * `storefront.familyCatalog` rejects a limit above 200. A White Shaker wall
 * list is longer than the old 60-item window, and SKU order puts WRC / WXR
 * after that window, so the locked catalog never showed them.
 */
export const STOREFRONT_CATALOG_PAGE_SIZE = 200;

/** Offsets for every page after the first. Empty when one page already holds the line. */
export function storefrontCatalogOffsets(total: number, pageSize = STOREFRONT_CATALOG_PAGE_SIZE): number[] {
  if (!Number.isFinite(total) || pageSize <= 0 || total <= pageSize) return [];
  const offsets: number[] = [];
  for (let offset = pageSize; offset < total; offset += pageSize) offsets.push(offset);
  return offsets;
}

/**
 * Join catalog pages in order. A row already seen by id is kept as it first
 * arrived, including its price and dimensions. Nothing is invented or dropped.
 */
export function mergeStorefrontCatalogPages<T extends { id?: number | string | null }>(
  pages: readonly (readonly T[])[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const page of pages) {
    for (const row of page) {
      const key = row.id != null && String(row.id) !== "" ? `id:${row.id}` : `row:${result.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(row);
    }
  }
  return result;
}

/**
 * The locked affiliate storefront asks the API for ONE category at a time, so
 * its Wall tab only ever contains rows the supplier actually filed as "Wall".
 * A wall wine rack filed as "Accessories / Wine Storage", "Wine Rack / Open
 * Display", or "Specialty / Wine Rack" therefore never reaches the Wall tab —
 * the exact symptom in issue #55.
 *
 * These helpers let the Wall tab pull the other buckets the line really has and
 * keep only the racks, without asking for the whole catalog.
 */

/** Categories that can hide a wall wine rack, lowest priority last. */
const RACK_ELIGIBLE_CATEGORIES = [
  "Wall Wine Rack",
  "Wine Rack / Open Display",
  "Specialty / Wine Rack",
  "Wine Storage",
  "Accessories / Wine Storage",
  "Specialty",
  "Accessory",
  "Accessories",
] as const;

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The extra category filters the Wall tab must also request: every category the
 * line actually has that is not Wall and could hold a rack. Empty when the Wall
 * tab is not active, so no extra request is made on any other tab.
 */
export function wallTabExtraCategories(
  activeCategory: string | null,
  categories: readonly string[],
): string[] {
  if (normalized(activeCategory) !== "wall") return [];
  const present = new Map<string, string>();
  for (const category of categories) {
    const trimmed = category.trim();
    if (trimmed) present.set(normalized(trimmed), trimmed);
  }
  const extras: string[] = [];
  for (const candidate of RACK_ELIGIBLE_CATEGORIES) {
    const stored = present.get(normalized(candidate));
    if (stored) extras.push(stored);
  }
  return extras;
}

/**
 * Wall tab rows plus the racks found in the other buckets, de-duplicated by
 * record id. Racks are placed as wall cabinets so the card and the Designer
 * agree about where the item mounts. A non-rack accessory pulled in for its
 * category is dropped, so the Wall tab never shows filler or moulding.
 */
export function mergeWallTabRacks<T extends WallWineRackFields & { id?: number | string | null }>(
  wallRows: readonly T[],
  extraRows: readonly T[],
): T[] {
  return withWallWineRacks(wallRows, extraRows);
}

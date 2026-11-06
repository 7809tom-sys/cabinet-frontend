import { isWallWineRackCabinet, withWallWineRacks, type WallWineRackFields } from "@shared/wallWineRack";

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
 * agree about where the item mounts.
 */
export function mergeWallTabRacks<T extends WallWineRackFields & { id?: number | string | null }>(
  wallRows: readonly T[],
  extraRows: readonly T[],
): T[] {
  return withWallWineRacks(wallRows, extraRows);
}

/**
 * Keep only the rows that belong on the Wall tab: the wall rows as returned,
 * plus any rack from the extra buckets. Used before the height/label grouping
 * so a non-rack accessory pulled for its category is never shown on Wall.
 */
export function wallTabVisibleRacks<T extends WallWineRackFields & { id?: number | string | null }>(
  extraRows: readonly T[],
): T[] {
  return extraRows.filter((row) => isWallWineRackCabinet(row));
}

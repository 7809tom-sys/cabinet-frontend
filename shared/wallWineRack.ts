/**
 * Wall wine racks are real upper cabinets (WRC, WXR, WWC, LWR).
 *
 * Suppliers file them under several labels, sometimes as one combined
 * "parent / child" string and sometimes only in the description:
 *
 *   Wall Wine Rack
 *   Wine Rack / Open Display
 *   Accessories / Wine Storage
 *   Specialty / Wine Rack
 *
 * Those labels still belong on the Wall catalog and in the Designer wall
 * picker. Auto-Design keeps its own rule and does not treat them as straight
 * uppers.
 *
 * Three families must never be pulled onto the wall list by this module:
 *
 *   - WR#### is a WALL REFRIGERATOR cabinet, not a wine rack.
 *   - A BASE, TALL, or VANITY wine rack (BOWR30, WINEBIN-BASE, a "Base w/
 *     Wine Rack" row) keeps its own tab. A supplier label of "Wine Rack" alone
 *     does not make a floor-standing box an upper.
 *   - Radius caps such as WRC18L / WRC18R share the WRC prefix but are not
 *     racks, so a rack code must END in digits.
 */

export type WallWineRackFields = {
  id?: number | string | null;
  masterCode?: string | null;
  category?: string | null;
  subCategory?: string | null;
  description?: string | null;
  placement?: string | null;
  placementType?: string | null;
};

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Letters and digits only, so "DN-WRC3015" and "WRC 3015" compare equal. */
export function wallWineRackCode(masterCode: string | null | undefined): string {
  return (masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** The rack code must end in digits: WRC18L is a Wall Radius Cap, not a rack. */
const WALL_RACK_CODE = /(?:WRC|WXR|WWC|LWR)\d+$/;

/** True for a rack-family cabinet code, including a vendor-prefixed one. */
export function isWallWineRackCode(masterCode: string | null | undefined): boolean {
  const code = wallWineRackCode(masterCode);
  if (!code || /^WR\d/.test(code)) return false;
  return WALL_RACK_CODE.test(code);
}

/** Drinks appliances and glass holders are catalog items, not rack boxes. */
const EXCLUDED_WINE = /wine\s*(?:cooler|fridge|refrigerator|column)|wine\s*glass|\bglass\s*holder\b/;

/** "Wine Rack", "Wine Storage", "Wine Bottle Rack", "Accessories / Wine Storage". */
function namesWineStorage(value: string | null | undefined): boolean {
  const text = normalized(value);
  if (!text || EXCLUDED_WINE.test(text)) return false;
  return /\bwine\b/.test(text);
}

/** A bare "Open Display" upper is a rack/open-front box, never a solid door. */
function namesOpenDisplay(value: string | null | undefined): boolean {
  const text = normalized(value);
  return text === "open display" || text === "open display cabinet";
}

/**
 * The supplier's filing bucket is the first segment of a combined label, so
 * "Accessories / Wine Storage" files under Accessories and
 * "Wine Rack / Open Display" files under Wine Rack.
 */
function filingBucket(value: string | null | undefined): string {
  return normalized(value).split("/")[0]?.trim() ?? "";
}

const FLOOR_BUCKET = /^(?:base|bases|tall|vanity|vanities|ada|corner)\b/;

/**
 * True when the supplier filed this row as a floor-standing or tall box. A base
 * wine rack is a real cabinet, it is simply not an upper, so the wall catalog
 * must leave it where it was filed.
 */
function filedAsFloorBox(cabinet: WallWineRackFields): boolean {
  const placement = normalized(cabinet.placement ?? cabinet.placementType);
  if (FLOOR_BUCKET.test(placement)) return true;
  if (FLOOR_BUCKET.test(filingBucket(cabinet.category))) return true;
  if (FLOOR_BUCKET.test(filingBucket(cabinet.subCategory))) return true;
  return /^\s*base\b|\bbase\s+(?:w\/|with)\s+wine\b|\bwine\s*bin[-_ ]?base\b/.test(normalized(cabinet.description));
}

/**
 * True for a wall wine-rack box, including every supplier label above, a
 * vendor-prefixed rack code, and a rack named only in the description.
 */
export function isWallWineRackCabinet(cabinet: WallWineRackFields): boolean {
  // WR#### is the wall refrigerator family, whatever else the row says.
  if (/^WR\d/.test(wallWineRackCode(cabinet.masterCode))) return false;

  // A WRC/WXR/WWC/LWR box code is the strongest signal the catalog carries, but
  // a record the supplier filed as a floor-standing box keeps that tab.
  if (isWallWineRackCode(cabinet.masterCode)) return !filedAsFloorBox(cabinet);

  if (filedAsFloorBox(cabinet)) return false;

  // Rack named in the category, the subcategory, or only in the description.
  if (namesWineStorage(cabinet.category)
    || namesWineStorage(cabinet.subCategory)
    || namesWineStorage(cabinet.description)) {
    return true;
  }

  // A bare "Open Display" label is an open-front upper only when the row is
  // already filed as wall or specialty work; it is never a base or tall box.
  if (namesOpenDisplay(cabinet.category) || namesOpenDisplay(cabinet.subCategory)) {
    return /wall|specialty|accessory|accessories|misc/.test(
      normalized(`${cabinet.category} ${cabinet.subCategory}`),
    );
  }
  return false;
}

/**
 * The row key used to de-duplicate one catalog record that a category filter
 * put in two buckets. A row without an id falls back to its rack code.
 */
function rowKey(row: WallWineRackFields): string {
  if (row.id != null && String(row.id) !== "") return `id:${Number(row.id)}`;
  return `code:${wallWineRackCode(row.masterCode)}`;
}

/**
 * Wall-picker sections for racks the selected line actually returned.
 * The label is the catalog subcategory (or category) already on the row.
 * Racks stay out of the ordinary height groups so a 15" or 18" rack is not
 * hidden inside a collapsed wall-height accordion.
 */
export function designerWallWineRackSections<T extends WallWineRackFields>(
  items: readonly T[],
): { label: string; items: T[] }[] {
  const groups = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    if (!isWallWineRackCabinet(item)) continue;
    const label = (item.subCategory ?? "").trim() || (item.category ?? "").trim() || "Wine Rack";
    const key = label.toLowerCase();
    const existing = groups.get(key);
    if (existing) existing.items.push(item);
    else groups.set(key, { label, items: [item] });
  }
  return Array.from(groups.values());
}

/**
 * Keep every wall-placement row, and add wine racks that a category filter
 * sent to Base or Accessories. Added rows are placed as wall cabinets.
 */
export function withWallWineRacks<T extends WallWineRackFields>(
  wallRows: readonly T[],
  otherRows: readonly T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of wallRows) {
    const key = rowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(isWallWineRackCabinet(row) ? { ...row, placement: "wall" } : row);
  }
  for (const row of otherRows) {
    if (!isWallWineRackCabinet(row)) continue;
    const key = rowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...row, placement: "wall" });
  }
  return result;
}

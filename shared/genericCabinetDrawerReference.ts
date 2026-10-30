import { stripHandedness } from "./codeMatch";

/**
 * Standard door-base face reference.
 *
 * These are exact B-prefixed base cabinets (B09, B12, B-18, B21-R, and the
 * same codes with dashes). Full-height, drawer-base, sink, corner, wall, tall,
 * and vanity codes are not this family.
 *
 * Door rule (owner): B21 and under always has ONE door. B24 and wider standard
 * bases have TWO doors. A stored numberOfDoors value does not override this.
 * B09/B9 is included in the one-door rule. It is the 9-inch tray base, so the
 * empty-layout drawer row stays empty; the existing tray rule already forces
 * zero drawers. A saved drawerLayout can still add fronts.
 *
 * Drawer rule, used only when Edit Config drawerLayout is empty or invalid.
 * A saved drawerLayout JSON always wins at the call site. numberOfDrawers is
 * not used (live B30 says 2 drawers but the cabinet has one full-width drawer).
 *
 * Generic images these rows were read from. They are references only — never
 * textured onto a cabinet:
 * - B09–B21, one door and one full-width drawer: the b12–b21 generic drawing,
 *   for example /manus-storage/media-library/1790257590606_b12_b21_ecac0f38
 * - B24–B30, two doors and one full-width drawer: the b24–b30 generic drawing,
 *   for example /manus-storage/media-library/1790614029102_b24_b30s_82812e07
 * - B33–B42, two doors and ONE row of TWO side-by-side drawers: the owner’s
 *   generic image /manus-storage/media-library/1790698125272_b33_b42_1b46169a
 * Wider standard bases (B48) use that same two-column top when no layout is saved.
 */

export const STANDARD_BASE_NARROW_GENERIC_IMAGE =
  "/manus-storage/media-library/1790257590606_b12_b21_ecac0f38";
export const STANDARD_BASE_SINGLE_DRAWER_GENERIC_IMAGE =
  "/manus-storage/media-library/1790614029102_b24_b30s_82812e07";
export const STANDARD_BASE_B33_B42_GENERIC_IMAGE =
  "/manus-storage/media-library/1790698125272_b33_b42_1b46169a";

export type StandardBaseDrawerRow = { count: number };

export type StandardBaseFaceReference = {
  /** Nominal width from the B## code, in inches. A stale width field is ignored. */
  width: number;
  doors: number;
  /** One top drawer row. count 1 is full width; count 2 is side by side. */
  drawerRows: StandardBaseDrawerRow[];
  genericImageUrl: string;
};

export type DrawerLayoutRow = { count: number; height?: number };

/** Nominal inches encoded by a standard door-base code, or null for every other family. */
export function standardBaseNominalWidth(masterCode: string | null | undefined): number | null {
  const stripped = stripHandedness(masterCode ?? "").code;
  const code = stripped.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = code.match(/^B(\d{1,2})$/);
  if (!match) return null;
  const width = Number(match[1]);
  if (!Number.isFinite(width) || width < 9 || width > 48) return null;
  return width;
}

export function isStandardDoorBase(masterCode: string | null | undefined): boolean {
  return standardBaseNominalWidth(masterCode) != null;
}

/**
 * Door count for a standard B-prefixed door base, including B-18 / B18 / B21-R
 * spellings. B21 and under is always 1. B24 and wider is always 2.
 * Returns null when the code is not a standard door base, so wall, sink,
 * drawer, tall, and specialty cabinets keep their own counts.
 *
 * `width` is accepted so callers can pass the cabinet record, but the code’s
 * nominal width wins. A B21 row whose width field says 30 is still one door.
 */
export function standardBaseDoorCount(
  masterCodeOrCabinet: string | null | undefined | { masterCode?: string | null; width?: number | string | null },
  _width?: number | string | null,
): number | null {
  const masterCode = typeof masterCodeOrCabinet === "object" && masterCodeOrCabinet
    ? masterCodeOrCabinet.masterCode
    : masterCodeOrCabinet;
  const width = standardBaseNominalWidth(masterCode ?? null);
  if (width == null) return null;
  return width <= 21 ? 1 : 2;
}

export function standardBaseFaceReference(masterCode: string | null | undefined): StandardBaseFaceReference | null {
  const width = standardBaseNominalWidth(masterCode);
  if (width == null) return null;
  const doors = width <= 21 ? 1 : 2;
  if (width <= 9) {
    return {
      width,
      doors,
      drawerRows: [],
      genericImageUrl: "/manus-storage/media-library/1790703557289_bt9_11bc4643",
    };
  }
  if (width < 33) {
    return {
      width,
      doors,
      drawerRows: [{ count: 1 }],
      genericImageUrl: width <= 21 ? STANDARD_BASE_NARROW_GENERIC_IMAGE : STANDARD_BASE_SINGLE_DRAWER_GENERIC_IMAGE,
    };
  }
  return {
    width,
    doors,
    drawerRows: [{ count: 2 }],
    genericImageUrl: STANDARD_BASE_B33_B42_GENERIC_IMAGE,
  };
}

/** Usable Edit Config drawer rows, or null when the JSON is empty or invalid. */
export function parsedDrawerLayoutRows(drawerLayout: string | null | undefined): DrawerLayoutRow[] | null {
  if (drawerLayout == null) return null;
  const trimmed = drawerLayout.trim();
  if (!trimmed || trimmed === "null") return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const rows: DrawerLayoutRow[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") return null;
      const count = Number((row as { count?: unknown }).count);
      if (!Number.isFinite(count) || count <= 0) return null;
      const heightRaw = (row as { height?: unknown }).height;
      const height = heightRaw == null || heightRaw === "" ? undefined : Number(heightRaw);
      rows.push({
        count: Math.max(1, Math.round(count)),
        ...(height != null && Number.isFinite(height) && height > 0 ? { height } : {}),
      });
    }
    return rows;
  } catch {
    return null;
  }
}

/**
 * Faces to draw for a standard door base. Doors always come from the width
 * table. Drawer fronts come from a saved drawerLayout when that JSON is usable,
 * otherwise from the table. Other cabinet families are returned unchanged.
 */
export function standardBaseRenderedCounts(input: {
  masterCode?: string | null;
  drawerLayout?: string | null;
  doors: number;
  drawers: number;
}): { doors: number; drawers: number } {
  const face = standardBaseFaceReference(input.masterCode);
  if (!face) return { doors: input.doors, drawers: input.drawers };
  const saved = parsedDrawerLayoutRows(input.drawerLayout);
  const drawers = saved
    ? saved.reduce((sum, row) => sum + row.count, 0)
    : face.drawerRows.reduce((sum, row) => sum + row.count, 0);
  return { doors: face.doors, drawers };
}

/** Blocks saving two or more doors on a standard base of 21 inches or less. */
export function standardBaseDoorSaveError(
  masterCode: string | null | undefined,
  numberOfDoors: number | null | undefined,
): string | null {
  if (standardBaseDoorCount(masterCode) !== 1) return null;
  if (numberOfDoors == null || numberOfDoors < 2) return null;
  const label = (masterCode ?? "This cabinet").trim() || "This cabinet";
  return `${label} is a standard base 21 inches or under (B09–B21). It always has one door, so saving ${numberOfDoors} doors is blocked.`;
}

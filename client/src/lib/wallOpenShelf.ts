/**
 * One contract for every catalog wall open-shelf cabinet (WEOS / WOS / OE6).
 *
 * An open shelf is a finished, doorless wall box: solid top, bottom, back and
 * two finished sides, an open front, and a configurable number of fixed
 * interior shelves. It is never a thin floating shelf, never a door cabinet, and
 * never a face-frame box.
 *
 * The shared rules that plan, elevation and the 3D scene all read live here so
 * the three views cannot drift:
 *   - nominal size comes from the code (WEOS0930 = 9"W x 30"H, 12" deep)
 *   - shelf count comes from the cabinet's own edit config
 *   - shelves sit on evenly spaced centers between the top and bottom panels
 *   - the exposed run end carries the radiused shelf-front corner
 *
 * Purely visual/configuration normalization: price, availability, image and the
 * sellable SKU identity are never changed here.
 */

/** Nominal wall depth of the wall open-shelf families, in inches. */
export const WALL_OPEN_SHELF_DEPTH_IN = 12;

/** Longest / shortest shelf-front radius a 9-inch-wide end shelf can carry. */
export const WALL_OPEN_SHELF_MAX_RADIUS_IN = 4;
export const WALL_OPEN_SHELF_MIN_RADIUS_IN = 0.5;

export type WallOpenShelfLike = {
  masterCode?: string | null;
  description?: string | null;
  subCategory?: string | null;
  /** Placed copy of Cabinet Config `numberOfFixedShelves`. */
  fixedShelfCount?: number | null;
  /** Raw catalog column, for rows read before they are placed. */
  numberOfFixedShelves?: number | null;
  numberOfAdjShelves?: number | null;
  width?: unknown;
  height?: unknown;
  depth?: unknown;
};

/** Uppercase, punctuation-free SKU text so WEOS-09-30 and WEOS0930 agree. */
export function wallOpenShelfCode(source: string | null | undefined): string {
  return `${source ?? ""}`.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

/** A Wall End Open Shelf SKU: WEOS0930 / WEOS0936 / WEOS0942. */
export function isWallEndOpenShelfCode(source: string | null | undefined): boolean {
  return /^WEOS\d{4}$/.test(wallOpenShelfCode(source));
}

/**
 * Code-declared size, width first then height, always at the 12-inch wall depth.
 * WEOS0930 is therefore 9"W x 30"H x 12"D. Returns null for a code that does not
 * carry its own size; nothing is guessed from a description in that case.
 */
export function wallOpenShelfNominalSize(
  source: string | null | undefined,
): { width: number; height: number; depth: number } | null {
  const code = wallOpenShelfCode(source);
  const match = /^W(?:E)?OS(\d{2})(\d{2})$/.exec(code);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height, depth: WALL_OPEN_SHELF_DEPTH_IN };
}

/**
 * The 2023 KitchenCrest line-art book documents OE630/OE636/OE642 as square
 * six-inch wall open-end shelves: two interior shelves at 30 inches and three
 * at 36/42 inches. The code and an explicit open-shelf description must both
 * match, so an unrelated source line can never inherit this generic form.
 */
export function kitchenCrestOpenEndShelfCount(c: WallOpenShelfLike): number | null {
  const code = wallOpenShelfCode(c.masterCode);
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""}`.toLowerCase();
  if (!/^OE6(?:30|36|42)$/.test(code) || !/\bopen\s+(?:end\s+)?shelf\b/.test(hay)) return null;
  return code === "OE630" ? 2 : 3;
}

/**
 * True for a full-height, wall-mounted open-shelf cabinet — the WOS/WEOS wall
 * families and the OE6 open-end line. A thin floating shelf (FS) is not this.
 */
export function isWallOpenShelfCabinet(c: WallOpenShelfLike): boolean {
  const code = wallOpenShelfCode(c.masterCode);
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""}`.toLowerCase();
  return /^W(?:E)?OS\d{4}$/.test(code)
    || kitchenCrestOpenEndShelfCount(c) != null
    || /\bwall\s+(?:end\s+)?open\s+shelf\b|\bwall\s+end\s+shelf\b|\bopen\s+end\s+shelf\s+wall\b/.test(hay);
}

/**
 * The number of fixed interior shelves this cabinet is configured with, and
 * where that number came from.
 *
 * Authority order:
 *   1. the supplied KitchenCrest OE6 line-art count for that one
 *      description-confirmed family (its live master row carries a stale count)
 *   2. the cabinet's own edit config (`fixedShelfCount` / `numberOfFixedShelves`)
 *   3. the Wall End Open Shelf family's source drawing, which shows two shelves
 *
 * Nothing else invents a shelf. A config of 0 stays 0, and a missing config on a
 * cabinet with no source count stays 0 rather than defaulting to a stock number.
 */
export function wallOpenShelfShelfCount(c: WallOpenShelfLike): {
  count: number;
  source: "config" | "kitchencrest-line-art" | "wall-end-source" | "none";
} {
  const lineArt = kitchenCrestOpenEndShelfCount(c);
  if (lineArt != null) return { count: lineArt, source: "kitchencrest-line-art" };
  const configured = Number(c.fixedShelfCount ?? c.numberOfFixedShelves);
  if (Number.isFinite(configured) && configured >= 0) {
    return { count: Math.min(6, Math.round(configured)), source: "config" };
  }
  if (isWallEndOpenShelfCode(c.masterCode)) return { count: 2, source: "wall-end-source" };
  return { count: 0, source: "none" };
}

/** An open shelf never has a door or a drawer face, whatever the row says. */
export function wallOpenShelfFaceCounts(): { doors: number; drawers: number } {
  return { doors: 0, drawers: 0 };
}

/**
 * Evenly spaced shelf centers, measured in inches up from the inside of the
 * bottom panel. `interiorHeightIn` excludes the top and bottom panels; `count`
 * boards divide that opening into `count + 1` equal compartments.
 */
export function wallOpenShelfShelfCenters(
  interiorHeightIn: number,
  count: number,
): number[] {
  const boards = Math.max(0, Math.round(count));
  const opening = Math.max(0, interiorHeightIn);
  if (boards === 0) return [];
  return Array.from({ length: boards }, (_, index) => (opening * (index + 1)) / (boards + 1));
}

/**
 * Radius of the rounded front corner on a shelf's exposed end. It is bounded by
 * the board width and depth so a 9-inch shelf can never produce a nonsense arc.
 */
export function wallOpenShelfShelfRadius(widthIn: number, depthIn: number): number {
  const limit = Math.min(widthIn * 0.45, depthIn * 0.45, WALL_OPEN_SHELF_MAX_RADIUS_IN);
  if (!(limit > 0)) return WALL_OPEN_SHELF_MIN_RADIUS_IN;
  return Math.min(limit, 2);
}

/**
 * Which end of the cabinet is the exposed run end, in the cabinet's own local
 * frame (+1 = viewer's right). Returns null when both ends butt a neighbor, so
 * a mid-run shelf keeps two square shelf ends.
 */
export function wallOpenShelfExposedEnd(
  touchesStart: boolean,
  touchesEnd: boolean,
): -1 | 1 | null {
  if (touchesStart === touchesEnd) return null;
  return touchesEnd ? 1 : -1;
}

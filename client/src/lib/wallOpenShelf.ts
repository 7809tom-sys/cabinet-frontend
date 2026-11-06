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

/**
 * The one canonical spelling of a Wall Open Shelf code.
 *
 * Faircrest's 2020 catalog calls this cabinet `WOS`. Distributor sheets and
 * saved plans also carry `WEOS` and the misspelling `WOES`. All three name the
 * same box, so every spelling resolves to the `WOS` master:
 *
 *   WEOS0930 -> WOS0930     WOES0930 -> WOS0930     WOS0930 -> WOS0930
 *
 * Returns null for a code that is not this family. The alias changes only which
 * code is looked up; it never invents a catalog row, a price, or a size.
 */
export function canonicalWallOpenShelfCode(source: string | null | undefined): string | null {
  const code = wallOpenShelfCode(source);
  // WOS (catalog), WEOS (distributor sheets) and WOES (misspelling) all name
  // the same box. Note WOES is O-before-E, so it cannot share a single
  // optional-alternation with WEOS.
  const match = /^(?:WOS|WEOS|WOES)(\d{2})(\d{2})$/.exec(code);
  return match ? `WOS${match[1]}${match[2]}` : null;
}

/**
 * A Wall Open Shelf SKU in any accepted spelling (WOS / WEOS / WOES), with or
 * without a `-L` / `-R` handing suffix — the suffix is an orientation of the
 * same catalog item, never a different one.
 */
export function isWallEndOpenShelfCode(source: string | null | undefined): boolean {
  return splitWallOpenShelfHand(source).canonical != null;
}

/**
 * Every spelling this family accepts, in the order the product name prefers:
 * the catalog's own `WOS` first, then the distributor `WEOS`, then `WOES`.
 */
export function wallOpenShelfCodeSpellings(source: string | null | undefined): string[] {
  const canonical = canonicalWallOpenShelfCode(source);
  if (!canonical) return [];
  const size = canonical.slice(3);
  return [`WOS${size}`, `WEOS${size}`, `WOES${size}`];
}

/**
 * The handed orientation of an open shelf: which end is the open/exposed end, as
 * a viewer hand. "left" means the open end and its rounded shelf fronts are on
 * the viewer's left and the solid side panel goes on the right.
 */
export type WallOpenShelfHand = "left" | "right";

/**
 * Split an optional trailing handedness marker off an open-shelf code.
 *
 * The open shelf is ONE catalog item per size that supports both hands, so a
 * code may carry a `-L` / `-R` (or glued `L` / `R`) suffix purely as an
 * orientation. `WOS0930-L`, `WOS0930-R`, `WEOS0930-L`, `WEOS0930L` and `WOS0930`
 * all name the same 9"W x 30"H cabinet; only the hand differs.
 *
 * This is the same single-trailing-marker rule `shared/codeMatch.ts`
 * `stripHandedness` uses for other handed cabinets, kept local and small so it
 * stays independent of the general catalog alias layer.
 */
export function splitWallOpenShelfHand(source: string | null | undefined): {
  /** The size-bearing canonical WOS code, or null when this is not the family. */
  canonical: string | null;
  /** The hand the code asked for, or null when the code carries no hand. */
  hand: WallOpenShelfHand | null;
} {
  const code = wallOpenShelfCode(source);
  // A single trailing L/R, optionally dash-separated, after the four size digits.
  const match = /^(.*?)(?:-)?(L|R)$/.exec(code);
  if (match) {
    const canonical = canonicalWallOpenShelfCode(match[1]);
    // Guard: only accept the suffix when the remainder is a real open shelf, so
    // an unrelated code ending in L/R is never reinterpreted.
    if (canonical) return { canonical, hand: match[2] === "L" ? "left" : "right" };
  }
  return { canonical: canonicalWallOpenShelfCode(code), hand: null };
}

/**
 * Resolve the hand a placed open shelf should render with.
 *
 * Precedence: an explicit saved hand in the edit config (`openShelfHand`) wins,
 * then a hand encoded in the code (`WOS0930-L`), then the measured run end
 * (`measuredHand`, i.e. the side that faces open space). A standalone shelf with
 * no neighbour and no explicit hand defaults to the viewer's right.
 */
export function resolvedWallOpenShelfHand(input: {
  masterCode?: string | null;
  openShelfHand?: WallOpenShelfHand | null;
  measuredHand?: WallOpenShelfHand | null;
}): WallOpenShelfHand {
  if (input.openShelfHand === "left" || input.openShelfHand === "right") return input.openShelfHand;
  const fromCode = splitWallOpenShelfHand(input.masterCode).hand;
  if (fromCode) return fromCode;
  if (input.measuredHand === "left" || input.measuredHand === "right") return input.measuredHand;
  return "right";
}

/**
 * Code-declared size, width first then height, at the internal wall depth.
 * WEOS0930 is 9"W x 30"H and WEOS1236 is 12"W x 36"H. Returns null for a code
 * that does not carry its own size; nothing is guessed from a description.
 *
 * Depth is an internal geometry constant and is never shown to a customer.
 */
export function wallOpenShelfNominalSize(
  source: string | null | undefined,
): { width: number; height: number; depth: number } | null {
  const canonical = splitWallOpenShelfHand(source).canonical;
  const match = canonical ? /^WOS(\d{2})(\d{2})$/.exec(canonical) : null;
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
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""}`.toLowerCase();
  return isWallEndOpenShelfCode(c.masterCode)
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
 * A configured 0 stays 0 — an explicitly empty open shelf draws no shelf. Only a
 * genuinely MISSING config (null / undefined, not zero) falls through to the
 * family's two-shelf source drawing. Reading the config through `Number()` would
 * turn null into 0 and silently drop that fallback.
 */
export function wallOpenShelfShelfCount(c: WallOpenShelfLike): {
  count: number;
  source: "config" | "kitchencrest-line-art" | "wall-end-source" | "none";
} {
  const lineArt = kitchenCrestOpenEndShelfCount(c);
  if (lineArt != null) return { count: lineArt, source: "kitchencrest-line-art" };
  const configured = c.fixedShelfCount ?? c.numberOfFixedShelves;
  // An authored number (including 0) is authoritative; null/undefined is not.
  if (configured != null && Number.isFinite(Number(configured)) && Number(configured) >= 0) {
    return { count: Math.min(6, Math.round(Number(configured))), source: "config" };
  }
  if (isWallEndOpenShelfCode(c.masterCode)) return { count: 2, source: "wall-end-source" };
  return { count: 0, source: "none" };
}

/** An open shelf never has a door or a drawer face, whatever the row says. */
export function wallOpenShelfFaceCounts(): { doors: number; drawers: number } {
  return { doors: 0, drawers: 0 };
}

/**
 * The one customer-facing name for an open shelf: `Open Shelf 9"W x 30"H`.
 *
 * Width and height only — cabinet depth is standard across the line and is
 * never shown, in the palette, the selected-item panel, plan and elevation
 * labels, or a cart line. Returns null for anything that is not a wall open
 * shelf, so a caller keeps the catalog description for every other cabinet.
 */
export function wallOpenShelfDisplayName(c: WallOpenShelfLike): string | null {
  if (!isWallOpenShelfCabinet(c)) return null;
  const nominal = wallOpenShelfNominalSize(c.masterCode);
  const width = nominal?.width ?? trimmedDimension(c.width);
  const height = nominal?.height ?? trimmedDimension(c.height);
  if (width == null || height == null) return null;
  return `Open Shelf ${width}"W x ${height}"H`;
}

/** A dimension that drops a trailing .0 so labels read 9, not 9.0. */
function trimmedDimension(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
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

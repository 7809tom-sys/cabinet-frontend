/**
 * Single-door 24-inch rows: still sold, still selectable, never the default.
 *
 * Issue #354 item 4 (Tom, Nov 9 2026): "designer and Auto Design use two-door
 * cabinets at 24 in wide and up and one door at 21 in and under, across all
 * USCD frameless lines. The book also lists single-door 24in SKUs (B24S,
 * W2430S); do not delete them from data, but Auto Design and default picks must
 * use the two-door version."
 *
 * The book (altaeuro V8.2 pp. 20-22, 27-28, 37, 64-65) prints both a single
 * and a double at 24" for several families:
 *
 *   Bases     B24S / B24SFH / B24        (1 door vs 2)
 *   Sinks     SB24S / SB24 (and the FH pair)
 *   Vanities  VSB24S / VSB24
 *   Walls 30" W2430S / W2430             (1 door vs 2)
 *
 * Walls 35" and 40" have no 24" single: the double starts at W2435 / W2440.
 *
 * What this module does:
 *   - `singleDoorTwentyFourSuffix` recognises the `S` variant so a caller can
 *     name it. Nothing is removed, renamed, or aliased.
 *   - `isSingleDoorTwentyFourRow` is what the auto picks exclude: a row whose
 *     code carries that `S` at the 24" width never enters a default pick.
 *   - `singleDoorTwentyFourReport` lists where such a row is still selectable,
 *     so the change can be audited without guessing.
 *
 * The rows stay in the catalog and in the palette. Auto Design's pick list is
 * unchanged. Drawing and shopper copy for a placed or displayed 24" single-door
 * row are corrected in shared/twentyFourDoorFace.ts: Tom later confirmed there
 * is no single-door 24" cabinet, so those rows are drawn and described as two
 * doors without renaming the SKU.
 */
import { COLLISION_EPSILON_IN, dim, type DesignCabinet } from "./design";

/** Width at which the book prints both a single- and a double-door cabinet. */
export const SINGLE_DOOR_SPLIT_WIDTH_IN = 24;

/** Families whose 24" row has an `S` single-door variant in the book. */
const SINGLE_DOOR_TWENTY_FOUR = /^(?:(?:B|SB|VSB)24S(?:FH)?|W2430S)$/;

function compact(masterCode: string | null | undefined): string {
  return (masterCode ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** True for a 24" single-door code (`B24S`, `B24SFH`, `SB24S`, `VSB24S`, `W2430S`). */
export function isSingleDoorTwentyFourCode(masterCode: string | null | undefined): boolean {
  return SINGLE_DOOR_TWENTY_FOUR.test(compact(masterCode));
}

/**
 * True for a catalog row the default picks and Auto Design must skip because it
 * is the single-door variant of a width the book also sells as a double. The
 * row itself is untouched and stays selectable by hand.
 */
export function isSingleDoorTwentyFourRow(row: { masterCode?: string | null }): boolean {
  return isSingleDoorTwentyFourCode(row.masterCode);
}

/**
 * The default-pick catalog: every row the book sells except the 24" single-door
 * variants. Doors are never changed on a row that is already placed; this only
 * shapes what an automatic pick may choose.
 */
export function defaultPickRows<T extends { masterCode?: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isSingleDoorTwentyFourRow(row));
}

export type SingleDoorTwentyFourEntry = {
  masterCode: string;
  description: string | null;
  width: number;
  placement: string | null;
  /** Where the row is still offered to the customer. */
  stillSelectableIn: string[];
};

/**
 * Where the 24" single-door rows remain selectable. The designer palette is the
 * one place a customer can still pick them; they are never a default and never
 * an Auto-Design pick.
 */
export function singleDoorTwentyFourReport(rows: readonly DesignCabinet[]): SingleDoorTwentyFourEntry[] {
  return rows
    .filter((row) => isSingleDoorTwentyFourRow(row))
    .filter((row) => Math.abs(dim(row.width, 0) - SINGLE_DOOR_SPLIT_WIDTH_IN) <= COLLISION_EPSILON_IN || /^W2430S$/.test(compact(row.masterCode)))
    .map((row) => ({
      masterCode: row.masterCode ?? "",
      description: row.description ?? null,
      width: dim(row.width, 0),
      placement: row.placement ?? null,
      stillSelectableIn: [
        "Designer catalog palette (by hand; never a default)",
        "Catalog administration and spec book data (never deleted)",
        "Order lines when a saved plan already carries the code",
      ],
    }));
}

/**
 * Upper widths Auto Design steers around (Tom, Nov 17 2026).
 *
 * No cabinet line sells a 9" or 39" glass stacker, so either width left a blank
 * spot above the upper when "Glass cabinets above" is on.
 * - 39" is never placed. A 39" span is tiled as two cabinets that do have
 *   stackers (W2730 + W1230, W2130 + W1830).
 * - 9" is not used by the run tilers. Every multiple of 3" from 12" up tiles
 *   without it, so a 9" upper plus a 3" filler becomes the single 12" cabinet.
 *   The final gap closer may still use a 9" box when nothing else fits the
 *   opening (a 9"-11⅞" hole), because a cabinet beats a filler.
 */
export const AUTO_DESIGN_NEVER_UPPER_WIDTHS_IN: readonly number[] = [39];
export const AUTO_DESIGN_LAST_RESORT_UPPER_WIDTHS_IN: readonly number[] = [9];

const WIDTH_MATCH_IN = 0.05;

function widthIn(row: { width?: string | number | null }): number {
  return Number.parseFloat(String(row.width ?? ""));
}

function matches(width: number, list: readonly number[]): boolean {
  return Number.isFinite(width) && list.some((skip) => Math.abs(width - skip) <= WIDTH_MATCH_IN);
}

/** A 39" upper: never placed by Auto Design. */
export function isAutoDesignNeverUpperWidth(row: { width?: string | number | null }): boolean {
  return matches(widthIn(row), AUTO_DESIGN_NEVER_UPPER_WIDTHS_IN);
}

/** A 9" upper: only when no other cabinet fits the opening. */
export function isAutoDesignLastResortUpperWidth(width: number): boolean {
  return matches(width, AUTO_DESIGN_LAST_RESORT_UPPER_WIDTHS_IN);
}

/** Widths the run tilers (aligned run, repack, upper-to-base match) skip: 9" and 39". */
export function isAutoDesignSkippedUpperWidth(row: { width?: string | number | null }): boolean {
  return isAutoDesignNeverUpperWidth(row) || isAutoDesignLastResortUpperWidth(widthIn(row));
}

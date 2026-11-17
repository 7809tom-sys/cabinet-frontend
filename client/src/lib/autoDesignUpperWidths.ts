/**
 * Upper widths Auto Design steers around (Tom, Nov 17 2026).
 *
 * - 39" is never placed: no line sells a 39" glass stacker and a 39" box over
 *   two bases never lines up with the seams. A 39" span is tiled as two real
 *   cabinets (W2130 + W1830, W2730 + W1230).
 * - 9" stays a normal width. Tom's v2 Aero Solstice plan (Nov 17 2026, 2:51 PM
 *   CT) keeps the 9" upper beside the diagonal corner and puts glass on it
 *   (a 12" stacker spanning the 9" box and its 3" filler), so the run tilers
 *   no longer drop it. The "last resort" list is kept, empty, so the hooks from
 *   fix/auto-design-no-39-9-uppers (f8d1076) stay in one place.
 */
export const AUTO_DESIGN_NEVER_UPPER_WIDTHS_IN: readonly number[] = [39];
export const AUTO_DESIGN_LAST_RESORT_UPPER_WIDTHS_IN: readonly number[] = [];

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

/** A width used only when no other cabinet fits the opening (none today). */
export function isAutoDesignLastResortUpperWidth(width: number): boolean {
  return matches(width, AUTO_DESIGN_LAST_RESORT_UPPER_WIDTHS_IN);
}

/** Widths the run tilers (aligned run, repack, upper-to-base match) skip: 39". */
export function isAutoDesignSkippedUpperWidth(row: { width?: string | number | null }): boolean {
  return isAutoDesignNeverUpperWidth(row) || isAutoDesignLastResortUpperWidth(widthIn(row));
}

/** Widths Tom asked for first when uppers are re-tiled (Nov 17 2026). */
const PREFERRED_UPPER_WIDTHS_IN = [21, 30] as const;

function isPreferredWidth(width: number): boolean {
  return PREFERRED_UPPER_WIDTHS_IN.some((wanted) => Math.abs(width - wanted) <= WIDTH_MATCH_IN);
}

/** Real widths (at most two pieces) that close `span` exactly, 21"/30" first. */
export function autoDesignExactUpperTiling(span: number, widths: readonly number[]): number[] | null {
  if (span <= 0.1) return [];
  const usable = Array.from(new Set(widths)).filter((width) => width >= 9 - WIDTH_MATCH_IN).sort((a, b) => b - a);
  const single = usable.find((width) => Math.abs(width - span) <= WIDTH_MATCH_IN);
  if (single != null && !(Math.abs(span - 42) <= WIDTH_MATCH_IN)) return [single];
  let best: { pieces: number[]; score: number } | null = null;
  for (const first of usable) {
    const second = usable.find((width) => Math.abs(first + width - span) <= WIDTH_MATCH_IN);
    if (second == null) continue;
    // 21/30 first, an equal pair next; a 9" box only when nothing else closes the span.
    const nine = (width: number) => (Math.abs(width - 9) <= WIDTH_MATCH_IN ? 0.75 : 0);
    const score = (isPreferredWidth(first) ? 1 : 0) + (isPreferredWidth(second) ? 1 : 0) + (Math.abs(first - second) <= WIDTH_MATCH_IN ? 0.5 : 0)
      - nine(first) - nine(second);
    const pieces = isPreferredWidth(second) && !isPreferredWidth(first) ? [second, first] : [first, second];
    if (!best || score > best.score) best = { pieces, score };
  }
  if (best) return best.pieces;
  return single != null ? [single] : null;
}

/**
 * Two Auto-Design dialog rules from Tom (owner voice, Nov 24 2026):
 *
 * 12:27 PM CT: "When the user selects wall two, the range and sink should be
 * placed on that wall automatically, centered, and the user can then readjust
 * their positions." -> `centeredSinkRangePair`.
 *
 * 12:28 PM CT: "If the user is picking a 36 inch sink base, they should qualify
 * for the 36 inch sink base ... When the placement math qualifies for a 36 inch
 * sink base, do not offer smaller sink bases like 24 inch. Only show sink bases
 * that fit the qualified size and larger." -> `sinkBaseFitOptions`.
 *
 * Pure: inches in measurement space (from the wall's labeled start). The usable
 * span already has the corner cabinet's room taken off any end that meets
 * another run (see `autoDesignWallUsableSpan`).
 */

export type Interval = { start: number; end: number };

/** Counter between the sink group and the range: preferred landing first, then the minimum. */
export const AUTO_DESIGN_PAIR_GAPS_IN = [18, 15] as const;
/** Steps when the centered pair has to move off a window or door. */
export const AUTO_DESIGN_PAIR_SHIFT_STEP_IN = 3;
export const AUTO_DESIGN_SINK_BASE_WIDTHS = [30, 33, 36, 42] as const;
export const AUTO_DESIGN_QUALIFIED_SINK_BASE_IN = 36;

const EPS = 0.01;

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end - EPS && b.start < a.end - EPS;
}

export type CenteredPairInput = {
  lo: number;
  hi: number;
  sinkBaseWidthIn: number;
  dishwasherSide: "left" | "right" | "none";
  dishwasherWidthIn?: number;
  stoveWidthIn?: number;
  /** False when the range is "Do not add": the sink group is centered alone. */
  includeStove?: boolean;
  /** Windows and doors: the range never sits under a window or across a door. */
  blockedForRange?: readonly Interval[];
  /** Doors: no base cabinet across a doorway (a sink under a window is fine). */
  blockedForSink?: readonly Interval[];
};

export type CenteredPair = {
  sinkCenterIn: number;
  stoveCenterIn: number | null;
  gapIn: number;
  order: "sink-first" | "range-first";
  /** How far the pair moved off the true center to clear a window or door. */
  shiftIn: number;
  /** True when no position cleared every opening; the build then reports it. */
  openingConflict: boolean;
};

/**
 * Centers the sink group (sink base plus the dishwasher on its chosen side) and
 * the range as one pair on the wall's usable span, `gap` of counter between them.
 * Order: sink first (nearer the wall start), range after. If the range would sit
 * under a window or either piece across a door, the order flips, then the pair
 * slides in 3 in steps (nearest the center first) until it clears. Null when the
 * pair does not fit the wall even at the 15 in minimum landing.
 */
export function centeredSinkRangePair(input: CenteredPairInput): CenteredPair | null {
  const dw = input.dishwasherSide === "none" ? 0 : (input.dishwasherWidthIn ?? 24);
  const stove = input.includeStove === false ? 0 : (input.stoveWidthIn ?? 30);
  const group = input.sinkBaseWidthIn + dw;
  const span = input.hi - input.lo;
  const sinkOffsetInGroup = (input.dishwasherSide === "left" ? dw : 0) + input.sinkBaseWidthIn / 2;
  const gaps = stove > 0 ? AUTO_DESIGN_PAIR_GAPS_IN : [0];
  for (const gap of gaps) {
    const total = group + gap + stove;
    if (total > span + EPS) continue;
    const centeredStart = input.lo + (span - total) / 2;
    const place = (start: number, order: CenteredPair["order"]) => {
      const groupStart = order === "sink-first" ? start : start + stove + gap;
      const stoveStart = order === "sink-first" ? start + group + gap : start;
      return {
        groupSpan: { start: groupStart, end: groupStart + group },
        stoveSpan: stove > 0 ? { start: stoveStart, end: stoveStart + stove } : null,
        sinkCenterIn: groupStart + sinkOffsetInGroup,
        stoveCenterIn: stove > 0 ? stoveStart + stove / 2 : null,
      };
    };
    const clear = (spot: ReturnType<typeof place>) => (
      !(input.blockedForSink ?? []).some((block) => overlaps(spot.groupSpan, block))
      && !(spot.stoveSpan && (input.blockedForRange ?? []).some((block) => overlaps(spot.stoveSpan!, block)))
    );
    const maxShift = Math.max(centeredStart - input.lo, input.hi - total - centeredStart);
    for (let magnitude = 0; magnitude <= maxShift + EPS; magnitude += AUTO_DESIGN_PAIR_SHIFT_STEP_IN) {
      const shifts = magnitude === 0 ? [0] : [-magnitude, magnitude];
      for (const shift of shifts) {
        const start = centeredStart + shift;
        if (start < input.lo - EPS || start + total > input.hi + EPS) continue;
        for (const order of ["sink-first", "range-first"] as const) {
          if (stove === 0 && order === "range-first") continue;
          const spot = place(start, order);
          if (clear(spot)) {
            return { sinkCenterIn: round(spot.sinkCenterIn), stoveCenterIn: spot.stoveCenterIn == null ? null : round(spot.stoveCenterIn), gapIn: gap, order, shiftIn: shift, openingConflict: false };
          }
        }
      }
    }
    const spot = place(centeredStart, "sink-first");
    return { sinkCenterIn: round(spot.sinkCenterIn), stoveCenterIn: spot.stoveCenterIn == null ? null : round(spot.stoveCenterIn), gapIn: gap, order: "sink-first", shiftIn: 0, openingConflict: true };
  }
  return null;
}

export type SinkBaseFitInput = {
  lo: number;
  hi: number;
  /** The sink's center on its wall, or null when Auto-Design still chooses it. */
  sinkCenterIn: number | null;
  dishwasherSide: "left" | "right" | "none";
  dishwasherWidthIn?: number;
  /** Other items already on the sink's wall (range, refrigerator bay) and doorways. */
  obstacles?: readonly Interval[];
  widths?: readonly number[];
};

export type SinkBaseFit = {
  /** Every width whose sink group fits at the sink spot. */
  fits: number[];
  /** True when the 36 in sink base fits: smaller sink bases are then not offered. */
  qualifies36: boolean;
  /** The widths the dialog offers (enabled). */
  offered: number[];
  /** Widths shown but disabled, each with a short reason. */
  disabled: { width: number; reason: string }[];
  /** The width to select when the current pick is not offered. */
  recommended: number | null;
};

function freeSegments(lo: number, hi: number, obstacles: readonly Interval[]): Interval[] {
  const sorted = [...obstacles].filter((o) => o.end > lo && o.start < hi).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  let cursor = lo;
  for (const block of sorted) {
    if (block.start > cursor + EPS) out.push({ start: cursor, end: Math.min(block.start, hi) });
    cursor = Math.max(cursor, block.end);
  }
  if (hi > cursor + EPS) out.push({ start: cursor, end: hi });
  return out;
}

/**
 * Which sink-base widths the selected wall can take at the sink spot, after the
 * corner cabinet's room, the other appliances and doorways are reserved. If the
 * 36 in qualifies, only 36 in and larger widths that also fit are offered; if it
 * does not, 36 in (and anything larger) is disabled with a reason and the
 * largest smaller width that fits is recommended.
 */
export function sinkBaseFitOptions(input: SinkBaseFitInput): SinkBaseFit {
  const widths = [...(input.widths ?? AUTO_DESIGN_SINK_BASE_WIDTHS)].sort((a, b) => a - b);
  const dw = input.dishwasherSide === "none" ? 0 : (input.dishwasherWidthIn ?? 24);
  const segments = freeSegments(input.lo, input.hi, input.obstacles ?? []);
  const groupFor = (width: number): Interval | null => {
    if (input.sinkCenterIn == null) return null;
    const sinkStart = input.sinkCenterIn - width / 2;
    const start = input.dishwasherSide === "left" ? sinkStart - dw : sinkStart;
    return { start, end: start + width + dw };
  };
  const roomAtSpot = (): number => {
    if (input.sinkCenterIn == null) return Math.max(0, ...segments.map((s) => s.end - s.start));
    const host = segments.find((s) => s.start - EPS <= input.sinkCenterIn! && input.sinkCenterIn! <= s.end + EPS);
    return host ? host.end - host.start : 0;
  };
  const fitsWidth = (width: number): boolean => {
    const group = groupFor(width);
    if (!group) return segments.some((s) => s.end - s.start >= width + dw - EPS);
    return segments.some((s) => group.start >= s.start - EPS && group.end <= s.end + EPS);
  };
  const fits = widths.filter(fitsWidth);
  const qualifies36 = fits.includes(AUTO_DESIGN_QUALIFIED_SINK_BASE_IN);
  const offered = qualifies36 ? fits.filter((w) => w >= AUTO_DESIGN_QUALIFIED_SINK_BASE_IN) : fits;
  const free = roomAtSpot();
  const disabled = widths
    .filter((w) => !offered.includes(w) && (!qualifies36 || w >= AUTO_DESIGN_QUALIFIED_SINK_BASE_IN))
    .map((w) => ({
      width: w,
      reason: `SB${w} needs ${w + dw} in${dw ? " with the dishwasher" : ""}; about ${round(free)} in is free at the sink spot after the corner cabinet and nearby appliances.`,
    }));
  const recommended = offered.length ? (qualifies36 ? AUTO_DESIGN_QUALIFIED_SINK_BASE_IN : offered[offered.length - 1]!) : null;
  return { fits, qualifies36, offered, disabled, recommended };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

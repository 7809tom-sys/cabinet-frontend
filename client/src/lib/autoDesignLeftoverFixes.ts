/**
 * A leftover opening is filled with a REAL cabinet, not filler and not a bare gap.
 *
 * Owner rules:
 *   - Filler is the last resort. Before a filler goes in, slide the non-anchored
 *     cabinets beside the opening within the wiggle room, or widen a neighbor, or
 *     seat a real narrow cabinet.
 *   - A 6 inch opening defaults to a spice / pull-out base, because that is what a
 *     6 inch cabinet is for.
 *   - Whatever is chosen is shown the homeowner way: "Here's my alternative,
 *     closest to what you want..." with Accept / Show another option.
 *
 * The order is always: real narrow cabinet of that exact width → widen the
 * neighbor to a bigger real cabinet → slide to open a fit → filler last.
 */
import { cabinetDrawingType } from "./cabinetGraphics";
import { isCornerCabinet, isSinkBaseCabinet, type DesignCabinet } from "./design";
import { AUTO_DESIGN_FILLER_MAX_IN } from "./autoDesignSeamFillers";
import type { Alternative, AlternativeKind } from "./designAlternatives";

/** Widest opening that is still a single narrow cabinet rather than a run piece. */
export const LEFTOVER_NARROW_MAX_IN = 15;
/** A 6 inch opening is a spice / pull-out base by default. */
export const LEFTOVER_SPICE_WIDTH_IN = 6;

export type LeftoverFixKind = "narrow-cabinet" | "widen-neighbor" | "slide" | "filler";

export type LeftoverFix<T extends DesignCabinet = DesignCabinet> = {
  kind: LeftoverFixKind;
  /** The cabinet to place (null for a filler / slide). */
  cabinet: T | null;
  /** Installed width after the fix. */
  widthIn: number;
  /** For a widen: the neighbor that grows. */
  neighborUid?: string | null;
  /** Plain homeowner sentence. No SKU, no jargon. */
  summary: string;
};

function numberWidth(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

function plainWidth(value: number): string {
  const rounded = Math.round(value * 8) / 8;
  const whole = Math.floor(rounded);
  const half = rounded - whole;
  if (Math.abs(half) < 0.01) return `${whole}`;
  if (Math.abs(half - 0.5) < 0.01) return `${whole} and a half`;
  return `${rounded}`;
}

/** A narrow, real, straight cabinet that can stand on its own in a small opening. */
export function isNarrowLeftoverCabinet(row: DesignCabinet): boolean {
  if (row.placement !== "base") return false;
  if (isCornerCabinet(row.masterCode, row.description) || isSinkBaseCabinet(row)) return false;
  const width = numberWidth(row.width);
  if (!(width > 0) || width > LEFTOVER_NARROW_MAX_IN) return false;
  const text = `${row.masterCode ?? ""} ${row.description ?? ""} ${row.subCategory ?? ""}`.toLowerCase();
  if (/filler|panel|skin|moulding|molding|crown|valance|tray|sample/.test(text)) return false;
  // Any real base box counts: a spice pull-out, a plain base, a tray base, a wine base.
  return cabinetDrawingType(row) !== undefined;
}

/** Spice / pull-out bases first, then any real narrow base, at that exact width. */
function narrowCandidates<T extends DesignCabinet>(catalog: readonly T[], widthIn: number): T[] {
  const fits = catalog.filter((row) => isNarrowLeftoverCabinet(row) && Math.abs(numberWidth(row.width) - widthIn) <= 0.05);
  const rank = (row: T) => {
    const text = `${row.masterCode ?? ""} ${row.description ?? ""} ${row.subCategory ?? ""}`.toLowerCase();
    if (/spice|pull[- ]?out/.test(text)) return 0;
    if (/tray/.test(text)) return 1;
    if (/wine/.test(text)) return 2;
    return 3;
  };
  return [...fits].sort((left, right) => rank(left) - rank(right)
    || (left.masterCode ?? "").localeCompare(right.masterCode ?? "", undefined, { numeric: true }));
}

/** Wider real cabinets of the same family that could absorb the opening. */
function widenCandidates<T extends DesignCabinet>(
  neighbor: { masterCode?: string | null; width?: string | number | null } | null,
  catalog: readonly T[],
  targetWidthIn: number,
): T[] {
  if (!neighbor) return [];
  const family = /^([A-Z]+)/i.exec(neighbor.masterCode ?? "")?.[1]?.toUpperCase();
  if (!family) return [];
  return catalog
    .filter((row) => row.placement === "base"
      && new RegExp(`^${family}`, "i").test(row.masterCode ?? "")
      && Math.abs(numberWidth(row.width) - targetWidthIn) <= 0.05
      && !isCornerCabinet(row.masterCode, row.description))
    .sort((left, right) => (left.masterCode ?? "").localeCompare(right.masterCode ?? "", undefined, { numeric: true }));
}

/**
 * Every real fix for one leftover opening, closest to what the homeowner asked
 * for first: a real cabinet at that width, then a widened neighbor, then a slide,
 * then (only if nothing else exists) filler.
 */
export function leftoverFixes<T extends DesignCabinet>(input: {
  gapIn: number;
  catalog: readonly T[];
  neighbor?: { uid?: string; masterCode?: string | null; width?: string | number | null } | null;
  /** True when the neighbor can legally slide within the wiggle room. */
  slideRoomIn?: number;
}): LeftoverFix<T>[] {
  const gap = Math.max(0, input.gapIn);
  const fixes: LeftoverFix<T>[] = [];
  if (gap <= 0) return fixes;

  const narrow = narrowCandidates(input.catalog, gap);
  for (const row of narrow.slice(0, 3)) {
    fixes.push({
      kind: "narrow-cabinet",
      cabinet: row,
      widthIn: gap,
      summary: gap <= LEFTOVER_SPICE_WIDTH_IN + 0.05
        ? `A ${plainWidth(gap)} inch pull-out cabinet fits this spot. It is made for a narrow space like this.`
        : `A ${plainWidth(gap)} inch cabinet fits this spot.`,
    });
  }

  if (input.neighbor) {
    const neighborWidth = numberWidth(input.neighbor.width);
    const widened = widenCandidates(input.neighbor, input.catalog, neighborWidth + gap);
    for (const row of widened.slice(0, 2)) {
      fixes.push({
        kind: "widen-neighbor",
        cabinet: row,
        widthIn: neighborWidth + gap,
        neighborUid: input.neighbor.uid ?? null,
        summary: `I used a slightly wider cabinet next to this spot so the gap closes with real cabinet, not a strip.`,
      });
    }
  }

  const slideRoom = Math.max(0, input.slideRoomIn ?? 0);
  if (slideRoom > 0 && gap + slideRoom >= LEFTOVER_SPICE_WIDTH_IN) {
    fixes.push({
      kind: "slide",
      cabinet: null,
      widthIn: gap + Math.min(slideRoom, 6),
      summary: `I moved the cabinets beside this spot a little, which makes room for a real cabinet here.`,
    });
  }

  if (fixes.length === 0 || gap <= AUTO_DESIGN_FILLER_MAX_IN + 0.05) {
    fixes.push({
      kind: "filler",
      cabinet: null,
      widthIn: gap,
      summary: `I closed the ${plainWidth(gap)} inch gap with a finished strip, because this cabinet line has no cabinet that narrow.`,
    });
  }
  return fixes;
}

/** The alternative cards for the homeowner pop-up, closest first. */
export function leftoverAlternatives<T extends DesignCabinet>(input: {
  gapIn: number;
  catalog: readonly T[];
  neighbor?: { uid?: string; masterCode?: string | null; width?: string | number | null } | null;
  slideRoomIn?: number;
}): { alternatives: Alternative[]; reason: string } {
  const fixes = leftoverFixes(input);
  const reason = `There was a ${Math.round(input.gapIn * 8) / 8} inch space left over beside a cabinet.`;
  const kindFor: Record<LeftoverFixKind, AlternativeKind> = {
    "narrow-cabinet": "leftover",
    "widen-neighbor": "resize",
    slide: "shift",
    filler: "leftover",
  };
  return {
    reason,
    alternatives: fixes.map((fix, index) => ({
      id: `${fix.kind}-${fix.cabinet?.id ?? index}`,
      kind: kindFor[fix.kind],
      summary: fix.summary,
      reason,
      closest: index === 0,
    })),
  };
}

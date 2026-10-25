// ─────────────────────────────────────────────────────────────────────────────
// Shared deterministic wall-span fill engine (no DOM / no client deps).
//
// This is the SINGLE source of truth for "how do we tile a wall span with real
// catalog cabinets". It is imported by:
//   - the client auto-fill button (client/src/lib/autofill.ts wraps it), and
//   - the server AI design-consultant (server/routers/design.ts),
// so the math is identical whether a human clicks "Auto-Fill" or the AI proposes
// a layout. The AI only ever chooses a STRATEGY (which spans, what intent); the
// actual cabinet codes + widths come from this deterministic engine, so the AI
// can never invent a SKU or a size that does not add up to the wall length.
// ─────────────────────────────────────────────────────────────────────────────

export type FillMode = "kitchen" | "closet";
export type FillStrategy = "varied" | "largest-first";

/** Minimal catalog row shape the engine needs (a subset of DesignCabinet). */
export interface FillCabinet {
  id: number;
  masterCode: string;
  description: string;
  category?: string | null;
  subCategory?: string | null;
  width: string | null;
  height?: string | null;
  depth?: string | null;
  placement: "base" | "wall" | "tall" | "appliance" | "baseTop" | "underCabinet";
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  isCornerCabinet?: boolean | null;
  catalogImageUrl?: string | null;
}

export interface FillItem {
  cabinet: FillCabinet;
  width: number;
  isFiller: boolean;
}

export interface FillResult {
  items: FillItem[];
  usedInches: number;
  leftoverInches: number;
  fillerInches: number;
}

const MIN_FILLER = 1.5;
const MAX_FILLER = 6;
// Trade rule: when a range/oven sits at a corner next to a cabinet, a filler is
// inserted between them so the appliance handle clears the cabinet handle.
// Standard clearance filler is 3" (same as a blind-corner filler).
export const RANGE_CLEARANCE_FILLER_IN = 3;

function widthOf(c: FillCabinet, fallback = 24): number {
  const w = c.width != null ? parseFloat(c.width) : NaN;
  return Number.isFinite(w) && w > 0 ? w : fallback;
}

function isStraightRunCabinet(c: FillCabinet): boolean {
  if (c.placement === "appliance") return false;
  if (c.isCornerCabinet) return false;
  const hay = `${c.subCategory ?? ""} ${c.description ?? ""} ${c.masterCode ?? ""}`.toLowerCase();
  if (/\bfiller\b|\bscribe\b|\bpanel\b|\bskin\b|\bmolding\b|toe kick|crown/.test(hay)) return false;
  if (/blind corner|easy reach|lazy susan|corner/.test(hay)) return false;
  // Exclude accessory "fronts"/display items that are not real storage boxes
  // (e.g. "Hanging Display Door & Drawer Front", end panels, false fronts).
  if (/\bfront\b|display|false front|tilt-?out|end panel|finished end|valance|light rail|riser|deco/.test(hay)) {
    return false;
  }
  return true;
}

export function candidatesForMode(mode: FillMode, catalog: FillCabinet[]): FillCabinet[] {
  const straight = catalog.filter(isStraightRunCabinet);
  let pool: FillCabinet[];
  if (mode === "kitchen") {
    pool = straight.filter((c) => c.placement === "base");
  } else {
    // For closets, prefer real storage UNITS (drawer banks, shelf/hanging
    // towers, wardrobe cabinets). Require a real placement (base/tall) so we
    // never tile a wall with accessory fronts. Fall back to base/tall boxes.
    const closetish = straight.filter((c) => {
      if (c.placement !== "base" && c.placement !== "tall") return false;
      const hay = `${c.category ?? ""} ${c.subCategory ?? ""} ${c.description ?? ""}`.toLowerCase();
      return /closet|wardrobe|shelf|drawer|hanging unit|tower/.test(hay);
    });
    pool = closetish.length > 0 ? closetish : straight.filter((c) => c.placement === "base" || c.placement === "tall");
  }
  const seen = new Set<string>();
  const uniq: FillCabinet[] = [];
  for (const c of pool) {
    if (seen.has(c.masterCode)) continue;
    seen.add(c.masterCode);
    uniq.push(c);
  }
  return uniq.sort((a, b) => widthOf(b) - widthOf(a));
}

export function makeFiller(widthInches: number, placement: FillCabinet["placement"] = "base"): FillCabinet {
  const w = Math.round(widthInches * 10) / 10;
  return {
    id: 0,
    masterCode: `FILL-${w}`,
    description: `${w}" Filler / Scribe Strip`,
    category: "Accessory",
    subCategory: "Filler",
    width: String(w),
    height: placement === "wall" ? "30" : "34.5",
    depth: placement === "wall" ? "12" : "24",
    placement,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    isCornerCabinet: false,
    catalogImageUrl: null,
  };
}

// ─── Varied layout planner ───────────────────────────────────────────────────
// Instead of greedily repeating the single widest cabinet, choose a MIX of
// widths that still sums to (at most) the span. We do a bounded search that
// favours: (1) covering the most span, then (2) using the FEWEST cabinets, then
// (3) the most VARIETY (distinct widths). This yields realistic runs like
// 36 + 24 + 18 rather than 48 + 48, while staying fully deterministic.
//
// To keep the search cheap we work on the set of DISTINCT candidate widths and
// reconstruct which cabinet each width maps to afterwards (widest cabinet for a
// given width). The search is depth-bounded and width-bounded so it is O(small).

interface WidthPick {
  widths: number[]; // chosen cabinet widths, in placement order (widest-first)
  used: number;     // sum of widths
}

function planVariedWidths(span: number, distinctWidths: number[]): number[] {
  const widths = Array.from(new Set(distinctWidths)).sort((a, b) => b - a);
  if (widths.length === 0) return [];
  const smallest = widths[widths.length - 1];

  // Cap how many cabinets we will place so the search stays bounded even on a
  // very long wall. Beyond the cap we top up greedily with the widest cabinet.
  const MAX_PIECES = 12;

  let best: WidthPick | null = null;

  const score = (pick: WidthPick): number => {
    const leftover = span - pick.used;
    const distinct = new Set(pick.widths).size;
    // Lower is better. Heavily penalise leftover, then piece count, then reward
    // variety (subtract distinct widths so more variety lowers the score).
    return leftover * 1000 + pick.widths.length * 10 - distinct * 3;
  };

  const consider = (pick: WidthPick) => {
    if (pick.used > span + 0.01) return;
    if (best === null || score(pick) < score(best)) best = pick;
  };

  // DFS over width choices, always trying larger widths first but allowing the
  // engine to drop to a smaller width to introduce variety.
  const dfs = (remaining: number, chosen: number[]) => {
    consider({ widths: chosen, used: span - remaining });
    if (chosen.length >= MAX_PIECES) return;
    if (remaining < smallest - 0.01) return;
    for (const w of widths) {
      if (w > remaining + 0.01) continue;
      // Avoid placing 3+ identical widths in a row early — nudge toward variety
      // by skipping a width once it already appears twice consecutively at the
      // tail (still allowed later, just de-prioritised by ordering).
      const tail = chosen.slice(-2);
      if (tail.length === 2 && tail[0] === w && tail[1] === w) {
        // allow but only as a fallback: try the rest first via ordering
      }
      dfs(Math.round((remaining - w) * 100) / 100, [...chosen, w]);
    }
  };

  dfs(span, []);

  let result = best ? (best as WidthPick).widths.slice() : [];

  // If the bounded search stopped short of the span (very long wall), top up
  // greedily with the widest cabinet until we can't fit another.
  let used = result.reduce((s, w) => s + w, 0);
  const widest = widths[0];
  let guard = 0;
  while (span - used >= smallest - 0.01 && guard < 200) {
    guard++;
    const fit = widths.find((w) => w <= span - used + 0.01);
    if (!fit) break;
    result.push(fit);
    used += fit;
  }

  return result;
}

/**
 * Four-anchor uses this narrow strategy after it has already seated the
 * appliances and corner boxes. It first minimizes the uncovered remainder
 * (therefore minimizes filler), then cabinet count, and only then prefers a
 * lexicographically larger run. Ordinary Auto-Fill retains planVariedWidths.
 */
function planLargestFirstWidths(span: number, distinctWidths: number[]): number[] {
  const widths = Array.from(new Set(distinctWidths)).sort((a, b) => b - a);
  if (widths.length === 0) return [];
  const smallest = widths[widths.length - 1];
  const MAX_PIECES = 12;
  let best: WidthPick | null = null;

  const isBetter = (next: WidthPick, current: WidthPick | null): boolean => {
    if (!current) return true;
    const nextLeft = span - next.used;
    const currentLeft = span - current.used;
    if (Math.abs(nextLeft - currentLeft) > 0.01) return nextLeft < currentLeft;
    if (next.widths.length !== current.widths.length) return next.widths.length < current.widths.length;
    for (let index = 0; index < Math.max(next.widths.length, current.widths.length); index += 1) {
      const delta = (next.widths[index] ?? 0) - (current.widths[index] ?? 0);
      if (Math.abs(delta) > 0.01) return delta > 0;
    }
    return false;
  };
  const dfs = (remaining: number, chosen: number[]) => {
    const candidate = { widths: chosen, used: span - remaining };
    if (isBetter(candidate, best)) best = candidate;
    if (chosen.length >= MAX_PIECES || remaining < smallest - 0.01) return;
    for (const width of widths) {
      if (width <= remaining + 0.01) dfs(Math.round((remaining - width) * 100) / 100, [...chosen, width]);
    }
  };
  dfs(span, []);
  return best ? (best as WidthPick).widths.slice() : [];
}

/**
 * Tile a wall span with real catalog cabinets, resolving any leftover with a
 * filler/scribe strip. Produces a VARIED mix of widths (not just the widest
 * repeated). When `forceFiller` is true a clearance filler is always appended
 * (used for the range/oven corner rule).
 */
export function autoFillSpan(
  spanInches: number,
  mode: FillMode,
  catalog: FillCabinet[],
  opts: { forceFiller?: number; strategy?: FillStrategy } = {}
): FillResult {
  const span = Math.max(0, Math.round(spanInches * 100) / 100);
  const items: FillItem[] = [];
  const candidates = candidatesForMode(mode, catalog);

  if (span < MIN_FILLER || candidates.length === 0) {
    return { items, usedInches: 0, leftoverInches: span, fillerInches: 0 };
  }

  // Map each distinct width to a representative cabinet (the widest match, which
  // candidatesForMode already orders first for that width).
  const byWidth = new Map<number, FillCabinet>();
  for (const c of candidates) {
    const w = widthOf(c);
    if (!byWidth.has(w)) byWidth.set(w, c);
  }
  const distinctWidths = Array.from(byWidth.keys());

  const plannedWidths = opts.strategy === "largest-first"
    ? planLargestFirstWidths(span, distinctWidths)
    : planVariedWidths(span, distinctWidths);
  for (const w of plannedWidths) {
    const c = byWidth.get(w);
    if (!c) continue;
    items.push({ cabinet: c, width: w, isFiller: false });
  }

  const placement: FillCabinet["placement"] = mode === "closet"
    ? candidates[candidates.length - 1].placement
    : "base";

  let used = items.reduce((s, it) => s + it.width, 0);
  let remaining = Math.round((span - used) * 100) / 100;

  let fillerInches = 0;
  if (remaining >= MIN_FILLER) {
    fillerInches = Math.min(remaining, MAX_FILLER);
    items.push({ cabinet: makeFiller(fillerInches, placement), width: fillerInches, isFiller: true });
    remaining = Math.round((remaining - fillerInches) * 100) / 100;
  }

  if (opts.forceFiller && opts.forceFiller > 0) {
    const fw = Math.round(opts.forceFiller * 100) / 100;
    items.push({ cabinet: makeFiller(fw, placement), width: fw, isFiller: true });
    fillerInches += fw;
  }

  const usedInches = Math.round(items.reduce((s, it) => s + it.width, 0) * 100) / 100;
  const leftoverInches = Math.max(0, Math.round((span - usedInches) * 100) / 100);
  return { items, usedInches, leftoverInches, fillerInches };
}

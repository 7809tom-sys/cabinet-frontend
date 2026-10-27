import { MAX_FILLER_RUN_WIDTH_IN } from "./design";

/**
 * Fillers are the last resort. `searchFewestFillerOpening` tries, in order:
 * 1. Combinations of the catalog widths already in the line, at the opening's
 *    exact length. A single cabinet that matches wins. On a wall, an equal
 *    split wins next (48 → 24+24), then the most balanced pair.
 * 2. The same combinations after sliding the opening by the smallest distance
 *    that lands on a catalog sum. The caller sets the cap: 3" for a sink or
 *    other appliance, 6" for a refrigerator.
 * 3. Alternate openings the caller already priced, such as the run left after
 *    a lazy Susan steps 36 → 33, or a wall split. Each alternate carries its
 *    own movement.
 * 4. One filler, and only when every alternative above still leaves a gap.
 *    Fewest fillers wins, then the smallest filler, then the smallest movement.
 *    Never two fillers side by side, never a filler wider than 24", and never
 *    a 3" wall filler.
 * The zero-filler candidate with the smallest movement wins.
 */
export const AUTO_DESIGN_MINIMIZE_FILLERS_FIRST = true;

const EIGHTH = 8;
const MAX_PIECES = 6;
const NODE_BUDGET = 20000;

export type SpanSolution = {
  cabinetWidths: number[];
  fillerWidth: number | null;
  fillerCount: number;
  fillerTotal: number;
  movementIn: number;
  /** True when cabinets plus at most one legal filler cover the span. */
  covered: boolean;
};

export type SpanCandidate = SpanSolution & { lengthIn: number };

const toEighths = (value: number) => Math.round(value * EIGHTH);
const fromEighths = (value: number) => value / EIGHTH;

function uniqueWidths(widthsIn: readonly number[]): number[] {
  const seen = new Set<number>();
  const widths: number[] = [];
  for (const width of widthsIn) {
    const eighths = toEighths(width);
    if (eighths <= 0 || seen.has(eighths)) continue;
    seen.add(eighths);
    widths.push(fromEighths(eighths));
  }
  return widths.sort((left, right) => right - left);
}

function fillerAllowed(fillerEighths: number, layer: "base" | "wall"): boolean {
  if (fillerEighths <= 0) return false;
  if (fillerEighths > toEighths(MAX_FILLER_RUN_WIDTH_IN)) return false;
  if (layer === "wall" && fillerEighths === toEighths(3)) return false;
  return true;
}

type Pack = { widths: number[]; pieces: number; balance: number; single: boolean; equalPair: boolean };

function packRank(pack: Pack, preferEqualHalves: boolean): number[] {
  if (preferEqualHalves) {
    return [
      pack.single ? 0 : 1,
      pack.pieces === 2 ? 0 : 1,
      pack.equalPair ? 0 : 1,
      pack.balance,
      pack.pieces,
    ];
  }
  return [pack.pieces, pack.balance];
}

function betterRank(next: number[], current: number[]): boolean {
  for (let index = 0; index < next.length; index += 1) {
    if (next[index]! < current[index]!) return true;
    if (next[index]! > current[index]!) return false;
  }
  return false;
}

function describe(widths: number[]): Pack {
  const pieces = widths.length;
  const balance = pieces <= 1 ? 0 : Math.max(...widths) - Math.min(...widths);
  return {
    widths,
    pieces,
    balance,
    single: pieces === 1,
    equalPair: pieces === 2 && Math.abs(widths[0]! - widths[1]!) <= 1e-6,
  };
}

/**
 * Bounded search of catalog widths for one span. Combinations are built
 * largest-width first and stop at six pieces or 20,000 nodes.
 */
export function solveCabinetSpan(input: {
  lengthIn: number;
  widthsIn: readonly number[];
  layer: "base" | "wall";
  movementIn?: number;
  preferEqualHalves?: boolean;
}): SpanSolution {
  const movementIn = input.movementIn ?? 0;
  const empty: SpanSolution = {
    cabinetWidths: [],
    fillerWidth: null,
    fillerCount: 0,
    fillerTotal: 0,
    movementIn,
    covered: false,
  };
  const target = toEighths(input.lengthIn);
  if (target <= 0) return empty;
  const widths = uniqueWidths(input.widthsIn).map(toEighths);
  if (!widths.length) return empty;
  const preferEqualHalves = input.preferEqualHalves === true;
  let nodes = 0;
  const best: { exact: Pack | null; filler: { pack: Pack; filler: number } | null } = { exact: null, filler: null };

  const consider = (chosen: number[], remain: number) => {
    if (!chosen.length) return;
    const pack = describe(chosen.map(fromEighths));
    if (remain === 0) {
      if (!best.exact || betterRank(packRank(pack, preferEqualHalves), packRank(best.exact, preferEqualHalves))) best.exact = pack;
      return;
    }
    if (!fillerAllowed(remain, input.layer)) return;
    const fillerRank = [remain, ...packRank(pack, preferEqualHalves)];
    const currentRank = best.filler ? [best.filler.filler, ...packRank(best.filler.pack, preferEqualHalves)] : null;
    if (!currentRank || betterRank(fillerRank, currentRank)) best.filler = { pack, filler: remain };
  };

  const walk = (remain: number, chosen: number[]) => {
    consider(chosen, remain);
    if (chosen.length >= MAX_PIECES || nodes >= NODE_BUDGET) return;
    for (const width of widths) {
      if (width > remain) continue;
      nodes += 1;
      chosen.push(width);
      walk(remain - width, chosen);
      chosen.pop();
      if (nodes >= NODE_BUDGET) return;
    }
  };
  walk(target, []);

  if (best.exact) {
    return {
      cabinetWidths: best.exact.widths,
      fillerWidth: null,
      fillerCount: 0,
      fillerTotal: 0,
      movementIn,
      covered: true,
    };
  }
  if (best.filler) {
    const fillerWidth = fromEighths(best.filler.filler);
    return {
      cabinetWidths: best.filler.pack.widths,
      fillerWidth,
      fillerCount: 1,
      fillerTotal: fillerWidth,
      movementIn,
      covered: true,
    };
  }
  return empty;
}

function candidateKey(candidate: SpanCandidate): number[] {
  return [candidate.fillerCount, candidate.fillerTotal, candidate.movementIn, candidate.cabinetWidths.length];
}

/**
 * Picks the zero-filler span with the smallest movement. If every candidate
 * needs a filler, picks the fewest fillers, then the smallest filler, then
 * the smallest movement.
 */
export function chooseLowestFillerCandidate(candidates: readonly SpanCandidate[]): SpanCandidate | null {
  let best: SpanCandidate | null = null;
  for (const candidate of candidates) {
    if (!candidate.covered) continue;
    if (!best || betterRank(candidateKey(candidate), candidateKey(best))) best = candidate;
  }
  return best;
}

/** Wall cabinets over one base: one matching width, otherwise equal halves, otherwise the most balanced exact pack. */
export function planWallWidthsOverBase(lengthIn: number, widthsIn: readonly number[]): number[] | null {
  const solution = solveCabinetSpan({
    lengthIn,
    widthsIn,
    layer: "wall",
    preferEqualHalves: true,
  });
  if (!solution.covered || solution.fillerCount > 0) return null;
  return solution.cabinetWidths;
}

export type OpeningAlternate = {
  lengthIn: number;
  movementIn?: number;
  widthsIn?: readonly number[];
  layer?: "base" | "wall";
  preferEqualHalves?: boolean;
};

function reachableSums(widthsEighths: readonly number[], maxEighths: number): Uint8Array {
  const ok = new Uint8Array(maxEighths + 1);
  ok[0] = 1;
  for (let sum = 0; sum <= maxEighths; sum += 1) {
    if (!ok[sum]) continue;
    for (const width of widthsEighths) {
      const next = sum + width;
      if (next <= maxEighths) ok[next] = 1;
    }
  }
  return ok;
}

/**
 * Smallest slide that lands the opening on a sum of catalog widths.
 * A shorter opening wins a tie with a longer one at the same distance.
 */
function nearestCatalogLength(
  lengthIn: number,
  widthsIn: readonly number[],
  movementLimitIn: number,
): { lengthIn: number; movementIn: number } | null {
  const widths = uniqueWidths(widthsIn).map(toEighths);
  if (!widths.length || movementLimitIn <= 0) return null;
  const target = toEighths(lengthIn);
  const limit = toEighths(movementLimitIn);
  if (target <= 0) return null;
  const ok = reachableSums(widths, target + limit);
  for (let delta = 1; delta <= limit; delta += 1) {
    const shorter = target - delta;
    if (shorter > 0 && ok[shorter]) return { lengthIn: fromEighths(shorter), movementIn: fromEighths(delta) };
    const longer = target + delta;
    if (ok[longer]) return { lengthIn: fromEighths(longer), movementIn: fromEighths(delta) };
  }
  return null;
}

/**
 * Explicit fewest-filler search for one opening. Evaluates catalog combinations,
 * appliance shift, and caller-supplied alternates (corner step-down, wall split),
 * then keeps the zero-filler result with the smallest movement. A filler is
 * returned only when none of those close the opening.
 */
export function searchFewestFillerOpening(input: {
  lengthIn: number;
  widthsIn: readonly number[];
  layer: "base" | "wall";
  /** Largest slide that may change this opening. Sink 3, refrigerator 6, other appliances 3. */
  movementLimitIn?: number;
  preferEqualHalves?: boolean;
  /** Other ways to close the same gap, already costed by the caller. */
  alternates?: readonly OpeningAlternate[];
}): SpanCandidate | null {
  const prefer = input.preferEqualHalves ?? input.layer === "wall";
  const candidates: SpanCandidate[] = [];
  const exact = solveCabinetSpan({
    lengthIn: input.lengthIn,
    widthsIn: input.widthsIn,
    layer: input.layer,
    movementIn: 0,
    preferEqualHalves: prefer,
  });
  candidates.push({ ...exact, lengthIn: input.lengthIn });

  const nearest = nearestCatalogLength(input.lengthIn, input.widthsIn, input.movementLimitIn ?? 0);
  if (nearest) {
    const shifted = solveCabinetSpan({
      lengthIn: nearest.lengthIn,
      widthsIn: input.widthsIn,
      layer: input.layer,
      movementIn: nearest.movementIn,
      preferEqualHalves: prefer,
    });
    if (shifted.covered && shifted.fillerCount === 0) candidates.push({ ...shifted, lengthIn: nearest.lengthIn });
  }

  for (const alternate of input.alternates ?? []) {
    const layer = alternate.layer ?? input.layer;
    const solved = solveCabinetSpan({
      lengthIn: alternate.lengthIn,
      widthsIn: alternate.widthsIn ?? input.widthsIn,
      layer,
      movementIn: alternate.movementIn ?? 0,
      preferEqualHalves: alternate.preferEqualHalves ?? layer === "wall",
    });
    candidates.push({ ...solved, lengthIn: alternate.lengthIn });
  }

  return chooseLowestFillerCandidate(candidates);
}

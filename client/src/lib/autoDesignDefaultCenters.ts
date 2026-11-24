/**
 * Starting measurements for the Auto-Design dialog (Tom, Nov 23 2026).
 *
 * The dialog used to open with fixed centers (sink 24, range 120, refrigerator
 * 72, all on Wall 1). On the default 144 in. wall the 36 in. sink base at 24
 * spans 6–42, the dishwasher beside it 42–66, and a 36 in. refrigerator at 72
 * spans 54–90, so pressing Build measured kitchen without changing anything
 * stopped with "refrigerator cannot be placed at that exact measurement".
 *
 * This module works the starting centers out from the real room instead: the
 * walls the chosen layout uses, each wall's length, the sink-base, dishwasher,
 * range and refrigerator widths, and room left for the corner cabinets the
 * build seats where two runs meet. It never overlaps two items, and among the
 * arrangements that fit it picks the one that breaks the fewest of the kitchen
 * rules the build reports on (15 in. of counter beside the refrigerator, 15–18
 * in. of landing between the sink, range and refrigerator, the dishwasher not
 * against the range, counter on both sides of the range, a 36 in. prep area
 * beside the sink, no sliver gaps). Anything the customer typed is kept as a
 * fixed obstacle and is never changed.
 *
 * Pure: it reads the room and the dialog choices and returns numbers.
 */
import type { RoomData } from "./design";
import { DEFAULT_ROOM } from "./design";
import {
  AUTO_DESIGN_WALL_LABELS,
  wallLabelToEngineWallId,
  type AutoDesignLayoutType,
  type AutoDesignOriginCorner,
  type AutoDesignRunDirection,
  type WallLabel,
} from "./autoDesignAutoBuild";
import { AUTO_DESIGN_GALLEY_WALLS, AUTO_DESIGN_U_SHAPE_WALLS } from "./autoDesignCornerStage";

export type AutoDesignDefaultMeasurement = { wallLabel: WallLabel; centerOffsetIn: number };

export type AutoDesignDefaultCentersInput = {
  room?: RoomData | null;
  layoutType: AutoDesignLayoutType;
  originCorner: AutoDesignOriginCorner;
  runDirection: AutoDesignRunDirection;
  /** Actual room-wall count (the dialog's cap of six). */
  wallCount?: number;
  sinkBaseWidthIn: number;
  /** "none" when there is no dishwasher. Left/right is along the wall's measurement direction. */
  dishwasherSide: "left" | "right" | "none";
  dishwasherWidthIn?: number;
  includeStove: boolean;
  stoveWidthIn?: number;
  includeRefrigerator: boolean;
  refrigeratorWidthIn: number;
  /**
   * Values the customer typed. They are kept exactly and treated as obstacles.
   * A typed dishwasher center makes the dishwasher its own item instead of the
   * one beside the sink.
   */
  fixed?: Partial<Record<"sink" | "stove" | "refrigerator" | "dishwasher", AutoDesignDefaultMeasurement | null>>;
};

export type AutoDesignDefaultCenters = {
  sink: AutoDesignDefaultMeasurement;
  stove: AutoDesignDefaultMeasurement | null;
  refrigerator: AutoDesignDefaultMeasurement | null;
  /** False only when nothing could be fitted without an overlap (the room is too small). */
  fits: boolean;
};

/** Room kept clear at each end of a run that meets another run of the layout, for its corner cabinet. */
export const AUTO_DESIGN_DEFAULT_CORNER_CLEAR_IN = 45;
/** The engine's minimum counter beside the refrigerator (it moves the sink to make it). */
const FRIDGE_LANDING_MIN_IN = 15;
const LANDING_MIN_IN = 15;
const LANDING_PREFERRED_IN = 18;
const RANGE_SIDE_MIN_IN = 15;
const PREP_MIN_IN = 36;
/** Narrowest stock base: a gap under this between two items becomes a filler or an open slot. */
const SMALLEST_BASE_IN = 9;
/** A filler against a plain wall end at least this wide is ordinary scribe work, not a sliver. */
const WALL_FILLER_MIN_IN = 1.5;
/**
 * Room kept on each side of the refrigerator for its end panel (3/4 in.) and
 * bridge board (1/2 in.). The bay is built with both panels first; against a
 * wall the build then drops the wall-side panel and slides the refrigerator
 * flush. Starting flush instead pushes that panel past the wall end.
 */
const FRIDGE_BAY_ALLOWANCE_IN = 1.5;
const GRID_IN = 3;
const EPS = 0.01;

const PENALTY = {
  fridgeLanding: 100,
  /**
   * A dishwasher whose far side touches the range or refrigerator. Besides the
   * kitchen rule, the run tightener then butts the sink base to that appliance
   * over the dishwasher, so it is avoided whenever the wall allows.
   */
  dishwasherAgainstAppliance: 150,
  /**
   * A range or dishwasher flush to a plain wall end. Lines that add an end panel
   * beside the sink base, or wiggle the range so the run closes with stock
   * widths, push that appliance past the wall end and the build drops it. A
   * filler against the wall avoids it.
   */
  applianceFlushToWallEnd: 50,
  /** A filler strip against a plain wall end: ordinary scribe work. */
  wallFiller: 3,
  landingShort: 40,
  landingTight: 4,
  sliver: 30,
  rangeSide: 8,
  prep: 6,
  fridgeNotAtEnd: 6,
  emptyLayoutWall: 25,
  sinkAndRangeSameWall: 10,
} as const;

type Kind = "sink" | "dishwasher" | "stove" | "refrigerator";
type Segment = { kind: Kind; start: number; end: number; fixed: boolean; dishwasherSide?: "left" | "right" | null };
type Bound = { at: number; type: "wall" | "corner" };
type WallSpace = { label: WallLabel; length: number; lo: Bound; hi: Bound; toMeasurement: (physicalAlong: number) => number };
/** A free item: the sink (with its adjacent dishwasher), the range, or the refrigerator. */
type FreeItem = { kind: "sink" | "stove" | "refrigerator"; width: number; segments: (start: number) => Segment[] };

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function layoutWallLabels(layoutType: AutoDesignLayoutType, wallCount: number): WallLabel[] {
  const available = AUTO_DESIGN_WALL_LABELS.slice(0, Math.max(1, Math.min(AUTO_DESIGN_WALL_LABELS.length, wallCount)));
  const pick = (labels: readonly WallLabel[]) => available.filter((label) => labels.includes(label));
  if (layoutType === "single-wall") return pick(["Wall 1"]);
  if (layoutType === "galley") return pick(AUTO_DESIGN_GALLEY_WALLS);
  if (layoutType === "l-shape") return pick(["Wall 1", "Wall 2"]);
  return pick(AUTO_DESIGN_U_SHAPE_WALLS);
}

function samePoint(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= 0.01;
}

/** Each layout wall in measurement space (inches from the wall's labeled start), with its corner ends marked. */
function wallSpaces(input: AutoDesignDefaultCentersInput, room: RoomData, labels: readonly WallLabel[], cornerClearIn: number): WallSpace[] {
  const refs = labels.map((label) => wallLabelToEngineWallId(label, room, input.originCorner, input.runDirection));
  const cornerWalls = input.layoutType === "l-shape" || input.layoutType === "u-shape" ? refs : [];
  const spaces: WallSpace[] = [];
  refs.forEach((ref, index) => {
    if (!ref) return;
    const frame = ref.frame;
    const others = cornerWalls.filter((other, otherIndex) => other && otherIndex !== index && other.engineWallId !== ref.engineWallId);
    const touches = (point: { x: number; y: number }) => others.some((other) => other && (samePoint(point, other.frame.start) || samePoint(point, other.frame.end)));
    const startIsCorner = touches(frame.start);
    const endIsCorner = touches(frame.end);
    const physLo = frame.runStart + (startIsCorner ? cornerClearIn : 0);
    const physHi = frame.runEnd - (endIsCorner ? cornerClearIn : 0);
    const forward = ref.startCorner === "start";
    const toMeasurement = (along: number) => (forward ? along : frame.length - along);
    const loBound: Bound = forward
      ? { at: toMeasurement(physLo), type: startIsCorner ? "corner" : "wall" }
      : { at: toMeasurement(physHi), type: endIsCorner ? "corner" : "wall" };
    const hiBound: Bound = forward
      ? { at: toMeasurement(physHi), type: endIsCorner ? "corner" : "wall" }
      : { at: toMeasurement(physLo), type: startIsCorner ? "corner" : "wall" };
    spaces.push({ label: labels[index]!, length: frame.length, lo: loBound, hi: hiBound, toMeasurement });
  });
  return spaces;
}

function isAppliance(kind: Kind): boolean {
  return kind === "stove" || kind === "refrigerator" || kind === "dishwasher";
}

/** Penalty for one wall's arrangement; Infinity when it cannot be built. */
function scoreWall(segments: readonly Segment[], lo: Bound, hi: Bound): number {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.start < sorted[i - 1]!.end - EPS) return Number.POSITIVE_INFINITY;
  }
  let score = 0;
  type Side = { gap: number; neighbor: Segment | null; bound: Bound | null };
  const sideOf = (index: number, direction: -1 | 1): Side => {
    const segment = sorted[index]!;
    if (direction < 0) {
      const neighbor = index > 0 ? sorted[index - 1]! : null;
      return neighbor ? { gap: segment.start - neighbor.end, neighbor, bound: null } : { gap: segment.start - lo.at, neighbor: null, bound: lo };
    }
    const neighbor = index < sorted.length - 1 ? sorted[index + 1]! : null;
    return neighbor ? { gap: neighbor.start - segment.end, neighbor, bound: null } : { gap: hi.at - segment.end, neighbor: null, bound: hi };
  };
  /**
   * Extra counter on one side of the refrigerator, measured from its body: the
   * bay's panel room, plus that room again when the other side is flush to a
   * plain wall (the build slides the refrigerator to the wall).
   */
  const fridgeBodyExtra = (index: number, direction: -1 | 1): number => {
    const opposite = sideOf(index, direction < 0 ? 1 : -1);
    return FRIDGE_BAY_ALLOWANCE_IN + (opposite.bound?.type === "wall" && opposite.gap <= EPS ? FRIDGE_BAY_ALLOWANCE_IN : 0);
  };
  // Gaps too narrow for a stock base: a filler against a plain wall end is fine,
  // a sliver between two items (or under 1 1/2 in. at a wall) is not.
  for (let i = 0; i <= sorted.length; i += 1) {
    const gap = i === 0 ? sorted[0]!.start - lo.at : i === sorted.length ? hi.at - sorted[i - 1]!.end : sorted[i]!.start - sorted[i - 1]!.end;
    const atBound = i === 0 ? lo : i === sorted.length ? hi : null;
    if (atBound?.type === "corner") continue;
    if (gap <= EPS || gap >= SMALLEST_BASE_IN - EPS) continue;
    score += atBound && gap >= WALL_FILLER_MIN_IN - EPS ? PENALTY.wallFiller : PENALTY.sliver;
  }
  sorted.forEach((segment, index) => {
    const left = sideOf(index, -1);
    const right = sideOf(index, 1);
    if (segment.kind === "refrigerator") {
      if (Math.max(left.gap + fridgeBodyExtra(index, -1), right.gap + fridgeBodyExtra(index, 1)) < FRIDGE_LANDING_MIN_IN - EPS) score += PENALTY.fridgeLanding;
      const atWallEnd = [left, right].some((side) => side.bound?.type === "wall" && side.gap <= EPS);
      if (!atWallEnd) score += PENALTY.fridgeNotAtEnd;
    }
    if (segment.kind === "dishwasher") {
      for (const side of [left, right]) {
        if (side.neighbor && side.neighbor.kind !== "sink" && isAppliance(side.neighbor.kind) && side.gap < SMALLEST_BASE_IN - EPS) {
          score += PENALTY.dishwasherAgainstAppliance;
        }
      }
    }
    if (segment.kind === "dishwasher" || segment.kind === "stove") {
      for (const side of [left, right]) {
        if (side.bound?.type === "wall" && side.gap < WALL_FILLER_MIN_IN - EPS) score += PENALTY.applianceFlushToWallEnd;
      }
    }
    if (segment.kind === "stove") {
      for (const side of [left, right]) {
        if (side.gap < RANGE_SIDE_MIN_IN - EPS) score += PENALTY.rangeSide;
      }
    }
    if (segment.kind === "sink") {
      const prepSides = segment.dishwasherSide === "right" ? [left] : segment.dishwasherSide === "left" ? [right] : [left, right];
      const best = Math.max(...prepSides.map((side) => (side.neighbor?.kind === "dishwasher" ? 0 : side.gap)));
      if (best < PREP_MIN_IN - EPS) score += PENALTY.prep;
    }
  });
  // Landing between consecutive sink, range and refrigerator (a dishwasher between them counts as counter).
  const majors = sorted.filter((segment) => segment.kind !== "dishwasher");
  for (let i = 1; i < majors.length; i += 1) {
    const before = majors[i - 1]!;
    const after = majors[i]!;
    let gap = after.start - before.end;
    if (before.kind === "refrigerator") gap += fridgeBodyExtra(sorted.indexOf(before), 1);
    if (after.kind === "refrigerator") gap += fridgeBodyExtra(sorted.indexOf(after), -1);
    if (gap < LANDING_MIN_IN - EPS) score += PENALTY.landingShort;
    else if (gap < LANDING_PREFERRED_IN - EPS) score += PENALTY.landingTight;
  }
  return score;
}

function candidateStarts(width: number, lo: number, hi: number, fixed: readonly Segment[]): number[] {
  const starts = new Set<number>();
  const add = (value: number) => {
    if (value >= lo - EPS && value + width <= hi + EPS) starts.add(round(value));
  };
  // 3 in. steps on ordinary walls; coarser on very long ones so the dialog stays instant.
  const span = hi - lo;
  const grid = span <= 160 ? GRID_IN : span <= 240 ? 2 * GRID_IN : 3 * GRID_IN;
  for (let value = lo; value + width <= hi + EPS; value += grid) add(value);
  for (let value = hi - width; value >= lo - EPS; value -= grid) add(value);
  // Flush to each end, and one filler's width off it.
  for (const offset of [0, GRID_IN]) {
    add(lo + offset);
    add(hi - width - offset);
  }
  for (const segment of fixed) {
    for (let step = 0; step <= 60; step += GRID_IN) {
      add(segment.end + step);
      add(segment.start - width - step);
    }
  }
  return Array.from(starts).sort((a, b) => a - b);
}

type WallPack = { score: number; starts: Map<FreeItem["kind"], number> };

/** Best placement of the given free items on one wall, around its fixed items. */
function packWall(space: WallSpace, items: readonly FreeItem[], fixed: readonly Segment[]): WallPack | null {
  const lo = space.lo.at;
  const hi = space.hi.at;
  const midpoint = (lo + hi) / 2;
  const options = items.map((item) => candidateStarts(item.width, lo, hi, fixed));
  if (options.some((list) => list.length === 0)) return items.length === 0 ? { score: fixed.length ? scoreWall(fixed, space.lo, space.hi) : 0, starts: new Map() } : null;
  let best: WallPack | null = null;
  const chosen: number[] = [];
  const recurse = (depth: number) => {
    if (depth === items.length) {
      const segments = [...fixed, ...items.flatMap((item, index) => item.segments(chosen[index]!))];
      let score = segments.length ? scoreWall(segments, space.lo, space.hi) : 0;
      if (!Number.isFinite(score)) return;
      // Tie-breaker: a sink near the middle of its run reads as the deliberate default.
      items.forEach((item, index) => {
        if (item.kind === "sink") score += Math.abs(chosen[index]! + item.width / 2 - midpoint) * 0.001;
      });
      if (!best || score < best.score - 1e-9) {
        best = { score, starts: new Map(items.map((item, index) => [item.kind, chosen[index]!])) };
      }
      return;
    }
    const item = items[depth]!;
    for (const start of options[depth]!) {
      const end = start + item.width;
      // Prune overlaps early (fixed items and items already chosen).
      const clash = fixed.some((segment) => start < segment.end - EPS && end > segment.start + EPS)
        || chosen.some((other, index) => index < depth && start < other + items[index]!.width - EPS && end > other + EPS);
      if (clash) continue;
      chosen[depth] = start;
      recurse(depth + 1);
    }
    chosen.length = depth;
  };
  recurse(0);
  return best;
}

function measurementOf(label: WallLabel, center: number): AutoDesignDefaultMeasurement {
  return { wallLabel: label, centerOffsetIn: Math.round(center * 8) / 8 };
}

/**
 * Starting centers for the sink base, range and refrigerator. Typed values in
 * `fixed` come back unchanged.
 */
export function autoDesignDefaultCenters(input: AutoDesignDefaultCentersInput): AutoDesignDefaultCenters {
  const room = input.room ?? DEFAULT_ROOM;
  const wallCount = input.wallCount ?? 4;
  const dishwasherWidth = input.dishwasherWidthIn ?? 24;
  const stoveWidth = input.stoveWidthIn ?? 30;
  const fixed = input.fixed ?? {};
  const labels = layoutWallLabels(input.layoutType, wallCount);
  const fallbackLabel = labels[0] ?? "Wall 1";
  const typedDishwasher = input.dishwasherSide !== "none" ? fixed.dishwasher ?? null : null;
  const adjacentDishwasher = input.dishwasherSide !== "none" && !typedDishwasher ? input.dishwasherSide : null;

  const sinkSegments = (groupStart: number, fixedItem: boolean): Segment[] => {
    if (!adjacentDishwasher) return [{ kind: "sink", start: groupStart, end: groupStart + input.sinkBaseWidthIn, fixed: fixedItem, dishwasherSide: null }];
    const sinkStart = adjacentDishwasher === "right" ? groupStart : groupStart + dishwasherWidth;
    const dishwasherStart = adjacentDishwasher === "right" ? groupStart + input.sinkBaseWidthIn : groupStart;
    return [
      { kind: "sink", start: sinkStart, end: sinkStart + input.sinkBaseWidthIn, fixed: fixedItem, dishwasherSide: adjacentDishwasher },
      { kind: "dishwasher", start: dishwasherStart, end: dishwasherStart + dishwasherWidth, fixed: fixedItem },
    ];
  };
  const sinkGroupWidth = input.sinkBaseWidthIn + (adjacentDishwasher ? dishwasherWidth : 0);
  const sinkGroupOffset = adjacentDishwasher === "left" ? dishwasherWidth : 0;

  const free: FreeItem[] = [];
  const fixedByWall = new Map<WallLabel, Segment[]>();
  const pushFixed = (label: WallLabel, segments: Segment[]) => fixedByWall.set(label, [...(fixedByWall.get(label) ?? []), ...segments]);
  if (fixed.sink) pushFixed(fixed.sink.wallLabel, sinkSegments(fixed.sink.centerOffsetIn - input.sinkBaseWidthIn / 2 - sinkGroupOffset, true));
  else free.push({ kind: "sink", width: sinkGroupWidth, segments: (start) => sinkSegments(start, false) });
  if (input.includeStove) {
    if (fixed.stove) pushFixed(fixed.stove.wallLabel, [{ kind: "stove", start: fixed.stove.centerOffsetIn - stoveWidth / 2, end: fixed.stove.centerOffsetIn + stoveWidth / 2, fixed: true }]);
    else free.push({ kind: "stove", width: stoveWidth, segments: (start) => [{ kind: "stove", start, end: start + stoveWidth, fixed: false }] });
  }
  if (input.includeRefrigerator) {
    // Packed as its bay (body plus panel room each side); the center is the same.
    const width = input.refrigeratorWidthIn + 2 * FRIDGE_BAY_ALLOWANCE_IN;
    if (fixed.refrigerator) pushFixed(fixed.refrigerator.wallLabel, [{ kind: "refrigerator", start: fixed.refrigerator.centerOffsetIn - width / 2, end: fixed.refrigerator.centerOffsetIn + width / 2, fixed: true }]);
    else free.push({ kind: "refrigerator", width, segments: (start) => [{ kind: "refrigerator", start, end: start + width, fixed: false }] });
  }
  if (typedDishwasher) pushFixed(typedDishwasher.wallLabel, [{ kind: "dishwasher", start: typedDishwasher.centerOffsetIn - dishwasherWidth / 2, end: typedDishwasher.centerOffsetIn + dishwasherWidth / 2, fixed: true }]);

  const result: AutoDesignDefaultCenters = {
    sink: fixed.sink ?? measurementOf(fallbackLabel, sinkGroupOffset + input.sinkBaseWidthIn / 2),
    stove: input.includeStove ? fixed.stove ?? null : null,
    refrigerator: input.includeRefrigerator ? fixed.refrigerator ?? null : null,
    fits: false,
  };

  for (const cornerClear of [AUTO_DESIGN_DEFAULT_CORNER_CLEAR_IN, 27, 0]) {
    const spaces = wallSpaces(input, room, labels, cornerClear);
    if (spaces.length === 0) break;
    const packCache = new Map<string, WallPack | null>();
    const pack = (space: WallSpace, mask: number): WallPack | null => {
      const key = `${space.label}:${mask}`;
      if (!packCache.has(key)) {
        const items = free.filter((_, index) => (mask & (1 << index)) !== 0);
        packCache.set(key, packWall(space, items, fixedByWall.get(space.label) ?? []));
      }
      return packCache.get(key)!;
    };
    let best: { score: number; assignment: number[] } | null = null;
    const assignment: number[] = [];
    const multiWall = spaces.length > 1;
    const evaluate = () => {
      let score = 0;
      for (let wallIndex = 0; wallIndex < spaces.length; wallIndex += 1) {
        let mask = 0;
        assignment.forEach((assigned, itemIndex) => { if (assigned === wallIndex) mask |= 1 << itemIndex; });
        const packed = pack(spaces[wallIndex]!, mask);
        if (!packed) return;
        score += packed.score;
        const hasFixed = (fixedByWall.get(spaces[wallIndex]!.label) ?? []).length > 0;
        if (multiWall && mask === 0 && !hasFixed) score += PENALTY.emptyLayoutWall;
      }
      if (multiWall) {
        const wallOf = (kind: FreeItem["kind"]) => {
          const index = free.findIndex((item) => item.kind === kind);
          if (index >= 0) return spaces[assignment[index]!]!.label;
          return kind === "sink" ? fixed.sink?.wallLabel : kind === "stove" ? fixed.stove?.wallLabel : fixed.refrigerator?.wallLabel;
        };
        const sinkWall = wallOf("sink");
        const stoveWall = input.includeStove ? wallOf("stove") : undefined;
        if (sinkWall && stoveWall && sinkWall === stoveWall) score += PENALTY.sinkAndRangeSameWall;
      }
      if (!best || score < best.score - 1e-9) best = { score, assignment: [...assignment] };
    };
    const assign = (itemIndex: number) => {
      if (itemIndex === free.length) {
        evaluate();
        return;
      }
      for (let wallIndex = 0; wallIndex < spaces.length; wallIndex += 1) {
        assignment[itemIndex] = wallIndex;
        assign(itemIndex + 1);
      }
      assignment.length = itemIndex;
    };
    assign(0);
    const found = best as { score: number; assignment: number[] } | null;
    if (!found) continue;
    for (let wallIndex = 0; wallIndex < spaces.length; wallIndex += 1) {
      let mask = 0;
      found.assignment.forEach((assigned, itemIndex) => { if (assigned === wallIndex) mask |= 1 << itemIndex; });
      const packed = pack(spaces[wallIndex]!, mask)!;
      for (const item of free) {
        const start = packed.starts.get(item.kind);
        if (start == null) continue;
        const label = spaces[wallIndex]!.label;
        if (item.kind === "sink") result.sink = measurementOf(label, start + sinkGroupOffset + input.sinkBaseWidthIn / 2);
        if (item.kind === "stove") result.stove = measurementOf(label, start + item.width / 2);
        if (item.kind === "refrigerator") result.refrigerator = measurementOf(label, start + item.width / 2);
      }
    }
    result.fits = true;
    return result;
  }

  // Nothing fits without an overlap (a very small room): line the items up from
  // the start of the first wall so the build names what does not fit.
  let cursor = 0;
  for (const item of free) {
    if (item.kind === "sink") result.sink = measurementOf(fallbackLabel, cursor + sinkGroupOffset + input.sinkBaseWidthIn / 2);
    if (item.kind === "stove") result.stove = measurementOf(fallbackLabel, cursor + item.width / 2);
    if (item.kind === "refrigerator") result.refrigerator = measurementOf(fallbackLabel, cursor + item.width / 2);
    cursor += item.width;
  }
  return result;
}

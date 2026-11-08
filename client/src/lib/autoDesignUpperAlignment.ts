/**
 * Wall-cabinet alignment.
 *
 * Owner rule: the uppers above a run start and stop where the floor cabinets
 * under them start and stop. No upper hangs over bare wall past the end of the
 * base run, and no opening is left in the middle of a run that has counter below
 * it — except the deliberate bays: a sink window, the range (its bridge and
 * microwave own that span), the refrigerator assembly, and a seated corner
 * cabinet's own vertex.
 *
 * Everything here reads the LOWER layer as it stands when the upper run tiles, so
 * a filler, a tall box or a seated corner that moved earlier in the build is
 * measured as it really is.
 */
import {
  COLLISION_EPSILON_IN,
  STD,
  WALL_OPENING_CLEARANCE_IN,
  cabinetWall,
  isCornerCabinet,
  isFillerItem,
  isPanelItem,
  isRangeOrOven,
  isRefrigerator,
  isSinkBaseCabinet,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";

export type UpperAlignmentSpan = { start: number; end: number };

const EDGE_TOL_IN = 0.05;

/** Widths below this are a sliver, not a wall cabinet, so a gap that small is not reported. */
export const MIN_UPPER_GAP_IN = 9;

/** True for a full-height floor box: uppers never continue above or past it. */
export function isTallFloorBox(item: PlacedCabinet): boolean {
  if (item.placement !== "tall") return false;
  return !isFillerItem(item) && !isPanelItem(item);
}

/** True for a seated corner cabinet, whose own vertex is not a hole to fill. */
export function isCornerFloorBox(item: PlacedCabinet): boolean {
  return isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null);
}

function mergeSpans(spans: readonly UpperAlignmentSpan[]): UpperAlignmentSpan[] {
  const sorted = [...spans].filter((span) => span.end - span.start > EDGE_TOL_IN).sort((left, right) => left.start - right.start);
  const merged: UpperAlignmentSpan[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end + EDGE_TOL_IN) {
      last.end = Math.max(last.end, span.end);
      continue;
    }
    merged.push({ ...span });
  }
  return merged;
}

/**
 * The leg a seated corner cabinet reaches along one of its two walls. On its own
 * wall that is the corner's full plan span; on the return wall it is a cabinet
 * depth measured from the shared vertex.
 */
export function cornerLegSpanOnWall(
  corner: PlacedCabinet,
  wallId: string,
  room: RoomData,
): UpperAlignmentSpan | null {
  if (!isCornerFloorBox(corner)) return null;
  const frame = wallRunFrame(wallId, room);
  if (!frame) return null;
  const ownWall = cabinetWall(corner, room);
  if (!ownWall) return null;
  const ownStart = wallRunOffset(corner, ownWall, room);
  const span = wallRunSpan(corner, ownWall, room);
  if (ownWall === wallId) return { start: ownStart, end: ownStart + span };
  const legIn = Math.min(span, Math.max(0, Number(corner.depth) || STD.BASE_DEPTH));
  const touchesStart = Math.abs(ownStart - frame.runStart) <= 0.5;
  return touchesStart
    ? { start: frame.runStart, end: frame.runStart + legIn }
    : { start: frame.runEnd - legIn, end: frame.runEnd };
}

/**
 * The floor coverage on one wall: what an upper may align to. Tall boxes are
 * included, so an upper can never be seated past one.
 */
export function upperFloorCoverage(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  wallId: string,
): UpperAlignmentSpan[] {
  const spans: UpperAlignmentSpan[] = [];
  for (const item of placed) {
    if (isFillerItem(item)) continue;
    const leg = cornerLegSpanOnWall(item, wallId, room);
    if (leg) {
      spans.push(leg);
      continue;
    }
    if (cabinetWall(item, room) !== wallId) continue;
    if (item.placement !== "base" && item.placement !== "appliance" && item.placement !== "tall") continue;
    const start = wallRunOffset(item, wallId, room);
    spans.push({ start, end: start + wallRunSpan(item, wallId, room) });
  }
  return mergeSpans(spans);
}

/**
 * The span a wall-cabinet run may tile: every floor box on the wall, from the
 * first to the last, clipped to the usable run.
 */
export function upperAlignableSpan(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  wallId: string,
): UpperAlignmentSpan | null {
  const frame = wallRunFrame(wallId, room);
  if (!frame) return null;
  const coverage = upperFloorCoverage(placed, room, wallId);
  if (!coverage.length) return null;
  const start = Math.max(frame.runStart, Math.min(...coverage.map((span) => span.start)));
  const end = Math.min(frame.runEnd, Math.max(...coverage.map((span) => span.end)));
  return end - start > EDGE_TOL_IN ? { start, end } : null;
}

/**
 * The bays an upper is deliberately never expected in: the range (its bridge and
 * microwave own that span), the refrigerator assembly, a seated corner's own
 * vertex, and a sink window with its required clearance.
 */
export function deliberateUpperBays(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  wallId: string,
  openings: readonly WallOpening[] = [],
): UpperAlignmentSpan[] {
  const bays: UpperAlignmentSpan[] = [];
  const sinkBases: UpperAlignmentSpan[] = [];
  for (const item of placed) {
    if (cabinetWall(item, room) !== wallId) continue;
    const start = wallRunOffset(item, wallId, room);
    const end = start + wallRunSpan(item, wallId, room);
    if (isCornerFloorBox(item)) bays.push({ start, end });
    if (item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description)) bays.push({ start, end });
    if (isRefrigerator(item) || item.refrigeratorAssemblyId != null) bays.push({ start, end });
    if (isSinkBaseCabinet(item)) sinkBases.push({ start, end });
  }
  // A window over a sink base owns the wall above it, with the same 3-inch
  // clearance the wall run keeps on each side.
  for (const opening of openings) {
    if (opening.kind !== "window" || opening.side !== wallId) continue;
    const overSink = sinkBases.some((span) => span.start < opening.offset + opening.width - EDGE_TOL_IN
      && span.end > opening.offset + EDGE_TOL_IN);
    if (!overSink) continue;
    bays.push({
      start: opening.offset - WALL_OPENING_CLEARANCE_IN,
      end: opening.offset + opening.width + WALL_OPENING_CLEARANCE_IN,
    });
  }
  return mergeSpans(bays);
}

/**
 * Openings in the upper layer the owner rule forbids: a gap with counter below it
 * that no wall cabinet covers. Deliberate bays are excluded, so a sink window, the
 * range, a corner and the refrigerator never read as a defect.
 */
export function upperCoverageGaps(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallId: string;
  openings?: readonly WallOpening[];
  /** Extra spans that stay open on purpose. */
  reserved?: readonly UpperAlignmentSpan[];
  minGapIn?: number;
}): UpperAlignmentSpan[] {
  const minGap = input.minGapIn ?? MIN_UPPER_GAP_IN;
  const { placed, room, wallId } = input;
  const span = upperAlignableSpan(placed, room, wallId);
  if (!span) return [];
  const bounds: UpperAlignmentSpan = span;
  const under = placed
    .filter((item) => cabinetWall(item, room) === wallId
      && (item.placement === "base" || item.placement === "appliance")
      && !isFillerItem(item)
      && !isRefrigerator(item)
      // A corner base's own vertex belongs to its corner upper, never a straight one.
      && !isCornerFloorBox(item))
    .map((item) => {
      const start = wallRunOffset(item, wallId, room);
      return { start, end: start + wallRunSpan(item, wallId, room) };
    });
  if (!under.length) return [];
  const covered = mergeSpans(placed
    .filter((item) => cabinetWall(item, room) === wallId
      && item.placement === "wall"
      && !/hood/i.test(item.masterCode ?? ""))
    .map((item) => {
      const start = wallRunOffset(item, wallId, room);
      return { start, end: start + wallRunSpan(item, wallId, room) };
    }));
  const bays = mergeSpans([...deliberateUpperBays(placed, room, wallId, input.openings), ...(input.reserved ?? [])]);
  const gaps: UpperAlignmentSpan[] = [];
  for (const bay of under) {
    let cursor = bay.start;
    for (const upper of covered) {
      if (upper.end <= cursor + EDGE_TOL_IN || upper.start >= bay.end - EDGE_TOL_IN) continue;
      if (upper.start > cursor + EDGE_TOL_IN) collect(cursor, Math.min(upper.start, bay.end));
      cursor = Math.max(cursor, Math.min(upper.end, bay.end));
    }
    if (bay.end > cursor + EDGE_TOL_IN) collect(cursor, bay.end);
  }
  return gaps;

  function collect(start: number, end: number) {
    const left = Math.max(start, bounds.start);
    const right = Math.min(end, bounds.end);
    if (right - left < minGap) return;
    if (bays.some((zone) => left >= zone.start - EDGE_TOL_IN && right <= zone.end + EDGE_TOL_IN)) return;
    const previous = gaps[gaps.length - 1];
    if (previous && left <= previous.end + EDGE_TOL_IN) {
      previous.end = Math.max(previous.end, right);
      return;
    }
    gaps.push({ start: left, end: right });
  }
}

/**
 * Uppers that leave the floor coverage under them: a wall cabinet hanging entirely
 * over bare wall. Those are the stray pieces that read as an upper run which does
 * not line up with the bases below it.
 */
export function uppersOutsideRun(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallId: string;
  uppers?: readonly PlacedCabinet[];
}): PlacedCabinet[] {
  const coverage = upperFloorCoverage(input.placed, input.room, input.wallId);
  if (!coverage.length) return [];
  const uppers = input.uppers
    ?? input.placed.filter((item) => cabinetWall(item, input.room) === input.wallId && item.placement === "wall");
  return uppers.filter((item) => {
    const start = wallRunOffset(item, input.wallId, input.room);
    const end = start + wallRunSpan(item, input.wallId, input.room);
    return !coverage.some((span) => Math.min(end, span.end) - Math.max(start, span.start) > EDGE_TOL_IN);
  });
}

/**
 * The widest wall box the line sells at most `maxWidthIn`, so an upper can stop
 * exactly at a base-run end instead of overhanging it.
 */
export function widestUpperWithin(
  widths: readonly number[],
  maxWidthIn: number,
  minWidthIn = MIN_UPPER_GAP_IN,
): number | null {
  const usable = widths.filter((width) => width >= minWidthIn - COLLISION_EPSILON_IN
    && width <= maxWidthIn + COLLISION_EPSILON_IN);
  if (!usable.length) return null;
  return Math.max(...usable);
}

/**
 * Drop wall-layer fillers that stand outside the floor coverage of their run.
 *
 * A filler is flat stock, so it never counts as a wall cabinet, but a filler
 * hanging past the end of the base run still reads as an upper run that does not
 * line up with the bases under it — the stray offsets the owner reported. Filler
 * inside the run (and beside a window or a corner) is untouched, so every seam
 * the run really has stays closed.
 */
export function trimWallFillersOutsideRun(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  /** Uids to consider; defaults to every wall filler on the wall. */
  walls?: readonly string[];
}): { placed: PlacedCabinet[]; removed: PlacedCabinet[] } {
  const walls = input.walls ?? Array.from(new Set(input.placed
    .filter((item) => item.placement === "wall")
    .map((item) => cabinetWall(item, input.room))
    .filter(Boolean)));
  const removable = new Set<string>();
  for (const wall of walls) {
    const coverage = upperFloorCoverage(input.placed, input.room, wall);
    if (!coverage.length) continue;
    for (const item of input.placed) {
      if (item.placement !== "wall") continue;
      if (cabinetWall(item, input.room) !== wall) continue;
      if (!isFillerItem(item) && !isPanelItem(item)) continue;
      const start = wallRunOffset(item, wall, input.room);
      const end = start + wallRunSpan(item, wall, input.room);
      const inside = coverage.some((span) => Math.min(end, span.end) - Math.max(start, span.start) > EDGE_TOL_IN);
      if (!inside) removable.add(item.uid);
    }
  }
  if (!removable.size) return { placed: [...input.placed], removed: [] };
  return {
    placed: input.placed.filter((item) => !removable.has(item.uid)),
    removed: input.placed.filter((item) => removable.has(item.uid)),
  };
}

/** The standard wall-cabinet depth, re-exported so callers read one constant. */
export const STANDARD_UPPER_DEPTH_IN = STD.WALL_DEPTH;

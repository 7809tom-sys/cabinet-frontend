import { hasAefPrintedGeometry, isFramelessDeepWallCabinet } from "@shared/aefFramelessGeometry";
import { AEF_SLAB_DOOR_THICKNESS_IN } from "./aefEndPanelStock";
import { planWallWidthsOverBase, coverCatalogSpan } from "./autoDesignGapSolver";
import {
  autoDesignFillerMaxIn, SEAM_MIN_IN, findAutoDesignSeams, fillersForSeam, intersectWithCoverage, lowerCoverageOnWall, upperReservedZones,
  type AutoDesignSeam,
} from "./autoDesignSeamFillers";
import { buildRequiredBlindCornerFiller, requiresConfiguredBlindCornerFiller } from "./blindCornerRequiredFiller";
import { cabinetDrawingType, isWallBlindCornerCabinet } from "./cabinetGraphics";
import { isSingleDoorTwentyFourRow } from "./singleDoorTwentyFour";
import type { CatalogFillerCandidate } from "./catalogFiller";
import {
  deliberateUpperBays,
  cornerLegSpanOnWall,
  trimWallFillersOutsideRun,
  upperCoverageGaps,
  uppersOutsideRun,
  type UpperAlignmentSpan,
} from "./autoDesignUpperAlignment";
import {
  COLLISION_EPSILON_IN, WALL_OPENING_CLEARANCE_IN, appendCollisionFreePlacements,
  cabinetPlacementCollisionDetail, cabinetWall, dim, footprintDepth, formatEighthInches, formatInches, freeSegmentsOnWall,
  STD, isBaseBlindCorner, isCornerCabinet, isFillerItem, isPanelItem, isRangeOrOven, isRefrigerator, isSinkBaseCabinet, assignBlindCornerDoorSides,
  ordinaryWallMountBottom, wallCeilingMin, wallPlacementAt, wallRunCornerPlacement, wallRunFrame, wallRunJoinAt, wallRunOffset,
  wallRunSpan, type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening, type WallRunFrame,
} from "./design";

export type AutoDesignUpperCorner = {
  base: PlacedCabinet;
  point: { x: number; y: number; firstWallId: string };
};

/** Real catalogs rarely sell exactly 30/36/42: frameless uppers are 30.25/35.25/40.25. */
export const WALL_HEIGHT_MATCH_TOLERANCE_IN = 2;
const SAME_HEIGHT_IN = 0.005;

const NOT_A_STRAIGHT_UPPER = /glass|open shelf|plate rack|wine|microwave|refrigerator|hood|garage|stacker/i;

function isStraightStandardUpper(source: DesignCabinet): boolean {
  return cabinetDrawingType(source) === "standard-door"
    && source.glassDoor !== true && source.isCornerCabinet !== true
    && !isCornerCabinet(source.masterCode, source.description)
    && !isFramelessDeepWallCabinet(source)
    && !NOT_A_STRAIGHT_UPPER.test(`${source.masterCode} ${source.description} ${source.subCategory ?? ""}`);
}

/** A window sits over this sink, so the wall above it stays open. */
export function sinkHasWindowAbove(sink: PlacedCabinet, openings: readonly WallOpening[], room: RoomData): boolean {
  const wall = cabinetWall(sink, room);
  const start = wallRunOffset(sink, wall, room);
  const end = start + wallRunSpan(sink, wall, room);
  return openings.some((opening) => opening.kind === "window" && opening.side === wall
    && start < opening.offset + opening.width - COLLISION_EPSILON_IN
    && end > opening.offset + COLLISION_EPSILON_IN);
}

/**
 * The upper height the selected line actually sells for the admin's 30/36/42
 * request: the available standard-door wall height closest to the nominal one,
 * within two inches. Exact heights always win; ties choose the shorter box so
 * it can never collide with the ceiling.
 */
export function resolveWallHeightClass(catalog: readonly DesignCabinet[], nominalIn: number): number | null {
  const heights = Array.from(new Set(catalog
    .filter((source) => source.id > 0 && source.placement === "wall" && dim(source.width, 0) > 0
      && dim(source.depth, 0) > 0 && isStraightStandardUpper(source))
    .map((source) => Math.round(dim(source.height, 0) * 1000) / 1000)))
    .filter((height) => height > 0 && Math.abs(height - nominalIn) <= WALL_HEIGHT_MATCH_TOLERANCE_IN + 1e-9);
  if (!heights.length) return null;
  return heights.sort((a, b) => Math.abs(a - nominalIn) - Math.abs(b - nominalIn) || a - b)[0]!;
}

/**
 * A 42" design keeps only that line's 42" wall rows (42, or 40.25 on a frameless
 * line). Base rows stay. Shorter wall rows are what turned W1842 into W1830
 * when a later pass took the first catalog match for a width.
 */
export function catalogMatchingWallDesignHeight(
  catalog: readonly DesignCabinet[],
  nominalIn: number,
): DesignCabinet[] {
  if (Math.abs(nominalIn - 42) > 0.05) return [...catalog];
  const height = resolveWallHeightClass(catalog, nominalIn);
  if (height == null) return [...catalog];
  return catalog.filter((row) => row.placement !== "wall" || Math.abs(dim(row.height, 0) - height) <= SAME_HEIGHT_IN);
}

/**
 * The refrigerator cap and a hood or range bridge stay at their own heights.
 * The cabinet above the microwave does not: in a 42" design it is a 42" upper.
 */
export function keepsOwnWallHeight(item: PlacedCabinet): boolean {
  if (item.overRangeMicrowaveBridge === true) return true;
  if (item.refrigeratorAssemblyRole === "bridge") return true;
  if (item.refrigeratorAssemblyId) return true;
  return /hood/i.test(`${item.masterCode ?? ""} ${item.description ?? ""}`);
}

/** Top of the range to the bottom of the microwave, in inches. */
export function rangeToMicrowaveClearanceIn(
  placed: readonly PlacedCabinet[],
  cabinet: PlacedCabinet,
  room: RoomData,
): { clearanceIn: number; rangeTopIn: number; microwaveBottomIn: number; microwaveTopIn: number; cabinetBottomIn: number; cabinetTopIn: number } | null {
  const side = cabinetWall(cabinet, room);
  const center = wallRunOffset(cabinet, side, room) + wallRunSpan(cabinet, side, room) / 2;
  const onSpot = (item: PlacedCabinet) => cabinetWall(item, room) === side
    && Math.abs(wallRunOffset(item, side, room) + wallRunSpan(item, side, room) / 2 - center) <= 1;
  const range = placed.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description) && onSpot(item));
  const microwave = placed.find((item) => item.placement === "appliance" && /^MW-/i.test(item.masterCode ?? "") && onSpot(item));
  if (!range || !microwave) return null;
  const rangeTopIn = (Number(range.mountBottom) || 0) + (Number(range.height) || 0);
  const microwaveBottomIn = Number(microwave.mountBottom) || 0;
  const microwaveTopIn = microwaveBottomIn + (Number(microwave.height) || 0);
  const cabinetBottomIn = Number(cabinet.mountBottom) || 0;
  const cabinetTopIn = cabinetBottomIn + (Number(cabinet.height) || 0);
  return {
    clearanceIn: microwaveBottomIn - rangeTopIn,
    rangeTopIn,
    microwaveBottomIn,
    microwaveTopIn,
    cabinetBottomIn,
    cabinetTopIn,
  };
}

function microwaveClearanceNote(placed: readonly PlacedCabinet[], cabinet: PlacedCabinet, room: RoomData): string {
  const measure = rangeToMicrowaveClearanceIn(placed, cabinet, room);
  if (!measure) {
    return `${cabinet.masterCode} (${formatEighthInches(Number(cabinet.height))}) is the cabinet above the microwave. No range and microwave pair was found to measure the clearance.`;
  }
  const overlaps = measure.cabinetBottomIn < measure.microwaveTopIn - 0.05 && measure.cabinetTopIn > measure.microwaveBottomIn + 0.05;
  const overlap = overlaps
    ? ` The ${formatEighthInches(Number(cabinet.height))} cabinet occupies ${formatEighthInches(measure.cabinetBottomIn)}–${formatEighthInches(measure.cabinetTopIn)} and overlaps the microwave at ${formatEighthInches(measure.microwaveBottomIn)}–${formatEighthInches(measure.microwaveTopIn)}. The microwave was not lowered.`
    : "";
  return `${cabinet.masterCode} is the ${formatEighthInches(Number(cabinet.height))} cabinet above the microwave. Top of the range to the bottom of the microwave is ${formatEighthInches(measure.clearanceIn)}.${overlap}`;
}

function rejectsSingleDoorTwentyFour(row: DesignCabinet): boolean {
  if (isSingleDoorTwentyFourRow(row)) return true;
  return Math.abs(dim(row.width, 0) - 24) <= 0.05 && (row.numberOfDoors ?? 0) === 1;
}

/**
 * When the design is 42" uppers, an ordinary wall cabinet that is not that
 * tall is replaced by the same-width 42" SKU. If that width is not sold at
 * 42", the closest 42" width within the 3" filler cap is used and named.
 */
export function enforceFortyTwoWallCabinets(input: {
  placed: PlacedCabinet[];
  catalog: readonly DesignCabinet[];
  nominalIn: number;
  room: RoomData;
}): { placed: PlacedCabinet[]; notes: string[] } {
  if (Math.abs(input.nominalIn - 42) > 0.05) return { placed: input.placed, notes: [] };
  const height = resolveWallHeightClass(input.catalog, input.nominalIn);
  if (height == null) return { placed: input.placed, notes: [] };
  const stock = input.catalog.filter((row) => row.id > 0 && row.placement === "wall"
    && Math.abs(dim(row.height, 0) - height) <= SAME_HEIGHT_IN
    && dim(row.width, 0) > 0
    && !rejectsSingleDoorTwentyFour(row));
  const notes: string[] = [];
  let working = [...input.placed];
  for (const item of input.placed) {
    const microwaveUnder = item.overRangeMicrowaveBridge === true
      && rangeToMicrowaveClearanceIn(input.placed, item, input.room) != null;
    if (item.placement !== "wall" || isFillerItem(item) || isPanelItem(item) || (keepsOwnWallHeight(item) && !microwaveUnder)) continue;
    if (Math.abs(Number(item.height) - height) <= SAME_HEIGHT_IN) continue;
    const wanted = Number(item.width) || 0;
    const exact = stock.find((row) => Math.abs(dim(row.width, 0) - wanted) <= COLLISION_EPSILON_IN);
    const nearest = exact ?? stock
      .map((row) => ({ row, width: dim(row.width, 0) }))
      .filter((entry) => Math.abs(entry.width - wanted) <= autoDesignFillerMaxIn() + 0.05 && entry.width <= wanted + COLLISION_EPSILON_IN)
      .sort((a, b) => Math.abs(a.width - wanted) - Math.abs(b.width - wanted) || b.width - a.width)[0]?.row;
    if (!nearest) {
      notes.push(`${item.masterCode} stays ${formatEighthInches(Number(item.height))} tall: no ${formatEighthInches(height)} wall cabinet is within ${formatEighthInches(autoDesignFillerMaxIn())} of its ${formatEighthInches(wanted)} width.`);
      continue;
    }
    const width = dim(nearest.width, wanted);
    // Only the cabinet that actually has a microwave under it becomes a 42"
    // upper. A bridge or hood over a range with no microwave keeps its height.
    const aboveMicrowave = item.overRangeMicrowaveBridge === true
      && rangeToMicrowaveClearanceIn(input.placed, item, input.room) != null;
    const replacement: PlacedCabinet = {
      ...item,
      cabinetId: nearest.id,
      masterCode: nearest.masterCode,
      description: nearest.description,
      category: nearest.category,
      subCategory: nearest.subCategory,
      width,
      height,
      numberOfDoors: nearest.numberOfDoors,
      numberOfDrawers: nearest.numberOfDrawers,
      catalogImageUrl: nearest.catalogImageUrl ?? item.catalogImageUrl,
      // Same bottom line as the other 42" uppers. The microwave is left on its
      // standard mount; this flag stops the 72" bridge repair from putting the
      // 42" box back on that short-bridge datum.
      mountBottom: ordinaryWallMountBottom({ ...nearest, height }),
      mountBottomAdjusted: aboveMicrowave ? true : item.mountBottomAdjusted,
      overRangeMicrowaveBridge: aboveMicrowave ? false : item.overRangeMicrowaveBridge,
    };
    if (aboveMicrowave) {
      working = working.map((entry) => entry.uid === item.uid ? replacement : entry);
      notes.push(microwaveClearanceNote(working, replacement, input.room));
      if (Math.abs(width - wanted) > 0.05) {
        notes.push(`No ${formatEighthInches(wanted)} × ${formatEighthInches(height)} wall cabinet above the microwave; ${nearest.masterCode} (${formatEighthInches(width)} × ${formatEighthInches(height)}) replaced ${item.masterCode}.`);
      }
      continue;
    }
    const without = working.filter((entry) => entry.uid !== item.uid);
    const accepted = appendCollisionFreePlacements(without, [replacement], input.room);
    if (accepted.rejected.length > 0) {
      notes.push(`${item.masterCode} stays ${formatEighthInches(Number(item.height))} tall: ${nearest.masterCode} does not fit in its place.`);
      continue;
    }
    working = accepted.placed;
    if (Math.abs(width - wanted) > 0.05) {
      notes.push(`No ${formatEighthInches(wanted)} × ${formatEighthInches(height)} wall cabinet; ${nearest.masterCode} (${formatEighthInches(width)} × ${formatEighthInches(height)}) replaced ${item.masterCode}.`);
    }
  }
  return { placed: working, notes };
}


/** Standard wall cabinets are sold in 3-inch width steps; a gap smaller than one step cannot be tiled. */
const WALL_WIDTH_STEP_IN = 3;
const MIN_UPPER_WIDTH_IN = 9;

/**
 * Tile the whole span. A 3 inch tail is a filler, not a reason to discard the
 * run. The old six-piece search stopped a long wall early, and an exact 3 inch
 * remainder used to throw away every cabinet in the span.
 */
function wallRunCabinets(length: number, standard: readonly DesignCabinet[]): { cabinets: DesignCabinet[]; remainder: number } {
  const widths = standard.map((row) => dim(row.width, 0)).filter((width) => width > 0);
  const cover = coverCatalogSpan(length, widths, autoDesignFillerMaxIn());
  const cabinets: DesignCabinet[] = [];
  for (const width of cover.widths) {
    const row = standard.find((candidate) => Math.abs(dim(candidate.width, 0) - width) <= COLLISION_EPSILON_IN);
    if (!row) return { cabinets: [], remainder: length };
    cabinets.push(row);
  }
  return { cabinets, remainder: cover.remainder };
}
/** The corner cabinet an Auto-Design blind corner gets: a plain 12-inch-wide upper in the corner square. */
export const AUTO_DESIGN_CORNER_UPPER_WIDTH_IN = 12;

/**
 * A window over the sink owns the wall above it: no upper is ever placed there,
 * and the neighbours stop 3 inches short of it. A window only counts as a sink
 * window when a sink base sits on the same wall under it.
 */
function sinkWindowZones(
  placed: readonly PlacedCabinet[],
  openings: readonly WallOpening[],
  room: RoomData,
  wall: string,
  panelClearance = 0,
): { s: number; e: number }[] {
  const sinks = placed.filter((item) => item.placement === "base" && isSinkBaseCabinet(item) && cabinetWall(item, room) === wall);
  const clearance = WALL_OPENING_CLEARANCE_IN + panelClearance;
  return openings
    .filter((opening) => opening.kind === "window" && opening.side === wall
      && sinks.some((sink) => {
        const start = wallRunOffset(sink, wall, room);
        const end = start + wallRunSpan(sink, wall, room);
        return start < opening.offset + opening.width - COLLISION_EPSILON_IN && end > opening.offset + COLLISION_EPSILON_IN;
      }))
    .map((opening) => ({ s: opening.offset - clearance, e: opening.offset + opening.width + clearance }));
}

/** The pieces of [start, end] left once the given zones are removed (pieces narrower than the smallest upper are dropped). */
function subtractZones(start: number, end: number, zones: readonly { s: number; e: number }[]): { start: number; end: number }[] {
  let pieces = [{ start, end }];
  for (const zone of zones) {
    pieces = pieces.flatMap((piece) => {
      if (zone.e <= piece.start + COLLISION_EPSILON_IN || zone.s >= piece.end - COLLISION_EPSILON_IN) return [piece];
      const out: { start: number; end: number }[] = [];
      if (zone.s > piece.start + COLLISION_EPSILON_IN) out.push({ start: piece.start, end: zone.s });
      if (zone.e < piece.end - COLLISION_EPSILON_IN) out.push({ start: zone.e, end: piece.end });
      return out;
    });
  }
  return pieces.filter((piece) => piece.end - piece.start >= MIN_UPPER_WIDTH_IN - COLLISION_EPSILON_IN);
}

/** Final stage only: the measured appliances, selected corners and base runs are immutable. */
export function buildAutoDesignWallCabinets(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  openings: WallOpening[];
  catalog: DesignCabinet[];
  wallCabinetHeightIn: 30 | 36 | 42;
  styleId: number | null;
  makeUid: () => string;
  corners?: AutoDesignUpperCorner[];
  /** Selected-line fillers; required for a wall blind corner's integrated 3″ face filler. */
  catalogFillers?: readonly CatalogFillerCandidate[];
  /**
   * Close every remaining opening in the upper layer above the lower cabinets with real
   * wall cabinets and catalog filler. Never fills over the range, the sink or its window,
   * or the refrigerator assembly. Off by default so standalone callers keep exact behavior.
   */
  closeSeams?: boolean;
  /**
   * Fill leftover slivers with filler. Owner rule: filler is the LAST resort and
   * never automatic at a run end, so the measured build leaves this off and uses
   * the shared real-cabinet pass instead. A caller that places real cabinets
   * first may turn it back on for a genuinely unusable sliver.
   */
  allowFiller?: boolean;
  /**
   * Owner rule: uppers line up with the bases beneath them. Drops a wall cabinet
   * with no floor coverage under it and closes an opening left over a run that has
   * counter below it with real wall cabinets. Off only for callers that want the
   * raw per-lower projection.
   */
  alignToBaseRuns?: boolean;
}): {
  placed: PlacedCabinet[];
  additions: PlacedCabinet[];
  skipped: string[];
  /** Widths that had no stock box at the design height, and the 42" SKU used instead. */
  substitutions: string[];
  /** The real catalog height used (for example 30.25 for a requested 30). Null when the line has none. */
  heightUsedIn: number | null;
} {
  const { room, openings } = input;
  let working = [...input.placed];
  const additions: PlacedCabinet[] = [];
  const skipped: string[] = [];
  const substitutions: string[] = [];
  // Spans an aligned projection deliberately refused (a window too close, a
  // blocked second tile, a ceiling). They stay open and reported; the last
  // alignment pass never "fixes" them with a different packing.
  const blockedBays = new Map<string, UpperAlignmentSpan[]>();
  const blockBay = (wall: string, start: number, end: number) => {
    if (!(end > start)) return;
    const list = blockedBays.get(wall) ?? [];
    list.push({ start, end });
    blockedBays.set(wall, list);
  };
  // Only when the line sells no wall cabinet of any kind near the request is the height itself missing.
  // A line with just specialty uppers (glass, wine, open shelf) still has that height; its ordinary
  // uppers are simply absent, which the per-run messages below report accurately.
  const sellsWallCabinetNearHeight = input.catalog.some((source) => source.id > 0 && source.placement === "wall"
    && dim(source.width, 0) > 0 && dim(source.depth, 0) > 0
    && Math.abs(dim(source.height, 0) - input.wallCabinetHeightIn) <= WALL_HEIGHT_MATCH_TOLERANCE_IN + 1e-9);
  const heightUsedIn = resolveWallHeightClass(input.catalog, input.wallCabinetHeightIn)
    ?? (sellsWallCabinetNearHeight ? input.wallCabinetHeightIn : null);
  if (heightUsedIn == null) {
    skipped.push(`No source-priced ${input.wallCabinetHeightIn}″ wall cabinet exists in this cabinet line (nearest sold height is more than ${WALL_HEIGHT_MATCH_TOLERANCE_IN}″ away), so no wall cabinets were added.`);
    return { placed: working, additions, skipped, substitutions, heightUsedIn };
  }
  const height = heightUsedIn;
  const eligible = input.catalog.filter((source) => source.id > 0
    && source.placement === "wall" && Math.abs(dim(source.height, 0) - height) <= SAME_HEIGHT_IN
    && dim(source.width, 0) > 0 && dim(source.depth, 0) > 0);
  const standard = eligible.filter((source) => isStraightStandardUpper(source) && !rejectsSingleDoorTwentyFour(source));
  const corners = eligible.filter((source) => ["diagonal-corner", "l-corner", "triangle-corner"].includes(cabinetDrawingType(source)))
    .sort((a, b) => dim(b.width, 0) - dim(a.width, 0));
  const wallBlinds = eligible.filter((source) => isWallBlindCornerCabinet(source))
    .sort((a, b) => dim(b.width, 0) - dim(a.width, 0));
  const makeCandidate = (source: DesignCabinet): PlacedCabinet => ({
    uid: input.makeUid(), cabinetId: source.id, masterCode: source.masterCode, description: source.description,
    category: source.category, subCategory: source.subCategory, placement: "wall",
    x: 0, y: 0, rotation: 0, width: dim(source.width, 0), depth: footprintDepth(source), height,
    mountBottom: ordinaryWallMountBottom({ ...source, height }),
    numberOfDoors: source.numberOfDoors, numberOfDrawers: source.numberOfDrawers,
    cornerType: source.cornerType ?? null, fillerRequired: source.fillerRequired ?? false,
    pullMin: source.pullMin ?? null, pullMax: source.pullMax ?? null,
    catalogImageUrl: source.catalogImageUrl ?? null,
    constructionMethod: source.constructionMethod ?? null,
    styleId: input.styleId,
  });
  /**
   * Every gate a wall cabinet must pass before it may join the run: the ceiling,
   * the opening clearance (a window keeps its 3 inches), and no collision with
   * anything already seated. Shared with the last alignment pass, so a gap that
   * pass closes is held to exactly the same rules as the run itself.
   */
  const upperFits = (candidate: PlacedCabinet, against: readonly PlacedCabinet[]): boolean => {
    const bottom = candidate.mountBottom ?? 54;
    const wall = cabinetWall(candidate, room);
    if (bottom + (Number(candidate.height) || height) > wallCeilingMin(room, wall) + COLLISION_EPSILON_IN) return false;
    const start = wallRunOffset(candidate, wall, room);
    const span = wallRunSpan(candidate, wall, room);
    const fits = freeSegmentsOnWall(wall, room, [...against], openings, span, WALL_OPENING_CLEARANCE_IN,
      "wall", true, candidate, candidate.depth).some((segment) => start >= segment.start - COLLISION_EPSILON_IN
        && start + span <= segment.start + segment.length + COLLISION_EPSILON_IN);
    return fits && !cabinetPlacementCollisionDetail(candidate, [...against], room);
  };
  const commit = (candidate: PlacedCabinet): boolean => {
    if (!upperFits(candidate, working)) return false;
    const result = appendCollisionFreePlacements(working, [candidate], room);
    if (result.rejected.length) return false;
    working = result.placed;
    additions.push(candidate);
    return true;
  };
  // Seat actual upper corners at the same vertex before the straight uppers.
  // Direct wallRunCornerPlacement cannot silently choose a different free corner.
  for (const { base, point } of input.corners ?? []) {
    const frame = wallRunFrame(point.firstWallId, room);
    let placed = false;
    if (frame) {
      const at = Math.hypot(frame.start.x - point.x, frame.start.y - point.y) <= 0.01 ? "start" : "end";
      if (isBaseBlindCorner(base)) {
        // The corner itself is a wall blind corner (or another true corner upper).
        // A plain 12" wall cabinet is not a corner and is never seated in the vertex.
        // A base blind corner gets a wall blind corner at the same vertex, the
        // widest one that does not overhang its base, with its integrated 3″ filler.
        for (const source of placed ? [] : wallBlinds.filter((row) => dim(row.width, 0) <= base.width + COLLISION_EPSILON_IN)) {
          const candidate = makeCandidate(source);
          const spot = wallRunCornerPlacement(candidate, frame, at, room);
          if (!spot) continue;
          const seated = { ...candidate, ...spot };
          const snapshot = working;
          const addedBefore = additions.length;
          if (!commit(seated)) continue;
          if (requiresConfiguredBlindCornerFiller(seated)) {
            const required = buildRequiredBlindCornerFiller(seated, room, input.catalogFillers ?? [], input.makeUid, input.styleId);
            if (!required.ok) {
              working = snapshot; additions.splice(addedBefore);
              skipped.push(`${seated.masterCode}: its required ${formatInches(3)} wall filler is not sold in this cabinet line.`);
              continue;
            }
            working = [...working, required.filler];
            additions.push(required.filler);
          }
          const baseWall = cabinetWall(base, room);
          const baseStart = wallRunOffset(base, baseWall, room);
          const baseEnd = baseStart + wallRunSpan(base, baseWall, room);
          const cornerOnBase = cabinetWall(seated, room) === baseWall;
          const cornerStart = cornerOnBase ? wallRunOffset(seated, baseWall, room) : baseEnd;
          const cornerEnd = cornerOnBase ? cornerStart + wallRunSpan(seated, baseWall, room) : baseEnd;
          const openSegments = [
            { start: baseStart, end: Math.min(baseEnd, cornerStart) },
            { start: Math.max(baseStart, cornerEnd), end: baseEnd },
          ].filter((segment) => segment.end - segment.start >= MIN_UPPER_WIDTH_IN - COLLISION_EPSILON_IN);
          for (const segment of openSegments) {
            const length = segment.end - segment.start;
            const widths = planWallWidthsOverBase(length, standard.map((row) => dim(row.width, 0)))
              ?? [];
            let along = segment.start;
            for (const width of widths) {
              const row = standard.find((candidate) => Math.abs(dim(candidate.width, 0) - width) <= COLLISION_EPSILON_IN);
              if (!row) break;
              const next = makeCandidate(row);
              const nextSpot = wallPlacementAt(along, next.width, next.depth, baseWall, room);
              if (!nextSpot || !commit({ ...next, ...nextSpot })) break;
              along += next.width;
            }
          }
          placed = true;
          break;
        }
      } else {
        for (const source of corners.filter((row) => dim(row.width, 0) <= base.width + COLLISION_EPSILON_IN)) {
          const candidate = makeCandidate(source);
          const spot = wallRunCornerPlacement(candidate, frame, at, room);
          if (spot && commit({ ...candidate, ...spot })) {
            placed = true;
            if (input.wallCabinetHeightIn === 42 && Math.abs(dim(source.width, 0) - base.width) > 0.05) {
              substitutions.push(`No ${formatEighthInches(base.width)} × ${formatEighthInches(height)} corner upper; ${source.masterCode} (${formatEighthInches(dim(source.width, 0))} × ${formatEighthInches(height)}) was used.`);
            }
            // Rule: a 12-inch wall cabinet goes on each side of a diagonal (or L) corner upper,
            // filling the rest of the corner base's span on both of its walls.
            const seatedCorner = additions[additions.length - 1]!;
            const join = wallRunJoinAt(frame, at, room);
            const vertex = at === "start" ? frame.start : frame.end;
            const legs: Array<{ frame: WallRunFrame; atStart: boolean }> = [{ frame, atStart: at === "start" }];
            if (join && join.turnDeg === 90) {
              legs.push({ frame: join.frame, atStart: Math.hypot(join.frame.start.x - vertex.x, join.frame.start.y - vertex.y) <= 0.01 });
            }
            for (const leg of legs) {
              const cornerEnd = seatedCorner.width;
              const from = leg.atStart ? cornerEnd : leg.frame.length - base.width;
              const to = leg.atStart ? base.width : leg.frame.length - cornerEnd;
              const room12 = to - from;
              if (room12 < MIN_UPPER_WIDTH_IN - COLLISION_EPSILON_IN) continue;
              const wallId = leg.frame.id;
              const twelve = standard.find((row) => Math.abs(dim(row.width, 0) - AUTO_DESIGN_CORNER_UPPER_WIDTH_IN) <= COLLISION_EPSILON_IN);
              const pieces: DesignCabinet[] = [];
              let remaining = room12;
              if (twelve && remaining >= AUTO_DESIGN_CORNER_UPPER_WIDTH_IN - COLLISION_EPSILON_IN) {
                pieces.push(twelve);
                remaining -= AUTO_DESIGN_CORNER_UPPER_WIDTH_IN;
              }
              if (remaining >= MIN_UPPER_WIDTH_IN - COLLISION_EPSILON_IN) {
                const more = wallRunCabinets(remaining, standard).cabinets;
                const covered = more.reduce((sum, row) => sum + dim(row.width, 0), 0);
                if (covered <= remaining + COLLISION_EPSILON_IN) pieces.push(...more);
              }
              // Next to the corner first, so the run reads corner, 12", rest.
              const ordered = leg.atStart ? pieces : [...pieces].reverse();
              const total = ordered.reduce((sum, row) => sum + dim(row.width, 0), 0);
              let along = leg.atStart ? from : to - total;
              for (const row of ordered) {
                const piece = makeCandidate(row);
                const pieceSpot = wallPlacementAt(along, piece.width, piece.depth, wallId as never, room);
                if (!commit({ ...piece, ...pieceSpot })) {
                  skipped.push(`${base.masterCode} corner: the ${piece.width}″ upper beside the corner cabinet could not be seated on ${wallId}.`);
                  break;
                }
                along += piece.width;
              }
            }
            break;
          }
        }
      }
    }
    if (!placed) skipped.push(`${base.masterCode} corner: no compatible ${height}″ upper corner fits the selected vertex.`);
  }

  for (const lower of input.placed) {
    if (lower.placement !== "base" && lower.placement !== "appliance") continue;
    if (lower.placement === "base" && isSinkBaseCabinet(lower) && sinkHasWindowAbove(lower, openings, room)) {
      skipped.push(`Left open above ${lower.masterCode}: a window is over the sink.`);
      continue;
    }
    // Above the range the owner rule governs: an over-the-range microwave with a
    // bridge cabinet above it, never an ordinary full-height wall cabinet. The
    // bridge + microwave are placed by `planOverRangeCompanions` in the build, so
    // the wall run must leave this span alone whether or not a hood is there.
    const isRangeLower = isRangeOrOven(lower.masterCode, lower.description);
    if (isRefrigerator(lower) || isRangeLower
      || isCornerCabinet(lower.masterCode, lower.description) || isPanelItem(lower)
      || /filler|scribe/i.test(`${lower.masterCode} ${lower.description} ${lower.subCategory ?? ""}`)) continue;
    if (lower.placement === "appliance" && !/^DW[-_]?/i.test(lower.masterCode) && !isRangeOrOven(lower.masterCode, lower.description)) continue;
    const wall = cabinetWall(lower, room);
    const lowerStart = wallRunOffset(lower, wall, room);
    const lowerSpan = wallRunSpan(lower, wall, room);
    // Beside a sink window the upper stops 3 inches short of the window, so only
    // the clear remainder of this lower's run is covered. Everywhere else the
    // whole run is one atomic projection, exactly as before.
    const windowPanelClearance = input.catalog.some((source) => hasAefPrintedGeometry(source))
      ? AEF_SLAB_DOOR_THICKNESS_IN
      : 0;
    const zones = sinkWindowZones(input.placed, openings, room, wall, windowPanelClearance);
    const pieces = zones.length
      ? subtractZones(lowerStart, lowerStart + lowerSpan, zones).map((piece) => ({ start: piece.start, span: piece.end - piece.start }))
      : [{ start: lowerStart, span: lowerSpan }];
    if (!pieces.length) continue;
    // Each aligned lower projection is atomic: a window/corner/ceiling blocker
    // leaves the whole upper group unplaced rather than creating a partial mismatch.
    const before = working;
    const addedBefore = additions.length;
    let complete = true;
    for (const piece of pieces) {
      const widths = standard.map((row) => dim(row.width, 0));
      const exact = standard.find((source) => Math.abs(dim(source.width, 0) - piece.span) <= COLLISION_EPSILON_IN);
      const equalWidths = exact ? null : planWallWidthsOverBase(piece.span, widths);
      const cover = exact
        ? { widths: [piece.span], remainder: 0 }
        : equalWidths
          ? { widths: equalWidths, remainder: 0 }
          : coverCatalogSpan(piece.span, widths, autoDesignFillerMaxIn());
      const sources = cover.widths
        .map((width) => standard.find((row) => Math.abs(dim(row.width, 0) - width) <= COLLISION_EPSILON_IN))
        .filter((row): row is DesignCabinet => row != null);
      const covered = sources.reduce((sum, source) => sum + dim(source.width, 0), 0);
      const shortfall = piece.span - covered;
      if (!sources.length || shortfall > autoDesignFillerMaxIn() + COLLISION_EPSILON_IN || shortfall < -COLLISION_EPSILON_IN) {
        working = before;
        additions.splice(addedBefore);
        for (const entry of pieces) blockBay(wall, entry.start, entry.start + entry.span);
        skipped.push(`${lower.masterCode}: no source-sized ${height}″ wall cabinet matches its ${piece.span}″ run.`);
        complete = true;
        break;
      }
      const exactWidth = standard.some((row) => Math.abs(dim(row.width, 0) - piece.span) <= COLLISION_EPSILON_IN);
      if (input.wallCabinetHeightIn === 42 && !exactWidth) {
        const used = sources.map((row) => `${row.masterCode} (${formatEighthInches(dim(row.width, 0))} × ${formatEighthInches(height)})`).join(" + ");
        const leftover = shortfall > 0.05 ? `, leaving ${formatEighthInches(shortfall)}` : "";
        substitutions.push(`No ${formatEighthInches(piece.span)} × ${formatEighthInches(height)} wall cabinet; ${used} was used${leftover}.`);
      }
      let along = piece.start;
      for (const source of sources) {
        const candidate = makeCandidate(source);
        const spot = wallPlacementAt(along, candidate.width, candidate.depth, wall, room);
        if (!commit({ ...candidate, ...spot })) { complete = false; break; }
        along += candidate.width;
      }
      if (!complete) break;
    }
    if (!complete) {
      working = before;
      additions.splice(addedBefore);
      for (const entry of pieces) blockBay(wall, entry.start, entry.start + entry.span);
      skipped.push(`${lower.masterCode}: aligned upper needs review for an opening, corner, occupied bay, or ceiling clearance.`);
    }
  }
  if (input.closeSeams) {
    const reserved = upperReservedZones(input.placed, room);
    // Real wall cabinets always close what they can. Filler is gated: the measured
    // build only places filler when a person asks for it or as a true last resort.
    const allowFiller = input.allowFiller === true;
    const seams = findAutoDesignSeams({
      layer: "wall", placed: working, room, openings, corners: (input.corners ?? []).map((entry) => entry.point), reservedZones: reserved,
    });
    const upperBays = new Map<string, UpperAlignmentSpan[]>();
    const baysOn = (wall: string) => {
      const cached = upperBays.get(wall);
      if (cached) return cached;
      const zones = [
        ...deliberateUpperBays(input.placed, room, wall, openings),
        ...(input.corners ?? []).flatMap((entry) => {
          const leg = cornerLegSpanOnWall(entry.base, wall, room);
          return leg ? [leg] : [];
        }),
      ];
      upperBays.set(wall, zones);
      return zones;
    };
    const fillers = input.catalogFillers ?? [];
    for (const seam of seams) {
      const cover = lowerCoverageOnWall(input.placed, room, seam.wall, input.corners ?? []);
      for (const region of intersectWithCoverage({ start: seam.start, end: seam.end }, cover)) {
        const length = region.end - region.start;
        const leftNeighbor = region.start <= seam.start + 0.02 ? seam.left : null;
        const rightNeighbor = region.end >= seam.end - 0.02 ? seam.right : null;
        // Real boxes first, anchored to the real upper they continue; whatever is left is filler.
        let along = region.start;
        let remainder = length;
        const placedHere: PlacedCabinet[] = [];
        if (length >= MIN_UPPER_WIDTH_IN - COLLISION_EPSILON_IN && standard.length) {
          const widths = standard.map((row) => dim(row.width, 0)).filter((width) => width > 0).sort((a, b) => b - a);
          let guard = 0;
          while (region.end - along > autoDesignFillerMaxIn() + COLLISION_EPSILON_IN && guard < 40) {
            guard += 1;
            const remain = region.end - along;
            const cover = coverCatalogSpan(remain, widths, autoDesignFillerMaxIn());
            const candidates = Array.from(new Set([...(cover.widths[0] != null ? [cover.widths[0]] : []), ...widths.filter((width) => width <= remain + COLLISION_EPSILON_IN)]));
            let seated = false;
            for (const width of candidates) {
              const source = standard.find((row) => Math.abs(dim(row.width, 0) - width) <= COLLISION_EPSILON_IN);
              if (!source) continue;
              // A piece may never be seated inside a deliberate bay (the range, a
              // sink window, the refrigerator) or over a tall box's own span.
              if (baysOn(seam.wall).some((bay) => along < bay.end - COLLISION_EPSILON_IN && along + dim(source.width, 0) > bay.start + COLLISION_EPSILON_IN)) continue;
              const candidate = makeCandidate(source);
              const spot = wallPlacementAt(along, candidate.width, candidate.depth, seam.wall as never, room);
              if (spot && commit({ ...candidate, ...spot })) {
                placedHere.push(additions[additions.length - 1]!);
                along += candidate.width;
                seated = true;
                break;
              }
            }
            // A corner or hood blocks this spot. Jump to the next inch a real
            // upper fits. Stepping 3" at a time left a filler in every step.
            if (!seated) {
              let next: number | null = null;
              const limit = region.end - MIN_UPPER_WIDTH_IN;
              for (let cursor = along + 1; cursor <= limit + COLLISION_EPSILON_IN && next == null; cursor += 1) {
                for (const width of widths) {
                  if (width > region.end - cursor + COLLISION_EPSILON_IN) continue;
                  if (baysOn(seam.wall).some((bay) => cursor < bay.end - COLLISION_EPSILON_IN && cursor + width > bay.start + COLLISION_EPSILON_IN)) continue;
                  const source = standard.find((row) => Math.abs(dim(row.width, 0) - width) <= COLLISION_EPSILON_IN);
                  if (!source) continue;
                  const candidate = makeCandidate(source);
                  const spot = wallPlacementAt(cursor, candidate.width, candidate.depth, seam.wall as never, room);
                  if (spot && upperFits({ ...candidate, ...spot }, working)) { next = cursor; break; }
                }
              }
              if (next == null || next <= along + COLLISION_EPSILON_IN) break;
              along = next;
            }
          }
          remainder = Math.max(0, region.end - along);
        }
        if (remainder >= SEAM_MIN_IN && remainder <= autoDesignFillerMaxIn() + COLLISION_EPSILON_IN && allowFiller) {
          const fromRight = leftNeighbor == null && rightNeighbor != null && placedHere.length > 0;
          const start = placedHere.length ? (fromRight ? region.start : along) : region.start;
          const end = start + remainder;
          const lastPlaced = placedHere[placedHere.length - 1] ?? null;
          const pseudo: AutoDesignSeam = {
            wall: seam.wall, start, end,
            left: fromRight ? leftNeighbor : (lastPlaced ?? leftNeighbor),
            right: fromRight ? (placedHere[0] ?? rightNeighbor) : rightNeighbor,
          };
          const made = fillersForSeam({ seam: pseudo, layer: "wall", fillers, room, makeUid: input.makeUid, styleId: input.styleId });
          if (!("error" in made)) {
            const accepted = appendCollisionFreePlacements(working, made.pieces, room);
            if (accepted.rejected.length === 0) { working = accepted.placed; additions.push(...made.pieces); }
          } else if (!/no neighboring cabinet/.test(made.error)) {
            skipped.push(made.error);
          }
        }
      }
    }
  }
  // Owner rule: the uppers line up with the bases beneath them. The run tiles
  // over each lower already (an atomic projection per cabinet, a corner leg on
  // both of the corner's walls), and this last pass is the one gate:
  //   - a wall cabinet with no floor coverage under it is a stray and is dropped;
  //   - an opening left in a run that has counter below it is closed with real
  //     wall cabinets of the selected line, never filler, and never inside a
  //     deliberate bay (the range, a sink window, the refrigerator).
  if (input.alignToBaseRuns !== false) {
    working = alignUpperRunsToBases({
      placed: working,
      additions,
      room,
      openings,
      catalog: input.catalog,
      standard,
      height,
      styleId: input.styleId,
      makeUid: input.makeUid,
      skipped,
      upperFits,
      blockedBays,
    });
  } else {
    working = dropUppersOutsideRun({ placed: working, additions, room, skipped });
  }
  // A wall blind corner exposes the door away from its blind side.
  working = assignBlindCornerDoorSides(working, room);
  const uids = new Set(additions.map((item) => item.uid));
  return { placed: working, additions: working.filter((item) => uids.has(item.uid)), skipped, substitutions, heightUsedIn };
}

/**
 * Drop the wall cabinets that hang entirely over bare wall. They are the pieces
 * that read as an upper run that does not line up with the bases below it. The
 * removal is reported, never silent.
 */
function dropUppersOutsideRun(input: {
  placed: PlacedCabinet[];
  additions: PlacedCabinet[];
  room: RoomData;
  skipped: string[];
}): PlacedCabinet[] {
  const walls = Array.from(new Set(input.placed
    .filter((item) => item.placement === "wall")
    .map((item) => cabinetWall(item, input.room))
    .filter(Boolean)));
  const strays = new Set<string>();
  for (const wall of walls) {
    for (const item of uppersOutsideRun({ placed: input.placed, room: input.room, wallId: wall })) {
      if (/filler|scribe/i.test(`${item.masterCode} ${item.description ?? ""}`) || item.fillerPieceGroupId) continue;
      strays.add(item.uid);
    }
  }
  if (!strays.size) return input.placed;
  for (const uid of Array.from(strays)) {
    const item = input.placed.find((entry) => entry.uid === uid);
    if (!item) continue;
    input.skipped.push(`${item.masterCode}: left off because no base cabinet, corner or tall box stands under it.`);
  }
  for (let index = input.additions.length - 1; index >= 0; index -= 1) {
    if (strays.has(input.additions[index]!.uid)) input.additions.splice(index, 1);
  }
  return input.placed.filter((item) => !strays.has(item.uid));
}

/**
 * Close every opening the owner rule forbids, with real wall cabinets of the
 * selected line. Returns the same list when there is nothing to close.
 */
function alignUpperRunsToBases(input: {
  placed: PlacedCabinet[];
  additions: PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  catalog: readonly DesignCabinet[];
  standard: readonly DesignCabinet[];
  height: number;
  styleId: number | null;
  makeUid: () => string;
  skipped: string[];
  /** The run's own gate: ceiling, opening clearance and collision. */
  upperFits: (candidate: PlacedCabinet, against: readonly PlacedCabinet[]) => boolean;
  /** Bays an aligned projection already refused. They are reported, never re-packed. */
  blockedBays?: ReadonlyMap<string, readonly UpperAlignmentSpan[]>;
}): PlacedCabinet[] {
  let working = dropUppersOutsideRun({ placed: input.placed, additions: input.additions, room: input.room, skipped: input.skipped });
  // Flat stock that hangs past the end of the base run reads as the same offset a
  // stray cabinet does, so it goes too. A filler inside the run is kept.
  const trimmed = trimWallFillersOutsideRun({ placed: working, room: input.room });
  if (trimmed.removed.length) {
    const removedUids = new Set(trimmed.removed.map((item) => item.uid));
    for (let index = input.additions.length - 1; index >= 0; index -= 1) {
      if (removedUids.has(input.additions[index]!.uid)) input.additions.splice(index, 1);
    }
    working = trimmed.placed;
  }
  const walls = Array.from(new Set(working
    .filter((item) => item.placement === "wall" || item.placement === "base" || item.placement === "appliance" || item.placement === "tall")
    .map((item) => cabinetWall(item, input.room))
    .filter(Boolean)));
  for (const wall of walls) {
    if (!input.standard.length) break;
    for (let guard = 0; guard < 8; guard += 1) {
      const gaps = upperCoverageGaps({
        placed: working,
        room: input.room,
        wallId: wall,
        openings: input.openings,
        reserved: input.blockedBays?.get(wall) ?? [],
      });
      const gap = gaps[0];
      if (!gap) break;
      const filled = fillUpperGap({
        placed: working,
        additions: input.additions,
        room: input.room,
        wallId: wall,
        gap,
        standard: input.standard,
        height: input.height,
        styleId: input.styleId,
        makeUid: input.makeUid,
        upperFits: input.upperFits,
      });
      if (!filled) {
        input.skipped.push(`${formatInches(gap.end - gap.start)} of upper run on ${wall} has counter below it, and no wall cabinet in this line closes it.`);
        break;
      }
      working = filled;
    }
  }
  return working;
}

/** Seat real wall cabinets across one forbidden opening, widest first. Returns null when nothing fits. */
function fillUpperGap(input: {
  placed: PlacedCabinet[];
  additions: PlacedCabinet[];
  room: RoomData;
  wallId: string;
  gap: UpperAlignmentSpan;
  standard: readonly DesignCabinet[];
  height: number;
  styleId: number | null;
  makeUid: () => string;
  upperFits: (candidate: PlacedCabinet, against: readonly PlacedCabinet[]) => boolean;
}): PlacedCabinet[] | null {
  let working = [...input.placed];
  const widths = input.standard.map((row) => dim(row.width, 0)).filter((width) => width > 0);
  let along = input.gap.start;
  let seated = 0;
  for (let guard = 0; guard < 12; guard += 1) {
    const remain = input.gap.end - along;
    if (remain < MIN_UPPER_WIDTH_IN - COLLISION_EPSILON_IN) break;
    const cover = coverCatalogSpan(remain, widths, autoDesignFillerMaxIn());
    const candidates = Array.from(new Set([...(cover.widths[0] != null ? [cover.widths[0]] : []),
      ...widths.filter((width) => width <= remain + COLLISION_EPSILON_IN).sort((a, b) => b - a)]));
    let placedOne = false;
    for (const width of candidates) {
      const source = input.standard.find((row) => Math.abs(dim(row.width, 0) - width) <= COLLISION_EPSILON_IN);
      if (!source) continue;
      const spot = wallPlacementAt(along, width, footprintDepth(source), input.wallId as never, input.room);
      if (!spot) continue;
      const candidate: PlacedCabinet = {
        uid: input.makeUid(), cabinetId: source.id, masterCode: source.masterCode, description: source.description,
        category: source.category, subCategory: source.subCategory, placement: "wall",
        ...spot,
        width,
        depth: footprintDepth(source),
        height: input.height,
        mountBottom: ordinaryWallMountBottom({ ...source, height: input.height }),
        numberOfDoors: source.numberOfDoors,
        numberOfDrawers: source.numberOfDrawers,
        catalogImageUrl: source.catalogImageUrl ?? null,
        styleId: input.styleId,
      } as PlacedCabinet;
      if (!input.upperFits(candidate, working)) continue;
      const accepted = appendCollisionFreePlacements(working, [candidate], input.room);
      if (accepted.rejected.length > 0) continue;
      working = accepted.placed;
      input.additions.push(candidate);
      along += width;
      seated += 1;
      placedOne = true;
      break;
    }
    if (!placedOne) break;
  }
  return seated > 0 ? working : null;
}

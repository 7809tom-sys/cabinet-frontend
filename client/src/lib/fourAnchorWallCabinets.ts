import { autoFillSpan } from "./autofill";
import {
  SEAM_MIN_IN, findFourAnchorSeams, fillersForSeam, intersectWithCoverage, lowerCoverageOnWall, upperReservedZones,
  type FourAnchorSeam,
} from "./fourAnchorSeamFillers";
import { buildRequiredBlindCornerFiller, requiresConfiguredBlindCornerFiller } from "./blindCornerRequiredFiller";
import { cabinetDrawingType, isWallBlindCornerCabinet } from "./cabinetGraphics";
import type { CatalogFillerCandidate } from "./catalogFiller";
import {
  COLLISION_EPSILON_IN, WALL_OPENING_CLEARANCE_IN, appendCollisionFreePlacements,
  cabinetPlacementCollisionDetail, cabinetWall, dim, footprintDepth, formatInches, freeSegmentsOnWall,
  isBaseBlindCorner, isCornerCabinet, isPanelItem, isRangeOrOven, isRefrigerator, isSinkBaseCabinet, normalizeBlindCornerDoorSides,
  ordinaryWallMountBottom, wallCeilingMin, wallPlacementAt, wallRunCornerPlacement, wallRunFrame, wallRunJoinAt, wallRunOffset,
  wallRunSpan, type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening, type WallRunFrame,
} from "./design";

export type FourAnchorUpperCorner = {
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
    && !NOT_A_STRAIGHT_UPPER.test(`${source.masterCode} ${source.description} ${source.subCategory ?? ""}`);
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


/** Standard wall cabinets are sold in 3-inch width steps; a gap smaller than one step cannot be tiled. */
const WALL_WIDTH_STEP_IN = 3;
const MIN_UPPER_WIDTH_IN = 9;
/** The corner cabinet a Four-anchor blind corner gets: a plain 12-inch-wide upper in the corner square. */
export const FOUR_ANCHOR_CORNER_UPPER_WIDTH_IN = 12;

/**
 * A window over the sink owns the wall above it: no upper is ever placed there,
 * and the neighbours stop 3 inches short of it. A window only counts as a sink
 * window when a sink base sits on the same wall under it.
 */
function sinkWindowZones(placed: readonly PlacedCabinet[], openings: readonly WallOpening[], room: RoomData, wall: string): { s: number; e: number }[] {
  const sinks = placed.filter((item) => item.placement === "base" && isSinkBaseCabinet(item) && cabinetWall(item, room) === wall);
  return openings
    .filter((opening) => opening.kind === "window" && opening.side === wall
      && sinks.some((sink) => {
        const start = wallRunOffset(sink, wall, room);
        const end = start + wallRunSpan(sink, wall, room);
        return start < opening.offset + opening.width - COLLISION_EPSILON_IN && end > opening.offset + COLLISION_EPSILON_IN;
      }))
    .map((opening) => ({ s: opening.offset - WALL_OPENING_CLEARANCE_IN, e: opening.offset + opening.width + WALL_OPENING_CLEARANCE_IN }));
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
export function buildFourAnchorWallCabinets(input: {
  placed: PlacedCabinet[];
  room: RoomData;
  openings: WallOpening[];
  catalog: DesignCabinet[];
  wallCabinetHeightIn: 30 | 36 | 42;
  styleId: number | null;
  makeUid: () => string;
  corners?: FourAnchorUpperCorner[];
  /** Selected-line fillers; required for a wall blind corner's integrated 3″ face filler. */
  catalogFillers?: readonly CatalogFillerCandidate[];
  /**
   * Close every remaining opening in the upper layer above the lower cabinets with real
   * wall cabinets and catalog filler. Never fills over the range, the sink or its window,
   * or the refrigerator assembly. Off by default so standalone callers keep exact behavior.
   */
  closeSeams?: boolean;
}): {
  placed: PlacedCabinet[];
  additions: PlacedCabinet[];
  skipped: string[];
  /** The real catalog height used (for example 30.25 for a requested 30). Null when the line has none. */
  heightUsedIn: number | null;
} {
  const { room, openings } = input;
  let working = [...input.placed];
  const additions: PlacedCabinet[] = [];
  const skipped: string[] = [];
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
    return { placed: working, additions, skipped, heightUsedIn };
  }
  const height = heightUsedIn;
  const eligible = input.catalog.filter((source) => source.id > 0
    && source.placement === "wall" && Math.abs(dim(source.height, 0) - height) <= SAME_HEIGHT_IN
    && dim(source.width, 0) > 0 && dim(source.depth, 0) > 0);
  const standard = eligible.filter(isStraightStandardUpper);
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
    styleId: input.styleId,
  });
  const commit = (candidate: PlacedCabinet): boolean => {
    const bottom = candidate.mountBottom ?? 54;
    const wall = cabinetWall(candidate, room);
    if (bottom + height > wallCeilingMin(room, wall) + COLLISION_EPSILON_IN) return false;
    const start = wallRunOffset(candidate, wall, room);
    const span = wallRunSpan(candidate, wall, room);
    const fits = freeSegmentsOnWall(wall, room, working, openings, span, WALL_OPENING_CLEARANCE_IN,
      "wall", true, candidate, candidate.depth).some((segment) => start >= segment.start - COLLISION_EPSILON_IN
        && start + span <= segment.start + segment.length + COLLISION_EPSILON_IN);
    if (!fits || cabinetPlacementCollisionDetail(candidate, working, room)) return false;
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
        // The room corner gets a plain 12-inch-wide upper (the 12-inch-deep uppers
        // from both walls leave a 12 x 12 square there), then real uppers tile the
        // rest of the blind base's run. A line without a 12-inch upper falls back
        // to a wall blind corner at the same vertex.
        const twelve = standard.find((row) => Math.abs(dim(row.width, 0) - FOUR_ANCHOR_CORNER_UPPER_WIDTH_IN) <= COLLISION_EPSILON_IN);
        if (twelve) {
          const candidate = makeCandidate(twelve);
          const spot = wallRunCornerPlacement(candidate, frame, at, room);
          const snapshot = working;
          const addedBefore = additions.length;
          if (spot && commit({ ...candidate, ...spot })) {
            const seatedTwelve = additions[additions.length - 1]!;
            const wall = cabinetWall(seatedTwelve, room);
            const baseWall = cabinetWall(base, room);
            const from = wallRunOffset(seatedTwelve, wall, room) + wallRunSpan(seatedTwelve, wall, room);
            const to = baseWall === wall ? wallRunOffset(base, wall, room) + wallRunSpan(base, wall, room) : from;
            const length = to - from;
            let ok = true;
            if (length >= MIN_UPPER_WIDTH_IN - COLLISION_EPSILON_IN) {
              const tiled = autoFillSpan(length, "kitchen", standard.map((row) => ({ ...row, placement: "base" as const })), { strategy: "largest-first" });
              const sources = (Array.isArray(tiled) ? tiled : tiled.items.filter((item) => !item.isFiller)
                .map((item) => standard.find((row) => row.id === item.cabinet.id)!))
                .filter((row): row is DesignCabinet => row != null);
              const covered = sources.reduce((sum, row) => sum + dim(row.width, 0), 0);
              if (!sources.length || length - covered > WALL_WIDTH_STEP_IN + COLLISION_EPSILON_IN || covered > length + COLLISION_EPSILON_IN) {
                ok = false;
              } else {
                let along = from;
                for (const row of sources) {
                  const next = makeCandidate(row);
                  const nextSpot = wallPlacementAt(along, next.width, next.depth, wall, room);
                  if (!commit({ ...next, ...nextSpot })) { ok = false; break; }
                  along += next.width;
                }
              }
            }
            if (!ok) {
              // Keep the 12-inch corner box; the rest of the blind base's run needs a manual look.
              working = snapshot; additions.splice(addedBefore);
              if (spot && commit({ ...candidate, ...spot })) {
                skipped.push(`${base.masterCode} corner: the 12″ corner upper was placed, but the rest of the blind base's run could not be matched exactly with real uppers.`);
              }
            }
            placed = additions.length > addedBefore;
          }
        }
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
          placed = true;
          break;
        }
      } else {
        for (const source of corners.filter((row) => dim(row.width, 0) <= base.width + COLLISION_EPSILON_IN)) {
          const candidate = makeCandidate(source);
          const spot = wallRunCornerPlacement(candidate, frame, at, room);
          if (spot && commit({ ...candidate, ...spot })) {
            placed = true;
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
              const twelve = standard.find((row) => Math.abs(dim(row.width, 0) - FOUR_ANCHOR_CORNER_UPPER_WIDTH_IN) <= COLLISION_EPSILON_IN);
              const pieces: DesignCabinet[] = [];
              let remaining = room12;
              if (twelve && remaining >= FOUR_ANCHOR_CORNER_UPPER_WIDTH_IN - COLLISION_EPSILON_IN) {
                pieces.push(twelve);
                remaining -= FOUR_ANCHOR_CORNER_UPPER_WIDTH_IN;
              }
              if (remaining >= MIN_UPPER_WIDTH_IN - COLLISION_EPSILON_IN) {
                const tiled = autoFillSpan(remaining, "kitchen", standard.map((row) => ({ ...row, placement: "base" as const })), { strategy: "largest-first" });
                const more = (Array.isArray(tiled) ? tiled : tiled.items.filter((item) => !item.isFiller)
                  .map((item) => standard.find((row) => row.id === item.cabinet.id)!))
                  .filter((row): row is DesignCabinet => row != null);
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
    // Above the sink there is either the measured window or nothing at all.
    if (lower.placement === "base" && isSinkBaseCabinet(lower)) continue;
    if (isRefrigerator(lower) || isRangeOrOven(lower.masterCode, lower.description)
      || isCornerCabinet(lower.masterCode, lower.description) || isPanelItem(lower)
      || /filler|scribe/i.test(`${lower.masterCode} ${lower.description} ${lower.subCategory ?? ""}`)) continue;
    if (lower.placement === "appliance" && !/^DW[-_]?/i.test(lower.masterCode)) continue;
    const wall = cabinetWall(lower, room);
    const lowerStart = wallRunOffset(lower, wall, room);
    const lowerSpan = wallRunSpan(lower, wall, room);
    // Beside a sink window the upper stops 3 inches short of the window, so only
    // the clear remainder of this lower's run is covered. Everywhere else the
    // whole run is one atomic projection, exactly as before.
    const zones = sinkWindowZones(input.placed, openings, room, wall);
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
      const exact = standard.find((source) => Math.abs(dim(source.width, 0) - piece.span) <= COLLISION_EPSILON_IN);
      // When a single same-width SKU is unavailable, use real smaller upper boxes
      // only if together they span the piece exactly. Never stretch a box or invent a SKU.
      const tiled = exact ? [exact] : autoFillSpan(piece.span, "kitchen",
        standard.map((row) => ({ ...row, placement: "base" as const })), { strategy: "largest-first" });
      const sources = Array.isArray(tiled) ? tiled : tiled.items.filter((item) => !item.isFiller)
        .map((item) => standard.find((row) => row.id === item.cabinet.id)!);
      if (!sources.length || Math.abs(sources.reduce((sum, source) => sum + dim(source.width, 0), 0) - piece.span) > COLLISION_EPSILON_IN) {
        working = before;
        additions.splice(addedBefore);
        skipped.push(`${lower.masterCode}: no source-sized ${height}″ wall cabinet matches its ${piece.span}″ run.`);
        complete = true;
        break;
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
      skipped.push(`${lower.masterCode}: aligned upper needs review for an opening, corner, occupied bay, or ceiling clearance.`);
    }
  }
  if (input.closeSeams) {
    const reserved = upperReservedZones(input.placed, room);
    const seams = findFourAnchorSeams({
      layer: "wall", placed: working, room, openings, corners: (input.corners ?? []).map((entry) => entry.point), reservedZones: reserved,
    });
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
          const tiled = autoFillSpan(length, "kitchen", standard.map((row) => ({ ...row, placement: "base" as const })), { strategy: "largest-first" });
          const sources = tiled.items.filter((item) => !item.isFiller).map((item) => standard.find((row) => row.id === item.cabinet.id)).filter((row): row is DesignCabinet => row != null);
          const fromRight = leftNeighbor == null && rightNeighbor != null;
          const ordered = fromRight ? [...sources].reverse() : sources;
          const total = ordered.reduce((sum, row) => sum + dim(row.width, 0), 0);
          if (fromRight) along = region.end - total;
          for (const source of ordered) {
            const candidate = makeCandidate(source);
            const spot = wallPlacementAt(along, candidate.width, candidate.depth, seam.wall as never, room);
            if (spot && commit({ ...candidate, ...spot })) { placedHere.push(additions[additions.length - 1]!); along += candidate.width; }
            else break;
          }
          const used = placedHere.reduce((sum, item) => sum + item.width, 0);
          remainder = length - used;
          if (fromRight) { along = region.start; } 
        }
        if (remainder >= SEAM_MIN_IN) {
          const fromRight = leftNeighbor == null && rightNeighbor != null && placedHere.length > 0;
          const start = placedHere.length ? (fromRight ? region.start : along) : region.start;
          const end = start + remainder;
          const lastPlaced = placedHere[placedHere.length - 1] ?? null;
          const pseudo: FourAnchorSeam = {
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
  // A wall blind corner exposes the door away from its blind side.
  working = normalizeBlindCornerDoorSides(working, room);
  const uids = new Set(additions.map((item) => item.uid));
  return { placed: working, additions: working.filter((item) => uids.has(item.uid)), skipped, heightUsedIn };
}

/**
 * Tom, Nov 20 2026, 4:39 PM CT: leftover space slides the run toward the inside
 * corner. Cabinets close up against the corner cabinet (or a reserved /
 * geometric corner) and the leftover ends at the refrigerator or a free wall
 * end — never between cabinets and never at the corner.
 *
 * applyMinimumFiller only rewrites the four cardinal walls, and its range slide
 * only moves the range itself, so a trailing drawer can stay off the corner or
 * leftover can sit between the range and the last base. This pass packs every
 * run wall, including custom Wall Builder ids.
 */
import {
  cabinetWall,
  isCornerCabinet,
  isFillerItem,
  isPanelItem,
  isRangeOrOven,
  isRefrigerator,
  isSinkBaseCabinet,
  isStacker,
  placedFootprint,
  wallRunFrame,
  wallRunJoinAt,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";
import { fortyFiveCornerSeat } from "./autoDesignFortyFiveCornerSeat";
import { isProtectedCornerFiller } from "./autoDesignFillerConsolidation";
import { isDishwasherItem } from "./dishwasherPanelRule";
import { catalogFillerForGap, fittedCatalogFillerDescription, type CatalogFillerCandidate } from "./catalogFiller";
import { formatFillerInches } from "./autoDesignFillerConsolidation";

const EPS = 0.125;

export type SlideRunsToCornerMove = { uid: string; deltaAlongIn: number };

export type SlideRunsToCornerResult = {
  placed: PlacedCabinet[];
  notes: string[];
  moves: SlideRunsToCornerMove[];
};

function isUpperLevel(p: PlacedCabinet): boolean {
  return p.placement === "wall" || (p.placement === "appliance" && (Number(p.mountBottom) || 0) > 30);
}

function isFridgeBody(p: PlacedCabinet): boolean {
  return isRefrigerator(p) && !isPanelItem(p);
}

function isCornerItem(p: PlacedCabinet): boolean {
  return isCornerCabinet(p.masterCode, p.description, p.cornerType);
}

/** An inside 90° or 45° corner is the end the run packs toward. */
export function isInsideCornerEnd(
  wallId: string,
  at: "start" | "end",
  room: RoomData,
  runWallIds?: readonly string[],
): boolean {
  if (fortyFiveCornerSeat(room, wallId, at, "base") != null || fortyFiveCornerSeat(room, wallId, at, "wall") != null) return true;
  const frame = wallRunFrame(wallId, room);
  if (!frame) return false;
  const join = wallRunJoinAt(frame, at, room);
  if (!join) return false;
  const turn = Math.abs(join.turnDeg);
  if (Math.abs(turn - 90) > 0.5 && Math.abs(turn - 45) > 0.5 && Math.abs(turn - 135) > 0.5) return false;
  // A rectangular room has a 90° join at every wall end. Only a join with another
  // cabinet-run wall (or a 45° seat above) is an inside corner of the run.
  if (runWallIds && runWallIds.length > 0) return runWallIds.includes(join.frame.id);
  return false;
}

function spanOnWall(p: PlacedCabinet, wallId: string, room: RoomData): { start: number; end: number } | null {
  const own = cabinetWall(p, room);
  if (own === wallId) {
    const start = wallRunOffset(p, wallId, room);
    const width = wallRunSpan(p, wallId, room);
    if (width <= 0.01) return null;
    return { start, end: start + width };
  }
  if (!isCornerItem(p)) return null;
  const frame = wallRunFrame(wallId, room);
  if (!frame) return null;
  const fp = placedFootprint(p);
  const corners = [
    { x: p.x, y: p.y },
    { x: p.x + fp.w, y: p.y },
    { x: p.x, y: p.y + fp.d },
    { x: p.x + fp.w, y: p.y + fp.d },
  ];
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of corners) {
    const along = (c.x - frame.start.x) * frame.tangent.x + (c.y - frame.start.y) * frame.tangent.y;
    lo = Math.min(lo, along);
    hi = Math.max(hi, along);
  }
  const start = Math.max(frame.runStart, lo);
  const end = Math.min(frame.runEnd, hi);
  if (end - start < 1) return null;
  return { start, end };
}

function shiftItem(
  p: PlacedCabinet,
  delta: number,
  frame: NonNullable<ReturnType<typeof wallRunFrame>>,
): PlacedCabinet {
  const next: PlacedCabinet = {
    ...p,
    x: p.x + frame.tangent.x * delta,
    y: p.y + frame.tangent.y * delta,
  };
  if (typeof p.wallOffset === "number") next.wallOffset = p.wallOffset + delta;
  return next;
}

function isLockedAnchor(p: PlacedCabinet): boolean {
  if (isFridgeBody(p)) return true;
  if (isSinkBaseCabinet(p)) return true;
  if (isDishwasherItem(p)) return true;
  if (isCornerItem(p)) return true;
  if (p.refrigeratorAssemblyRole || p.refrigeratorAssemblyId) return true;
  return false;
}

function isRangeOrOverIt(p: PlacedCabinet, rangeUids: ReadonlySet<string>): boolean {
  return rangeUids.has(p.uid);
}

function rangeGroupUids(placed: readonly PlacedCabinet[], room: RoomData, wallId: string): Set<string> {
  const uids = new Set<string>();
  for (const range of placed) {
    if (range.placement !== "appliance" || isUpperLevel(range) || !isRangeOrOven(range.masterCode, range.description)) continue;
    if (cabinetWall(range, room) !== wallId) continue;
    const span = spanOnWall(range, wallId, room);
    if (!span) continue;
    uids.add(range.uid);
    for (const p of placed) {
      if (p.uid === range.uid || cabinetWall(p, room) !== wallId || !isUpperLevel(p)) continue;
      const s = spanOnWall(p, wallId, room);
      if (!s) continue;
      const over = s.start >= span.start - 0.5 && s.end <= span.end + 0.5;
      if (over && (p.overRangeMicrowaveBridge === true || /^HOOD|^MW/i.test(p.masterCode ?? "") || p.placement === "appliance" || /bridge/i.test(p.subCategory ?? ""))) {
        uids.add(p.uid);
      }
    }
  }
  return uids;
}

function cornerStopIn(
  wallId: string,
  at: "start" | "end",
  layer: "base" | "wall",
  room: RoomData,
  placed: readonly PlacedCabinet[],
  reservedSpans: ReadonlyArray<{ wallId: string; start: number; end: number }>,
): number | null {
  const frame = wallRunFrame(wallId, room);
  if (!frame) return null;
  const geometric = at === "start" ? Math.max(0, frame.runStart) : frame.runEnd;
  const seat = fortyFiveCornerSeat(room, wallId, at, layer === "wall" ? "wall" : "base");
  if (seat) return at === "start" ? seat.end : seat.start;
  let stop = geometric;
  let foundCabinet = false;
  for (const p of placed) {
    if (!isCornerItem(p)) continue;
    const kind = layerOf(p);
    if (kind !== "both" && kind !== layer) continue;
    const span = spanOnWall(p, wallId, room);
    if (!span) continue;
    if (at === "end" && span.end > geometric - 24 - 1 && span.start < geometric + 1) {
      stop = Math.min(stop, span.start);
      foundCabinet = true;
    }
    if (at === "start" && span.start < geometric + 24 + 1 && span.end > geometric - 1) {
      stop = Math.max(stop, span.end);
      foundCabinet = true;
    }
  }
  if (foundCabinet) return stop;
  const reserved = reservedSpans.filter((span) => span.wallId === wallId);
  const reservation = at === "end"
    ? reserved.find((span) => Math.abs(span.end - geometric) <= 1)
    : reserved.find((span) => Math.abs(span.start - geometric) <= 1);
  // Honor an empty reservation (a 24″ DCW void still waiting to be seated).
  // A 27″ economy-corner keep-clear is not a pack stop once the 3″ filler
  // and its neighboring cabinets already occupy that end.
  if (reservation) {
    const occupied = placed.some((p) => {
      if (isFridgeBody(p) || isRangeOrOven(p.masterCode, p.description)) return false;
      const span = spanOnWall(p, wallId, room);
      if (!span) return false;
      const kind = layerOf(p);
      if (kind !== layer && kind !== "both") return false;
      return span.start < reservation.end - 0.05 && span.end > reservation.start + 0.05;
    });
    if (!occupied) return at === "start" ? reservation.end : reservation.start;
  }
  return stop;
}

function layerOf(p: PlacedCabinet): "base" | "wall" | "both" {
  if (p.placement === "tall" || (isPanelItem(p) && (Number(p.height) || 0) > 40)) return "both";
  return isUpperLevel(p) ? "wall" : "base";
}


/** Width of the pieces sitting between `from` and `to` on one layer, not including the range group. */
function occupiedBetween(
  placed: readonly PlacedCabinet[],
  wallId: string,
  room: RoomData,
  layer: "base" | "wall",
  from: number,
  to: number,
  rangeUids: ReadonlySet<string>,
): number {
  let width = 0;
  for (const p of placed) {
    if (rangeUids.has(p.uid) || isFridgeBody(p) || isCornerItem(p)) continue;
    const kind = layerOf(p);
    if (kind !== layer && !(kind === "both" && layer === "base")) continue;
    const span = spanOnWall(p, wallId, room);
    if (!span) continue;
    const lo = Math.max(span.start, from);
    const hi = Math.min(span.end, to);
    if (hi - lo > 0.01) width += hi - lo;
  }
  return width;
}

/**
 * Pack base and wall runs on each wall toward an inside corner. Leftover is
 * left at the opposite end (the refrigerator or a free wall end). Unprotected
 * leftover fillers are picked up and reseated in that leftover, when a catalog
 * board covers it.
 */
export function slideRunsTowardInsideCorners(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  wallIds: readonly string[];
  openings?: readonly WallOpening[];
  reservedSpans?: ReadonlyArray<{ wallId: string; start: number; end: number }>;
  rangeWiggleIn?: (range: PlacedCabinet) => number;
  fillerCatalog?: readonly CatalogFillerCandidate[];
  styleId?: number | null;
  makeUid?: () => string;
  wallLabelOf?: (wallId: string) => string | null | undefined;
}): SlideRunsToCornerResult {
  const room = input.room;
  const reserved = input.reservedSpans ?? [];
  const notes: string[] = [];
  const moves: SlideRunsToCornerMove[] = [];
  let working: PlacedCabinet[] = [...input.placed];

  for (const wallId of input.wallIds) {
    const frame = wallRunFrame(wallId, room);
    if (!frame) continue;
    const startIsCorner = isInsideCornerEnd(wallId, "start", room, input.wallIds);
    const endIsCorner = isInsideCornerEnd(wallId, "end", room, input.wallIds);
    if (startIsCorner === endIsCorner) continue; // neither, or both (a U-leg with two corners: leave alone)
    const at: "start" | "end" = endIsCorner ? "end" : "start";
    const label = input.wallLabelOf?.(wallId) ?? wallId;
    const rangeUids = rangeGroupUids(working, room, wallId);
    const range = working.find((p) => rangeUids.has(p.uid) && p.placement === "appliance" && !isUpperLevel(p) && isRangeOrOven(p.masterCode, p.description));
    const wiggle = range ? Math.max(0, Math.min(3, input.rangeWiggleIn?.(range) ?? 3)) : 0;

    for (const layer of ["base", "wall"] as const) {
      let stop = cornerStopIn(wallId, at, layer, room, working, reserved);
      if (stop == null) continue;
      for (const p of working) {
        if (!isFillerItem(p) || isPanelItem(p)) continue;
        const kind = layerOf(p);
        if (kind !== layer && kind !== "both") continue;
        if (cabinetWall(p, room) !== wallId && !isProtectedCornerFiller(p, working, room)) continue;
        const span = spanOnWall(p, wallId, room);
        if (!span) continue;
        if (at === "end" && Math.abs(span.end - stop) <= 1) stop = Math.min(stop, span.start);
        if (at === "start" && Math.abs(span.start - stop) <= 1) stop = Math.max(stop, span.end);
      }
      const openingSpans = (input.openings ?? [])
        .filter((opening) => opening.side === wallId)
        .map((opening) => ({ start: opening.offset, end: opening.offset + opening.width }));

      type Piece = { item: PlacedCabinet; start: number; end: number };
      const onLayer = (p: PlacedCabinet) => {
        const layerKind = layerOf(p);
        // Tall refrigerator panels travel with the base pack once; packing them
        // again on the wall layer dropped them onto the range.
        if (layerKind === "both") return layer === "base";
        return layerKind === layer;
      };
      const pieces: Piece[] = [];
      const dropUids = new Set<string>();
      for (const p of working) {
        if (!onLayer(p)) continue;
        if (layer === "base" && isUpperLevel(p)) continue;
        const span = spanOnWall(p, wallId, room);
        if (!span) continue;
        if (cabinetWall(p, room) !== wallId && isCornerItem(p)) continue; // stop edge only, already in cornerStopIn
        if (isFillerItem(p) && !isPanelItem(p) && !isProtectedCornerFiller(p, working, room)) {
          const atCorner = at === "end" ? Math.abs(span.end - stop) <= 0.25 : Math.abs(span.start - stop) <= 0.25;
          if (atCorner) continue; // keep a 3″ economy / corner-seat board
          // Keep a strip already at the fridge or the free wall end; only pick up
          // leftover that still sits toward the corner or between cabinets.
          const hasCabinetTowardHome = at === "end"
            ? working.some((q) => {
              const qs = spanOnWall(q, wallId, room);
              if (!qs || isFillerItem(q) || isFridgeBody(q) || isPanelItem(q) || isCornerItem(q)) return false;
              const qLayer = layerOf(q);
              if (qLayer !== layer && qLayer !== "both") return false;
              return qs.end <= span.start + 0.05 && qs.start >= Math.max(0, frame.runStart) - 0.05;
            })
            : working.some((q) => {
              const qs = spanOnWall(q, wallId, room);
              if (!qs || isFillerItem(q) || isFridgeBody(q) || isPanelItem(q) || isCornerItem(q)) return false;
              const qLayer = layerOf(q);
              if (qLayer !== layer && qLayer !== "both") return false;
              return qs.start >= span.end - 0.05 && qs.end <= frame.runEnd + 0.05;
            });
          if (!hasCabinetTowardHome) continue; // already at the home end
          dropUids.add(p.uid);
          continue;
        }
        if (isStacker(p)) continue; // moved with its parent below
        pieces.push({ item: p, start: span.start, end: span.end });
      }
      pieces.sort((a, b) => a.start - b.start || a.end - b.end);
      if (pieces.length === 0 && dropUids.size === 0) continue;
      const runPieces = pieces.filter((e) => !isCornerItem(e.item));
      const nearestToCorner = at === "end" ? runPieces[runPieces.length - 1] : runPieces[0];
      const alreadyFlush = Boolean(
        nearestToCorner
        && (at === "end" ? Math.abs(nearestToCorner.end - stop) <= EPS : Math.abs(nearestToCorner.start - stop) <= EPS),
      );
      // A cabinet-sized opening next to a seated corner cabinet is left for the
      // economy-corner / DCW-flank passes that run after this one.
      const cornerOpening = nearestToCorner
        ? (at === "end" ? stop - nearestToCorner.end : nearestToCorner.start - stop)
        : 0;
      if (cornerOpening >= 9) continue;

      const deltas = new Map<string, number>();
      let cursor = stop;
      const walk = at === "end" ? [...pieces].reverse() : pieces;
      for (const piece of walk) {
        const width = piece.end - piece.start;
        if (isLockedAnchor(piece.item) && !isRangeOrOverIt(piece.item, rangeUids)) {
          cursor = at === "end" ? piece.start : piece.end;
          continue;
        }
        if (openingSpans.some((span) => piece.start < span.end - EPS && piece.end > span.start + EPS)) {
          cursor = at === "end" ? piece.start : piece.end;
          continue;
        }
        const fridgeSpan = pieces.find((e) => isFridgeBody(e.item));
        if (fridgeSpan && !isFridgeBody(piece.item) && !isPanelItem(piece.item) && !isFillerItem(piece.item)) {
          const overlap = Math.min(piece.end, fridgeSpan.end) - Math.max(piece.start, fridgeSpan.start);
          const overlapNeedsLock = overlap > Math.min(piece.end - piece.start, fridgeSpan.end - fridgeSpan.start) * 0.5;
          if (overlapNeedsLock) {
            cursor = at === "end" ? piece.start : piece.end;
            continue;
          }
        }
        if (isRangeOrOverIt(piece.item, rangeUids)) {
          // On the wall layer the overhead already moved with the range; treat
          // the group as a fixed block so neighboring uppers pack against it.
          if (layer === "wall" || piece.item.uid !== range?.uid) {
            cursor = at === "end" ? piece.start : piece.end;
            continue;
          }
          const desiredStart = at === "end" ? cursor - width : cursor;
          const raw = desiredStart - piece.start;
          const towardCorner = at === "end" ? Math.max(0, raw) : Math.min(0, raw);
          let applied = towardCorner > 0 ? Math.min(towardCorner, wiggle) : Math.max(towardCorner, -wiggle);
          if (Math.abs(applied) > 0.01) {
            const nextStart = piece.start + applied;
            const nextEnd = nextStart + width;
            // Pieces currently between the range and the corner have to fit in
            // the *new* span after the range slides; count from the current edge.
            const currentEdge = at === "end" ? piece.end : piece.start;
            const newEdge = at === "end" ? nextEnd : nextStart;
            const occupiedLo = Math.min(currentEdge, stop);
            const occupiedHi = Math.max(currentEdge, stop);
            const newLo = Math.min(newEdge, stop);
            const newHi = Math.max(newEdge, stop);
            const fits = (["base", "wall"] as const).every((checkLayer) => {
              const need = occupiedBetween(working, wallId, room, checkLayer, occupiedLo, occupiedHi, rangeUids);
              return need <= newHi - newLo + EPS;
            });
            if (!fits) applied = 0;
          }
          if (Math.abs(applied) > 0.01) {
            deltas.set(piece.item.uid, applied);
            for (const uid of rangeUids) if (uid !== piece.item.uid) deltas.set(uid, applied);
          }
          const nextStart = piece.start + (deltas.get(piece.item.uid) ?? 0);
          cursor = at === "end" ? nextStart : nextStart + width;
          continue;
        }
        const desiredStart = at === "end" ? cursor - width : cursor;
        const applied = desiredStart - piece.start;
        if (Math.abs(applied) > 0.01) deltas.set(piece.item.uid, applied);
        cursor = at === "end" ? desiredStart : desiredStart + width;
      }

      // Never pick up a leftover board if the cabinets on either side are not
      // sliding closed — that would leave an empty gap between cabinets.
      for (const uid of [...dropUids]) {
        const filler = working.find((item) => item.uid === uid);
        if (!filler) continue;
        const span = spanOnWall(filler, wallId, room);
        if (!span) continue;
        const left = pieces.filter((e) => e.end <= span.start + 0.05).sort((a, b) => b.end - a.end)[0];
        const right = pieces.filter((e) => e.start >= span.end - 0.05).sort((a, b) => a.start - b.start)[0];
        if (!left || !right) continue;
        const leftEnd = left.end + (deltas.get(left.item.uid) ?? 0);
        const rightStart = right.start + (deltas.get(right.item.uid) ?? 0);
        if (rightStart - leftEnd > EPS) dropUids.delete(uid);
      }

      if (deltas.size === 0 && dropUids.size === 0) continue;
      // If the run is already tight to the corner and leftover cannot pass the
      // range / another lock to the fridge or wall end, leave this layer alone
      // (a last-resort strip between a cabinet and the range stays put).
      const rangeDelta = range ? Math.abs(deltas.get(range.uid) ?? 0) : 0;
      if (alreadyFlush && rangeDelta <= 0.01) continue;

      const next: PlacedCabinet[] = [];
      const movedCodes: string[] = [];
      for (const p of working) {
        if (dropUids.has(p.uid)) continue;
        const delta = deltas.get(p.uid) ?? 0;
        if (Math.abs(delta) <= 0.01) {
          next.push(p);
          continue;
        }
        const shifted = shiftItem(p, delta, frame);
        next.push(shifted);
        moves.push({ uid: p.uid, deltaAlongIn: delta });
        if (!rangeUids.has(p.uid) || p.uid === range?.uid) movedCodes.push(`${p.masterCode} ${delta > 0 ? "+" : ""}${Math.round(delta * 8) / 8}″`);
        // Stackers on a moved parent travel with it.
        for (const child of working) {
          if (child.stackedOnCabinetUid !== p.uid || deltas.has(child.uid) || dropUids.has(child.uid)) continue;
          const already = next.find((item) => item.uid === child.uid);
          if (already) {
            const idx = next.findIndex((item) => item.uid === child.uid);
            next[idx] = shiftItem(child, delta, frame);
          }
          deltas.set(child.uid, delta);
        }
      }

      // Reseat one leftover filler at the leftover (home) end, if a catalog board covers it.
      const afterPieces = next
        .filter((p) => onLayer(p) || rangeUids.has(p.uid))
        .map((p) => {
          const span = spanOnWall(p, wallId, room);
          return span ? { p, ...span } : null;
        })
        .filter((entry): entry is { p: PlacedCabinet; start: number; end: number } => entry != null)
        .sort((a, b) => a.start - b.start);
      const homeIsStart = at === "end";
      const frameStart = Math.max(0, frame.runStart);
      const homeEdge = homeIsStart
        ? (afterPieces[0] ? afterPieces[0].start : frameStart)
        : (afterPieces[afterPieces.length - 1] ? afterPieces[afterPieces.length - 1].end : frame.runEnd);
      const leftoverStart = homeIsStart ? frameStart : homeEdge;
      const leftoverEnd = homeIsStart ? homeEdge : frame.runEnd;
      // If a fridge (or other lock) stands at the home end, leftover is the gap beside it.
      let gapStart = leftoverStart;
      let gapEnd = leftoverEnd;
      if (homeIsStart) {
        const lock = afterPieces.find((e) => isLockedAnchor(e.p) && !isRangeOrOverIt(e.p, rangeUids));
        if (lock) {
          gapStart = lock.end;
          gapEnd = afterPieces.find((e) => e.start >= lock.end - EPS && e.p.uid !== lock.p.uid)?.start ?? lock.end;
        }
      } else {
        const lock = [...afterPieces].reverse().find((e) => isLockedAnchor(e.p) && !isRangeOrOverIt(e.p, rangeUids));
        if (lock) {
          gapEnd = lock.start;
          const prev = [...afterPieces].reverse().find((e) => e.end <= lock.start + EPS && e.p.uid !== lock.p.uid);
          gapStart = prev?.end ?? lock.start;
        }
      }
      const leftover = Math.round(Math.max(0, gapEnd - gapStart) * 1000) / 1000;
      const alreadyFilled = afterPieces.some((e) => isFillerItem(e.p) && e.start < gapEnd - EPS && e.end > gapStart + EPS);
      const stock = leftover >= 0.125 && !alreadyFilled && input.fillerCatalog
        ? catalogFillerForGap(input.fillerCatalog.filter((row) => !/mou?ld/i.test(`${row.category ?? ""} ${row.subCategory ?? ""} ${row.description ?? ""}`)), leftover, layer)
        : null;
      if (stock && leftover >= 0.125) {
        const along = gapStart;
        const depth = layer === "wall" ? 12 : 24;
        const height = layer === "wall" ? 30 : 34.5;
        const filler: PlacedCabinet = {
          uid: input.makeUid?.() ?? `slide-corner-filler-${wallId}-${layer}`,
          cabinetId: stock.id,
          masterCode: stock.masterCode,
          description: fittedCatalogFillerDescription(stock, leftover),
          category: stock.category ?? "Filler",
          subCategory: stock.subCategory ?? "Filler",
          placement: layer,
          x: frame.start.x + frame.tangent.x * along + (layer === "wall" ? 0 : 0),
          y: frame.start.y + frame.tangent.y * along,
          width: leftover,
          depth,
          height,
          rotation: frame.facingRotation,
          wallId,
          wallOffset: along,
          styleId: input.styleId ?? null,
          fillerBillingRole: "primary",
          autoPlacedReason: `Slide run to corner (Tom, Nov 20 2026, 4:39 PM CT): ${formatFillerInches(leftover)} leftover kept at the refrigerator or free wall end on ${label}.`,
          fillerTotalWidth: leftover,
          numberOfDoors: 0,
          numberOfDrawers: 0,
        };
        // Nudge into the wall so the depth goes inward, matching existing placements on this wall.
        const neighbor = afterPieces[0]?.p ?? afterPieces[afterPieces.length - 1]?.p;
        if (neighbor && cabinetWall(neighbor, room) === wallId) {
          const nSpan = spanOnWall(neighbor, wallId, room);
          const inward = (Number(neighbor.depth) || depth);
          // Reuse the neighbor's inward offset: project neighbor origin relative to along, then add inward * (depth difference is already in neighbor x/y).
          if (nSpan) {
            const alongDelta = along - nSpan.start;
            filler.x = neighbor.x + frame.tangent.x * alongDelta;
            filler.y = neighbor.y + frame.tangent.y * alongDelta;
          } else {
            filler.x = frame.start.x + frame.tangent.x * along + frame.inward.x * 0;
            filler.y = frame.start.y + frame.tangent.y * along + frame.inward.y * 0;
          }
          void inward;
        }
        if (layer === "wall") filler.mountBottom = 54;
        next.push(filler);
      }

      const moved = movedCodes.length > 0 ? ` moved ${movedCodes.join(", ")}` : "";
      const dropped = dropUids.size > 0 ? ` and picked up leftover filler` : "";
      if (moved || dropped || (stock && leftover >= 0.125)) {
        notes.push(
          leftover >= 0.125
            ? `Slide to corner on ${label} (${layer} run): cabinets close against the inside corner; ${formatFillerInches(leftover)} leftover sits at the refrigerator or free wall end.${moved}${dropped}`
            : `Slide to corner on ${label} (${layer} run): cabinets close against the inside corner.${moved}${dropped}`,
        );
      }
      working = next;
    }
  }

  return { placed: working, notes, moves };
}

/**
 * End-of-build corner filler check, at EVERY recognized angle (PERMANENT / HIGH-PRIORITY).
 *
 * Tom, owner voice, Nov 24 2026:
 * - 12:38 PM CT: "Whenever a 45-degree turn is recognized, Auto Design puts plain F fillers on
 *   both sides automatically as part of the build, with no option and no prompt. It is mandatory."
 * - 12:40 PM CT: every recognized angle, during a build or when a cabinet is placed by hand.
 * - 12:41 PM CT: shape and angle match the corner; a plain blank is trimmed to the exact opening.
 *
 * For every inside corner in the wall list (autoDesignCorners), each side and each band (base
 * row, upper row) is checked. The nearest cabinet OR appliance (a dishwasher or range owns the
 * joint with its own front face) needs a plain board from its corner-side face to the miter line
 * of that corner. The board stands alone: an empty neighbor wall or a wall does not cancel it,
 * and a collision on one side never drops the other. A side that already has a filler is left
 * alone (no doubling, no stacking: the W930 rule). When the face sits on or past the miter line,
 * the run is shifted along the wall just enough for a 1/2 in board (builds only), with a review
 * note. A cut under 1/2 in is skipped and logged. Missing plain stock is flagged, never invented.
 * 90° corners reuse the configured blind-corner filler (buildRequiredBlindCornerFiller).
 */
import { singleAngledFillerBoard } from "./angledWallFiller";
import { buildRequiredBlindCornerFiller, requiredBlindCornerFillerGroupId, requiresConfiguredBlindCornerFiller } from "./blindCornerRequiredFiller";
import { catalogFillerForGap, type CatalogFillerCandidate } from "./catalogFiller";
import type { DesignerReviewFinding } from "./designerReviewFindings";
import {
  appendCollisionFreePlacements,
  elevationBox,
  formatEighthInches,
  isFillerItem,
  isRangeHoodPlacement,
  STD,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";
import { autoDesignCorners, type AutoDesignCorner } from "./autoDesignWallList";

export const MIN_CORNER_BOARD_IN = 0.5;

type Band = "base" | "wall";

export type AngleFillerGuardResult = {
  placed: PlacedCabinet[];
  notes: string[];
  inserted: { uid: string; wallId: string; band: Band; masterCode: string; cutIn: number; angleDeg: number; ownerUid: string }[];
  shifted: { wallId: string; uids: string[]; byIn: number }[];
  skippedSmall: { wallId: string; band: Band; gapIn: number }[];
  flagged: { wallId: string; band: Band; reason: string }[];
};

function bandOf(item: PlacedCabinet, room: RoomData): Band | "tall" | null {
  if (isRangeHoodPlacement(item)) return null;
  if (item.placement === "wall") return "wall";
  if (item.placement === "tall") return "tall";
  if (item.placement === "base") return "base";
  if (item.placement === "appliance") {
    const box = elevationBox(item, room);
    return box.bottom <= 1 ? "base" : null;
  }
  return null;
}

function isFillerPiece(item: PlacedCabinet): boolean {
  return isFillerItem(item);
}

function nearDistance(item: PlacedCabinet, wallId: string, at: "start" | "end", length: number, room: RoomData) {
  const offset = wallRunOffset(item, wallId, room);
  const span = wallRunSpan(item, wallId, room);
  return { near: at === "start" ? offset : length - (offset + span), offset, span };
}

function miterAlong(depth: number, angleDeg: number): number {
  return depth / Math.tan(((angleDeg / 2) * Math.PI) / 180);
}

/** Items in a run that move together when the run is pushed off a corner. */
function chainFrom(items: { item: PlacedCabinet; near: number; span: number }[], startIndex: number) {
  const chain = [items[startIndex]];
  for (let index = startIndex + 1; index < items.length; index += 1) {
    const previous = chain[chain.length - 1];
    if (items[index].near - (previous.near + previous.span) > 0.25) break;
    chain.push(items[index]);
  }
  return chain;
}

function shiftAway(
  working: PlacedCabinet[],
  wallId: string,
  at: "start" | "end",
  length: number,
  ownerUid: string,
  delta: number,
  room: RoomData,
): { placed: PlacedCabinet[]; uids: string[] } | null {
  const onWall = working
    .filter((item) => item.wallId === wallId && !isFillerPiece(item) && bandOf(item, room) != null)
    .map((item) => ({ item, ...nearDistance(item, wallId, at, length, room) }))
    .sort((a, b) => a.near - b.near);
  const band = (entry: PlacedCabinet) => (bandOf(entry, room) === "wall" ? "wall" : "base");
  const owner = working.find((item) => item.uid === ownerUid);
  if (!owner) return null;
  const sameBand = onWall.filter((entry) => band(entry.item) === band(owner) || bandOf(entry.item, room) === "tall");
  const startIndex = sameBand.findIndex((entry) => entry.item.uid === ownerUid);
  if (startIndex < 0) return null;
  const chain = chainFrom(sameBand, startIndex);
  const last = chain[chain.length - 1];
  const nextBlocker = sameBand[startIndex + chain.length];
  const room0 = nextBlocker ? nextBlocker.near - (last.near + last.span) : length - (last.near + last.span);
  if (room0 + 1e-6 < delta) return null;
  // Anything sitting over a moving appliance (an over-range microwave, the bridge, the hood) rides with it.
  const riders = working.filter((item) => item.wallId === wallId && !chain.some((entry) => entry.item.uid === item.uid)
    && chain.some((entry) => entry.item.placement === "appliance" && (() => {
      const own = nearDistance(item, wallId, at, length, room);
      return own.near >= entry.near - 0.5 && own.near + own.span <= entry.near + entry.span + 0.5;
    })()));
  const moving = new Set([...chain.map((entry) => entry.item.uid), ...riders.map((item) => item.uid)]);
  const sign = at === "start" ? 1 : -1;
  const placed = working.map((item) => {
    if (!moving.has(item.uid)) return item;
    const offset = wallRunOffset(item, wallId, room) + sign * delta;
    const span = wallRunSpan(item, wallId, room);
    const spot = wallPlacementAt(offset, span, Number(item.depth) || STD.BASE_DEPTH, wallId as WallSide, room, item.peninsulaSide);
    return { ...item, ...spot } as PlacedCabinet;
  });
  return { placed, uids: Array.from(moving) };
}

export function enforceCornerFillersAtEveryAngle(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  catalogFillers: readonly CatalogFillerCandidate[];
  makeUid: () => string;
  styleId: number | null;
  /** Limit the check to these walls (the hand-placement hook passes the cabinet's wall). */
  onlyWallIds?: ReadonlySet<string> | null;
  /** Builds may push a run off the corner to make room; a hand placement never moves the user's cabinets. */
  allowShift?: boolean;
  /** Also close 90° corners with the configured blind-corner filler. */
  includeSquareCorners?: boolean;
}): AngleFillerGuardResult {
  const { room } = input;
  let working = [...input.placed];
  const result: AngleFillerGuardResult = { placed: working, notes: [], inserted: [], shifted: [], skippedSmall: [], flagged: [] };
  const corners = autoDesignCorners(room).filter((corner) => corner.inside);

  for (const corner of corners) {
    if (corner.angleDeg > 178) continue;
    const square = Math.abs(corner.angleDeg - 90) <= 1;
    if (square) continue; // 90° corners are closed by the blind-corner filler below.
    if (corner.angleDeg < 89) {
      result.flagged.push({ wallId: corner.wallId, band: "base", reason: `inside angle ${corner.angleDeg}° is sharper than 90°` });
      result.notes.push(`Corner fillers: the ${corner.angleDeg}° corner between ${corner.wallId} and ${corner.neighborWallId} is sharper than 90°; no plain filler shape fits it, so it is left for review.`);
      continue;
    }
    for (const side of [
      { wallId: corner.wallId, at: corner.wallAt },
      { wallId: corner.neighborWallId, at: corner.neighborAt },
    ] as const) {
      if (input.onlyWallIds && !input.onlyWallIds.has(side.wallId)) continue;
      for (const band of ["base", "wall"] as const) {
        working = closeOneSide(working, corner, side.wallId, side.at, band, input, result);
      }
    }
  }

  if (input.includeSquareCorners !== false) {
    for (const cabinet of [...working]) {
      if (!requiresConfiguredBlindCornerFiller(cabinet)) continue;
      if (input.onlyWallIds && cabinet.wallId && !input.onlyWallIds.has(cabinet.wallId)) continue;
      const groupId = requiredBlindCornerFillerGroupId(cabinet);
      if (working.some((item) => item.fillerPieceGroupId === groupId || (item.fillerForCabinetUid === cabinet.uid && isFillerItem(item)))) continue;
      const required = buildRequiredBlindCornerFiller(cabinet, room, input.catalogFillers, input.makeUid, cabinet.styleId ?? input.styleId);
      if (!required.ok) continue;
      const accepted = appendCollisionFreePlacements(working, [required.filler], room);
      if (!accepted.placed.some((item) => item.uid === required.filler.uid)) {
        result.flagged.push({ wallId: cabinet.wallId ?? "", band: cabinet.placement === "wall" ? "wall" : "base", reason: `90° corner filler for ${cabinet.masterCode} has no room` });
        result.notes.push(`Corner fillers: the 90° corner filler for ${cabinet.masterCode} has no room on the return; review the corner.`);
        continue;
      }
      working = accepted.placed;
      result.inserted.push({ uid: required.filler.uid, wallId: required.filler.wallId ?? "", band: cabinet.placement === "wall" ? "wall" : "base", masterCode: required.filler.masterCode, cutIn: Number(required.filler.width) || 0, angleDeg: 90, ownerUid: cabinet.uid });
      result.notes.push(`Corner fillers: added the 90° corner filler ${required.filler.masterCode} for ${cabinet.masterCode}.`);
    }
  }

  result.placed = working;
  return result;
}

function closeOneSide(
  working: PlacedCabinet[],
  corner: AutoDesignCorner,
  wallId: string,
  at: "start" | "end",
  band: Band,
  input: Parameters<typeof enforceCornerFillersAtEveryAngle>[0],
  result: AngleFillerGuardResult,
): PlacedCabinet[] {
  const { room } = input;
  const frame = wallRunFrame(wallId, room);
  if (!frame) return working;
  const length = frame.length;
  const inBand = (item: PlacedCabinet) => {
    const itemBand = bandOf(item, room);
    return band === "base" ? itemBand === "base" || itemBand === "tall" : itemBand === "wall" || itemBand === "tall";
  };
  const occupants = working
    .filter((item) => item.wallId === wallId && !isFillerPiece(item) && inBand(item))
    .map((item) => ({ item, ...nearDistance(item, wallId, at, length, room) }))
    .sort((a, b) => a.near - b.near);
  if (occupants.length === 0) return working; // an empty run: nothing to close on this side.
  const owner = occupants[0];
  // A tall at the corner closes both bands with one board in the base pass.
  if (band === "wall" && bandOf(owner.item, room) === "tall") return working;
  const layer = bandOf(owner.item, room) === "tall" ? "tall" : band;
  const fillerBand = (item: PlacedCabinet) => (item.placement === "wall" ? "wall" : "base");
  const existing = working.some((item) => item.wallId === wallId && isFillerPiece(item) && fillerBand(item) === (layer === "wall" ? "wall" : "base")
    && nearDistance(item, wallId, at, length, room).near < owner.near + 0.25);
  if (existing) return working; // already closed: never doubled, never stacked.

  const depth = band === "wall" ? STD.WALL_DEPTH : STD.BASE_DEPTH;
  const frontMiter = miterAlong(depth, corner.angleDeg);
  const rearMiter = miterAlong(Math.max(0, depth - 0.75), corner.angleDeg);
  const beforeShift = working;
  const shiftCountBefore = result.shifted.length;
  const undoShift = () => {
    // A shift only stands when its board goes in.
    if (result.shifted.length > shiftCountBefore) {
      result.shifted.splice(shiftCountBefore);
      const moved = result.notes.findIndex((note) => note.startsWith(`Corner fillers: moved ${owner.item.masterCode} on ${label}`));
      if (moved >= 0) result.notes.splice(moved, 1);
    }
    return beforeShift;
  };
  let near = owner.near;
  let cut = near - frontMiter;
  const label = `${wallId} ${band === "wall" ? "upper" : "base"} row`;
  if (cut < MIN_CORNER_BOARD_IN && cut > 0) {
    result.skippedSmall.push({ wallId, band, gapIn: cut });
    result.notes.push(`Corner fillers: ${label} at the ${corner.turnDeg}° turn leaves only ${formatEighthInches(cut)}, under 1/2 in, so no board is cut there.`);
    return working;
  }
  if (cut <= 0) {
    const delta = MIN_CORNER_BOARD_IN - cut;
    const shifted = input.allowShift ? shiftAway(working, wallId, at, length, owner.item.uid, delta, room) : null;
    if (!shifted) {
      result.flagged.push({ wallId, band, reason: `no room for the corner filler beside ${owner.item.masterCode}` });
      result.notes.push(`Corner fillers: ${owner.item.masterCode} on ${label} sits inside the ${corner.turnDeg}° corner miter and the run cannot move ${formatEighthInches(delta)}; the corner filler is left for review.`);
      return working;
    }
    working = shifted.placed;
    result.shifted.push({ wallId, uids: shifted.uids, byIn: delta });
    result.notes.push(`Corner fillers: moved ${owner.item.masterCode} on ${label} ${formatEighthInches(delta)} along the wall to make room for the mandatory corner filler.`);
    near += delta;
    cut = near - frontMiter;
  }

  const ownerNow = working.find((item) => item.uid === owner.item.uid) ?? owner.item;
  const elevation = elevationBox(ownerNow, room);
  const boardHeight = layer === "base" ? Math.min(elevation.height, STD.BASE_HEIGHT) : elevation.height;
  const stockWidth = near - Math.min(frontMiter, rearMiter);
  const blank = plainBlankFor(layer, boardHeight, stockWidth, input.catalogFillers);
  if (!blank) {
    result.flagged.push({ wallId, band, reason: `no plain filler blank of ${formatEighthInches(stockWidth)} or wider` });
    const restored = undoShift();
    result.notes.push(`Corner fillers: the line has no plain (non-fluted) filler blank at least ${formatEighthInches(stockWidth)} wide for ${label} at the ${corner.turnDeg}° turn; left for review.`);
    return restored;
  }
  const toOffset = (fromVertex: number) => (at === "start" ? fromVertex : length - fromVertex);
  const board = singleAngledFillerBoard({
    owner: ownerNow,
    wallId,
    layer,
    faceOffsetIn: toOffset(near),
    frontMiterOffsetIn: toOffset(frontMiter),
    rearMiterOffsetIn: toOffset(rearMiter),
    miterAngleDeg: corner.turnDeg / 2,
    turnDeg: corner.turnDeg,
    elevation: { bottom: layer === "base" ? 0 : elevation.bottom, height: boardHeight },
    source: blank,
    room,
    makeUid: input.makeUid,
    styleId: ownerNow.styleId ?? input.styleId,
    vertexKey: corner.key,
  });
  if (!board) return undoShift();
  const accepted = appendCollisionFreePlacements(working, [board], room);
  if (!accepted.placed.some((item) => item.uid === board.uid)) {
    result.flagged.push({ wallId, band, reason: "corner filler collides" });
    const restored = undoShift();
    result.notes.push(`Corner fillers: the ${blank.masterCode} board for ${label} at the ${corner.turnDeg}° turn collides with another piece; left for review.`);
    return restored;
  }
  result.inserted.push({ uid: board.uid, wallId, band, masterCode: blank.masterCode, cutIn: cut, angleDeg: corner.angleDeg, ownerUid: ownerNow.uid });
  result.notes.push(`Corner fillers: added ${blank.masterCode} trimmed to ${formatEighthInches(cut)} on ${label} beside ${ownerNow.masterCode} at the ${corner.turnDeg}° turn.`);
  return accepted.placed;
}

/** Smallest plain blank of the right layer and height at least `width` wide (never fluted/BFF: catalogFillerForGap bans them). */
function plainBlankFor(layer: "base" | "wall" | "tall", heightIn: number, width: number, candidates: readonly CatalogFillerCandidate[]) {
  const ok = candidates.filter((candidate) => {
    const height = Number(candidate.height) || 0;
    if (height + 0.25 < heightIn) return false;
    const text = `${candidate.masterCode} ${candidate.description ?? ""}`.toLowerCase();
    if (layer === "base" && /\bwall\s+filler\b/.test(text)) return false;
    if (layer === "wall" && /\bbase\s+filler\b/.test(text)) return false;
    if (layer === "tall" && !/\btall\s+filler\b/.test(text)) return false;
    return true;
  });
  return catalogFillerForGap(ok, width, layer);
}

export function cornerFillerFinding(result: AngleFillerGuardResult): DesignerReviewFinding | null {
  if (!result.inserted.length && !result.shifted.length && !result.flagged.length && !result.skippedSmall.length) return null;
  return {
    ruleId: "corner-fillers-every-angle",
    code: "corner-filler-check",
    severity: result.flagged.length ? "warning" : "info",
    title: "Corner fillers at every recognized angle",
    detail: result.notes.join(" "),
  } as DesignerReviewFinding;
}

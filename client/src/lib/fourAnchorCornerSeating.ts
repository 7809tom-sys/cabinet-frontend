import { buildRequiredBlindCornerFiller, requiresConfiguredBlindCornerFiller } from "./blindCornerRequiredFiller";
import type { CatalogFillerCandidate } from "./catalogFiller";
import {
  BLIND_CORNER_FILLER_WIDTH_IN, COLLISION_EPSILON_IN, appendCollisionFreePlacements, blindCornerPullPlacement,
  cabinetCollisionDetail, cabinetPlacementCollisionDetail, cabinetWall, dim, footprintDepth, formatInches, freeSegmentsOnWall, hasCollision,
  isRangeOrOven, isRefrigerator, isRefrigeratorEndPanel, refrigeratorEndPanelConflictDetail, standardHeight,
  wallLength, wallPlacementAtUnbounded, wallRunAlongAtPoint, wallRunCornerPlacement, wallRunFrame, wallRunOffset,
  wallRunSpan, type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening, type WallSide,
} from "./design";

/** The most a measured appliance may slide to free a required corner, per the admin's direction. */
export const FOUR_ANCHOR_MAX_APPLIANCE_NUDGE_IN = 3;
const NUDGE_STEP_IN = 1 / 8;

export type FourAnchorApplianceMove = {
  kind: "range" | "refrigerator";
  /** Plain-language name such as “30″ range”. */
  label: string;
  wallId: string;
  /** Distance moved, always away from the corner. */
  shiftIn: number;
  /** Signed change in along-wall offset (positive moves toward the wall's end). */
  deltaAlongIn: number;
  /** New measured center along the wall after the move. */
  centerAlongIn: number;
};

export type FourAnchorCornerSeatResult =
  | { ok: true; placed: PlacedCabinet[]; corner: PlacedCabinet; moves: FourAnchorApplianceMove[] }
  | { ok: false; message: string };

type Group = {
  kind: "range" | "refrigerator";
  main: PlacedCabinet;
  uids: Set<string>;
  wallId: WallSide;
  /** +1 moves toward the wall end, -1 toward the wall start; always away from the corner. */
  direction: 1 | -1;
};

function alongStart(item: PlacedCabinet, side: WallSide, room: RoomData): number {
  return item.wallId === side && Number.isFinite(Number(item.wallOffset))
    ? Number(item.wallOffset)
    : wallRunOffset(item, side, room);
}

function shiftGroup(placed: PlacedCabinet[], group: Group, shiftIn: number, room: RoomData): PlacedCabinet[] {
  if (Math.abs(shiftIn) <= COLLISION_EPSILON_IN) return placed;
  return placed.map((item) => {
    if (!group.uids.has(item.uid)) return item;
    const side = (item.wallId ?? group.wallId) as WallSide;
    // Unbounded so a temporarily off-run panel is rejected by the validator rather than folded back.
    const spot = wallPlacementAtUnbounded(
      alongStart(item, side, room) + shiftIn * group.direction,
      wallRunSpan(item, side, room),
      Math.max(0, Number(item.depth) || 0),
      side, room, item.peninsulaSide,
    );
    return { ...item, ...spot, wallId: spot.wallId ?? item.wallId, wallOffset: spot.wallOffset ?? item.wallOffset };
  });
}

/** A moved appliance (and its refrigerator bay) must still be a legal, uncollided placement. */
function groupStillValid(placed: PlacedCabinet[], group: Group, openings: WallOpening[], room: RoomData): boolean {
  const members = placed.filter((item) => group.uids.has(item.uid));
  const rest = placed.filter((item) => !group.uids.has(item.uid));
  const restNoPanels = rest.filter((item) => !isRefrigeratorEndPanel(item));
  for (const member of members) {
    const side = (member.wallId ?? group.wallId) as WallSide;
    const start = alongStart(member, side, room);
    const end = start + wallRunSpan(member, side, room);
    if (start < -COLLISION_EPSILON_IN || end > wallLength(side, room) + COLLISION_EPSILON_IN) return false;
    if (isRefrigeratorEndPanel(member)) {
      if (refrigeratorEndPanelConflictDetail(member, restNoPanels, group.main.uid, room)) return false;
    } else if (cabinetPlacementCollisionDetail(member, rest, room)) return false;
  }
  const main = members.find((item) => item.uid === group.main.uid);
  if (!main) return false;
  const side = (main.wallId ?? group.wallId) as WallSide;
  const width = wallRunSpan(main, side, room);
  const start = alongStart(main, side, room);
  return freeSegmentsOnWall(side, room, rest, openings, width, 0, "base", false, main, Math.max(0, Number(main.depth) || 0))
    .some((segment) => start >= segment.start - COLLISION_EPSILON_IN
      && start + width <= segment.start + segment.length + COLLISION_EPSILON_IN);
}

function movableGroups(
  working: PlacedCabinet[], room: RoomData, corner: { x: number; y: number }, cornerWallIds: readonly string[],
): Group[] {
  const groups: Group[] = [];
  for (const item of working) {
    const isFridge = isRefrigerator(item);
    const isRange = !isFridge && item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description);
    if (!isFridge && !isRange) continue;
    const wallId = cabinetWall(item, room);
    if (!cornerWallIds.includes(wallId)) continue;
    const frame = wallRunFrame(wallId, room);
    if (!frame) continue;
    const along = wallRunAlongAtPoint(frame, corner);
    const uids = new Set<string>([item.uid]);
    if (isFridge) {
      for (const member of working) if (member.refrigeratorAssemblyId === item.uid) uids.add(member.uid);
    }
    groups.push({
      kind: isFridge ? "refrigerator" : "range", main: item, uids, wallId,
      direction: along < frame.length / 2 ? 1 : -1,
    });
  }
  return groups;
}

const applianceName = (item: PlacedCabinet) => (isRefrigerator(item) ? "refrigerator" : "range");

/**
 * Seats the chosen corner box at the exact shared vertex. If a measured range
 * or refrigerator sits inside the corner's footprint, that appliance (and its
 * refrigerator bay) is slid *away from the corner* by the smallest 1/8-inch
 * amount that clears it, never more than three inches. Sink and dishwasher
 * stay where they were measured. Every move is returned for disclosure.
 */
export function seatFourAnchorCorner(input: {
  source: DesignCabinet;
  slotLabel: string;
  target: { x: number; y: number; firstWallId: string };
  /** Engine wall ids of the two walls that meet at this corner. */
  cornerWallIds: readonly string[];
  working: PlacedCabinet[];
  room: RoomData;
  openings: WallOpening[];
  /** Resolved blind pull for a base blind-corner SKU; undefined for non-blind corners. */
  blindPullIn?: number;
  isBlindOption: boolean;
  catalogFillers: readonly CatalogFillerCandidate[];
  makeUid: () => string;
  styleId: number | null;
  maxNudgeIn?: number;
}): FourAnchorCornerSeatResult {
  const { source, slotLabel, target, room, openings } = input;
  const code = source.masterCode;
  const width = dim(source.width, 0);
  const depth = footprintDepth(source);
  if (width <= 0 || depth <= 0) return { ok: false, message: `${code} has no valid installed corner footprint in Cabinet Config.` };
  const frame = wallRunFrame(target.firstWallId, room);
  if (!frame) return { ok: false, message: `${slotLabel} does not resolve to a real shared wall vertex. No remaining cabinets were added.` };
  const at = Math.hypot(frame.start.x - target.x, frame.start.y - target.y) <= 0.01 ? "start" : "end";
  const preview: PlacedCabinet = {
    uid: input.makeUid(), cabinetId: source.id, masterCode: code, description: source.description,
    category: source.category, subCategory: source.subCategory, placement: "base",
    x: target.x, y: target.y, width, depth, height: dim(source.height, standardHeight("base")), rotation: 0,
    numberOfDoors: source.numberOfDoors, numberOfDrawers: source.numberOfDrawers,
    cornerType: source.cornerType ?? null, fillerRequired: source.fillerRequired ?? false,
    catalogImageUrl: source.catalogImageUrl ?? null, styleId: input.styleId,
  };

  type Trial =
    | { ok: true; placed: PlacedCabinet[]; corner: PlacedCabinet }
    | { ok: false; message: string; blocker?: PlacedCabinet };
  const trySeat = (working: PlacedCabinet[]): Trial => {
    // Direct vertex seating: this can never drift to a different, emptier room corner.
    const spot = wallRunCornerPlacement(preview, frame, at, room);
    if (!spot) return { ok: false, message: `${code} cannot be seated: ${slotLabel} is not a true 90° wall corner.` };
    let corner: PlacedCabinet = { ...preview, ...spot };
    if (input.isBlindOption) {
      const pulled = blindCornerPullPlacement(corner, room, input.blindPullIn ?? 6);
      if (!pulled) return { ok: false, message: `${code} must use its Cabinet Config pull range at ${slotLabel}.` };
      corner = { ...corner, ...pulled };
    }
    const cornerHit = cabinetPlacementCollisionDetail(corner, working, room);
    if (cornerHit) return { ok: false, message: "blocked", blocker: cornerHit.cabinet };
    const committed = appendCollisionFreePlacements(working, [corner], room);
    if (!committed.placed.some((cabinet) => cabinet.uid === corner.uid)) {
      return { ok: false, message: `${code} overlaps an appliance, opening, or adjoining wall clearance at ${slotLabel}.` };
    }
    let placed = committed.placed;
    if (requiresConfiguredBlindCornerFiller(corner)) {
      const required = buildRequiredBlindCornerFiller(corner, room, input.catalogFillers, input.makeUid, corner.styleId ?? null);
      if (!required.ok) {
        return { ok: false, message: required.reason === "missing-catalog-filler"
          ? `${code} requires its configured ${formatInches(BLIND_CORNER_FILLER_WIDTH_IN)} filler, which is unavailable in this cabinet line.`
          : `${code} cannot create its configured blind-corner filler at ${slotLabel}.` };
      }
      if (hasCollision(required.filler, placed)) {
        // Name what blocks the filler (never the corner box it belongs to).
        const others = placed.filter((item) => item.uid !== corner.uid);
        const fillerHit = cabinetPlacementCollisionDetail(required.filler, others, room) ?? cabinetCollisionDetail(required.filler, others);
        return { ok: false, message: "blocked-filler", blocker: fillerHit?.cabinet };
      }
      const filled = appendCollisionFreePlacements(placed, [required.filler], room);
      if (!filled.placed.some((cabinet) => cabinet.uid === required.filler.uid)) return { ok: false, message: "blocked-filler" };
      placed = filled.placed;
    }
    return { ok: true, placed, corner };
  };

  const isBlocked = (message: string) => message === "blocked" || message === "blocked-filler";
  const first = trySeat(input.working);
  if (first.ok) return { ok: true, placed: first.placed, corner: first.corner, moves: [] };
  if (!isBlocked(first.message)) return { ok: false, message: first.message };

  // Something real occupies the corner footprint: slide only a blocking range/refrigerator away from it.
  const limit = Math.max(0, input.maxNudgeIn ?? FOUR_ANCHOR_MAX_APPLIANCE_NUDGE_IN);
  const groups = movableGroups(input.working, room, target, input.cornerWallIds).slice(0, 2);
  const steps: number[] = [];
  for (let step = 0; step * NUDGE_STEP_IN <= limit + COLLISION_EPSILON_IN; step++) steps.push(step * NUDGE_STEP_IN);
  const combos: number[][] = groups.length === 0 ? [] : groups.length === 1
    ? steps.map((a) => [a])
    : steps.flatMap((a) => steps.map((b) => [a, b]));
  combos.sort((left, right) => left.reduce((s, v) => s + v, 0) - right.reduce((s, v) => s + v, 0));
  for (const combo of combos) {
    if (combo.every((value) => value === 0)) continue;
    let shifted = input.working;
    let valid = true;
    groups.forEach((group, index) => {
      if (!valid || combo[index] === 0) return;
      shifted = shiftGroup(shifted, group, combo[index], room);
      if (!groupStillValid(shifted, group, openings, room)) valid = false;
    });
    if (!valid) continue;
    const trial = trySeat(shifted);
    if (!trial.ok) continue;
    const moves: FourAnchorApplianceMove[] = [];
    groups.forEach((group, index) => {
      if (combo[index] === 0) return;
      const moved = trial.placed.find((item) => item.uid === group.main.uid)!;
      const side = (moved.wallId ?? group.wallId) as WallSide;
      const start = alongStart(moved, side, room);
      const span = wallRunSpan(moved, side, room);
      moves.push({
        kind: group.kind, label: `${formatInches(span)} ${group.kind}`, wallId: group.wallId,
        shiftIn: combo[index], deltaAlongIn: combo[index] * group.direction, centerAlongIn: start + span / 2,
      });
    });
    return { ok: true, placed: trial.placed, corner: trial.corner, moves };
  }

  // Name the real blocker and the shortfall instead of a vague “occupied” message.
  const blocker = first.blocker;
  if (blocker) {
    const name = blocker.placement === "appliance" || isRefrigerator(blocker) ? applianceName(blocker) : `${blocker.masterCode} cabinet`;
    const group = groups.find((candidate) => candidate.uids.has(blocker.uid));
    if (group) {
      // Measure the real shortfall (corner box plus its required filler) by sliding well past the allowance.
      let needed: number | null = null;
      for (let step = 1; step * NUDGE_STEP_IN <= 48 + COLLISION_EPSILON_IN; step++) {
        const amount = step * NUDGE_STEP_IN;
        const shifted = shiftGroup(input.working, group, amount, room);
        if (!groupStillValid(shifted, group, openings, room)) break;
        if (trySeat(shifted).ok) { needed = amount; break; }
      }
      const shortBy = needed != null ? `about ${formatInches(needed)}` : "more than the room allows";
      return {
        ok: false,
        message: `${code} cannot fit at ${slotLabel}: the ${name} is too close to the corner. It would have to slide ${shortBy} away, `
          + `but a measured appliance may only move ${formatInches(limit)}. Choose a smaller corner cabinet or change that appliance's center measurement.`,
      };
    }
    return {
      ok: false,
      message: `${code} cannot fit at ${slotLabel}: the ${name} is in the way. It is not a range or refrigerator, so it was not moved. Adjust that measurement or choose a smaller corner cabinet.`,
    };
  }
  return { ok: false, message: `${code} cannot fit at ${slotLabel}: the corner footprint or its required filler overlaps another cabinet, opening, or wall clearance. Choose a smaller corner cabinet.` };
}

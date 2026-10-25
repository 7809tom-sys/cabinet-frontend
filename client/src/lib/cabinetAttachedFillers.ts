import {
  cabinetWall,
  wallLength,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "@/lib/design";

const EDGE_EPSILON_IN = 0.125;

export type AttachedFillerSide = "left" | "right";

/** Exact installed cut widths chosen before a cabinet is committed. */
export type AttachedFillerChoice = {
  leftIn: number;
  rightIn: number;
};

export type AttachedFillerPlan = {
  wall: WallSide;
  placement: "base" | "wall" | "tall";
  /** The clear physical run bounded by real walls/cabinets, never an opening. */
  openingStartIn: number;
  openingEndIn: number;
  availableFillerIn: number;
  leftAllowed: boolean;
  rightAllowed: boolean;
  cabinetStartIn: number;
  cabinetSpanIn: number;
  pieces: Array<{ side: AttachedFillerSide; startIn: number; widthIn: number }>;
};

function roundToEighth(value: number) {
  return Math.round(value * 8) / 8;
}

function floorLayer(placement: PlacedCabinet["placement"]) {
  return placement === "base" || placement === "tall" || placement === "appliance";
}

function sharesFillerLayer(candidate: PlacedCabinet, peer: PlacedCabinet) {
  if (candidate.placement === "wall") return peer.placement === "wall";
  return floorLayer(peer.placement);
}

function finitePositive(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

/**
 * Finds the real bounded run around a candidate cabinet. A side becomes eligible
 * only when its outside edge can terminate at a physical wall or another
 * floor/wall cabinet—not an open room end, door, or window.
 */
export function attachedFillerPlanForCandidate(
  candidate: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
  choice: AttachedFillerChoice = { leftIn: 0, rightIn: 0 },
): AttachedFillerPlan | null {
  if (!(candidate.placement === "base" || candidate.placement === "wall" || candidate.placement === "tall")) return null;
  const wall = cabinetWall(candidate, room);
  const runLength = wallLength(wall, room);
  const cabinetStart = wallRunOffset(candidate, wall, room);
  const cabinetSpan = wallRunSpan(candidate, wall, room);
  if (!(runLength > 0) || !(cabinetSpan > 0)) return null;

  let openingStart = 0;
  let openingEnd = runLength;
  let leftPeer = false;
  let rightPeer = false;
  for (const peer of placed) {
    if (peer.uid === candidate.uid || !sharesFillerLayer(candidate, peer) || cabinetWall(peer, room) !== wall) continue;
    const start = wallRunOffset(peer, wall, room);
    const end = start + wallRunSpan(peer, wall, room);
    if (end <= cabinetStart + EDGE_EPSILON_IN && end > openingStart) {
      openingStart = end;
      leftPeer = true;
    }
    if (start >= cabinetStart + cabinetSpan - EDGE_EPSILON_IN && start < openingEnd) {
      openingEnd = start;
      rightPeer = true;
    }
  }

  const availableFillerIn = Math.max(0, openingEnd - openingStart - cabinetSpan);
  const leftGapIn = Math.max(0, cabinetStart - openingStart);
  const rightGapIn = Math.max(0, openingEnd - (cabinetStart + cabinetSpan));
  const leftIn = roundToEighth(finitePositive(choice.leftIn));
  const rightIn = roundToEighth(finitePositive(choice.rightIn));
  // An attached filler must finish at a real wall or neighboring cabinet and
  // be part of a six-inch-or-less installation seam. This deliberately keeps a
  // free-standing/exposed cabinet end out of the chooser instead of moving a
  // cabinet across a large open run merely because the far room wall exists.
  const leftAllowed = (openingStart <= EDGE_EPSILON_IN || leftPeer)
    && leftGapIn <= 6 + EDGE_EPSILON_IN;
  const rightAllowed = (openingEnd >= runLength - EDGE_EPSILON_IN || rightPeer)
    && rightGapIn <= 6 + EDGE_EPSILON_IN;
  if ((leftIn > EDGE_EPSILON_IN && !leftAllowed) || (rightIn > EDGE_EPSILON_IN && !rightAllowed)) return null;
  if (leftIn > 6 + EDGE_EPSILON_IN || rightIn > 6 + EDGE_EPSILON_IN) return null;
  if (leftIn + rightIn > availableFillerIn + EDGE_EPSILON_IN) return null;

  const placement = candidate.placement;
  const fittedStart = leftIn > EDGE_EPSILON_IN
    ? openingStart + leftIn
    : rightIn > EDGE_EPSILON_IN
      ? openingEnd - rightIn - cabinetSpan
      : cabinetStart;
  const pieces: AttachedFillerPlan["pieces"] = [];
  if (leftIn > EDGE_EPSILON_IN) pieces.push({ side: "left", startIn: openingStart, widthIn: leftIn });
  if (rightIn > EDGE_EPSILON_IN) pieces.push({ side: "right", startIn: fittedStart + cabinetSpan, widthIn: rightIn });
  return {
    wall,
    placement,
    openingStartIn: openingStart,
    openingEndIn: openingEnd,
    availableFillerIn,
    leftAllowed,
    rightAllowed,
    cabinetStartIn: fittedStart,
    cabinetSpanIn: cabinetSpan,
    pieces,
  };
}

/**
 * An installed attached filler is a review item only after its cabinet owner is
 * removed or its outside edge no longer terminates at a wall or adjacent cabinet.
 * It is intentionally never deleted as a side effect of another cabinet removal.
 */
export function attachedFillerNeedsReview(
  filler: Pick<PlacedCabinet, "uid" | "placement" | "x" | "y" | "width" | "depth" | "fillerForCabinetUid"> & {
    fillerAttachmentSide?: AttachedFillerSide | null;
  },
  placed: readonly PlacedCabinet[],
  room: RoomData,
): boolean {
  if (!filler.fillerAttachmentSide) return false;
  const owner = filler.fillerForCabinetUid ? placed.find((item) => item.uid === filler.fillerForCabinetUid) : null;
  if (!owner) return true;
  const wall = cabinetWall(owner, room);
  const fillerStart = wallRunOffset(filler as PlacedCabinet, wall, room);
  const fillerEnd = fillerStart + wallRunSpan(filler as PlacedCabinet, wall, room);
  const outerAt = filler.fillerAttachmentSide === "left" ? fillerStart : fillerEnd;
  const runLength = wallLength(wall, room);
  if (outerAt <= EDGE_EPSILON_IN || outerAt >= runLength - EDGE_EPSILON_IN) return false;

  return !placed.some((peer) => {
    if (peer.uid === filler.uid || peer.uid === owner.uid || !sharesFillerLayer(owner, peer) || cabinetWall(peer, room) !== wall) return false;
    const start = wallRunOffset(peer, wall, room);
    const end = start + wallRunSpan(peer, wall, room);
    return filler.fillerAttachmentSide === "left"
      ? Math.abs(end - outerAt) <= EDGE_EPSILON_IN
      : Math.abs(start - outerAt) <= EDGE_EPSILON_IN;
  });
}

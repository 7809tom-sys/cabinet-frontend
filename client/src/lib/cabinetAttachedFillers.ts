import {
  cabinetWall,
  freeSegmentsOnWall,
  placedCornerGeometryKind,
  placedFootprint,
  wallLength,
  wallRunFrame,
  wallRunJoinAt,
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
  /** Measured space between the cabinet and the wall/cabinet on each side. */
  leftGapIn: number;
  rightGapIn: number;
  leftAllowed: boolean;
  rightAllowed: boolean;
  cabinetStartIn: number;
  cabinetSpanIn: number;
  /**
   * A corner cabinet (LSB, DCSB, LS, BER, CDB, CSB, ERB) stays seated in its
   * corner. Its corner-side filler goes at the end of its leg on the adjoining
   * wall, its other filler at the end of its leg on its own wall.
   */
  cornerCabinet: boolean;
  /**
   * `side` is left/right as seen facing the cabinet. A piece on the adjoining
   * wall carries that `wall` and the `attachmentSide` of its outer edge in that
   * wall's own run direction.
   */
  pieces: Array<{ side: AttachedFillerSide; startIn: number; widthIn: number; wall?: WallSide; attachmentSide?: AttachedFillerSide }>;
  /**
   * Filler-sized spaces this choice left empty. "No filler" records every one
   * of them so a later automatic pass cannot drop a board into the same seam.
   */
  openGaps: AttachedFillerOpenGap[];
};

export type AttachedFillerOpenGap = {
  side: AttachedFillerSide;
  wall: WallSide;
  startIn: number;
  endIn: number;
};

/** A seam wider than this is an open run, not a declined filler. */
const DECLINED_FILLER_MAX_IN = 6;

/**
 * The part of a measured gap the choice did not fill. A cut that uses the whole
 * gap returns nothing. A gap wider than a filler is left off so declining a
 * cabinet does not freeze an entire open run.
 */
function openRemainder(
  side: AttachedFillerSide,
  wall: WallSide,
  gapStart: number,
  gapEnd: number,
  chosenIn: number,
  fillerAtStart: boolean,
): AttachedFillerOpenGap | null {
  const width = gapEnd - gapStart;
  if (width <= EDGE_EPSILON_IN || width > DECLINED_FILLER_MAX_IN + EDGE_EPSILON_IN) return null;
  const cut = Math.min(width, Math.max(0, chosenIn));
  const startIn = fillerAtStart ? gapStart + cut : gapStart;
  const endIn = fillerAtStart ? gapEnd : gapEnd - cut;
  if (endIn - startIn <= EDGE_EPSILON_IN) return null;
  return { side, wall, startIn, endIn };
}

/** Corner cabinets whose fillers belong at the ends of their two legs. */
export function isCornerFillerCabinet(masterCode: string | null | undefined): boolean {
  const code = (masterCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^(?:LSB|DCSB|LS|BER|CDB|CSB|ERB)\d/.test(code);
}

const CORNER_SEAT_TOLERANCE_IN = 2;

type CornerLeg = {
  /** Which end of the cabinet's own run is the corner. */
  at: "start" | "end";
  wall: WallSide;
  /** The leg sits at the start of the adjoining run (else at its end). */
  legAtStart: boolean;
  /** Along the adjoining run, where the leg's outer face is. */
  legEndIn: number;
  gapIn: number;
};

/**
 * The corner cabinet's leg on the adjoining wall and the free space past it,
 * measured with the same free-run model as the plan's "Fits up to" labels.
 */
function cornerLegGap(
  candidate: PlacedCabinet,
  others: readonly PlacedCabinet[],
  room: RoomData,
  wall: WallSide,
  cabinetStart: number,
  cabinetSpan: number,
  runLength: number,
): CornerLeg | null {
  const frame = wallRunFrame(wall, room);
  if (!frame) return null;
  const at = cabinetStart <= CORNER_SEAT_TOLERANCE_IN
    ? "start"
    : cabinetStart + cabinetSpan >= runLength - CORNER_SEAT_TOLERANCE_IN ? "end" : null;
  if (!at) return null;
  const join = wallRunJoinAt(frame, at, room);
  if (!join) return null;
  const vertex = at === "start" ? frame.start : frame.end;
  const legAtStart = Math.hypot(join.frame.start.x - vertex.x, join.frame.start.y - vertex.y) <= 0.01;
  const envelope = placedFootprint(candidate);
  const leg = placedCornerGeometryKind(candidate) === "l-shape" ? envelope.w : Math.min(envelope.w, envelope.d);
  const adjoiningLength = join.frame.length;
  const legEndIn = legAtStart ? leg : adjoiningLength - leg;
  const adjoiningWall = join.frame.id as WallSide;
  const segments = freeSegmentsOnWall(adjoiningWall, room, [...others, candidate], [], 0, 0, candidate.placement);
  const past = segments.find((free) => legAtStart
    ? Math.abs(free.start - legEndIn) <= EDGE_EPSILON_IN
    : Math.abs(free.start + free.length - legEndIn) <= EDGE_EPSILON_IN);
  return { at, wall: adjoiningWall, legAtStart, legEndIn, gapIn: past ? past.length : 0 };
}

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
  // Measure the run the way the plan's "Fits up to" labels do: a cabinet on the
  // adjoining wall, or the inside-corner hold, ends this run at a corner even
  // though it is not on this wall. Doors and windows are left out because an
  // attached filler must finish against a wall or cabinet, never an opening.
  const others = placed.filter((peer) => peer.uid !== candidate.uid);
  const segment = freeSegmentsOnWall(wall, room, others, [], 0, 0, candidate.placement, false, candidate, candidate.depth)
    .find((free) => cabinetStart >= free.start - EDGE_EPSILON_IN
      && cabinetStart + cabinetSpan <= free.start + free.length + EDGE_EPSILON_IN);
  if (segment) {
    if (segment.start > openingStart + EDGE_EPSILON_IN) {
      openingStart = segment.start;
      leftPeer = true;
    }
    if (segment.start + segment.length < openingEnd - EDGE_EPSILON_IN) {
      openingEnd = segment.start + segment.length;
      rightPeer = true;
    }
  }

  const cornerLeg = isCornerFillerCabinet(candidate.masterCode)
    ? cornerLegGap(candidate, others, room, wall, cabinetStart, cabinetSpan, runLength)
    : null;
  if (cornerLeg) {
    // The corner side is the adjoining wall's leg; the other side is this wall.
    const ownGapIn = cornerLeg.at === "start"
      ? Math.max(0, openingEnd - (cabinetStart + cabinetSpan))
      : Math.max(0, cabinetStart - openingStart);
    const ownBounded = cornerLeg.at === "start"
      ? (openingEnd >= runLength - EDGE_EPSILON_IN || rightPeer)
      : (openingStart <= EDGE_EPSILON_IN || leftPeer);
    const ownAllowed = ownBounded && ownGapIn <= 6 + EDGE_EPSILON_IN;
    const legAllowed = cornerLeg.gapIn <= 6 + EDGE_EPSILON_IN;
    const leftGapIn = cornerLeg.at === "start" ? cornerLeg.gapIn : ownGapIn;
    const rightGapIn = cornerLeg.at === "start" ? ownGapIn : cornerLeg.gapIn;
    const leftAllowed = cornerLeg.at === "start" ? legAllowed : ownAllowed;
    const rightAllowed = cornerLeg.at === "start" ? ownAllowed : legAllowed;
    const leftIn = roundToEighth(finitePositive(choice.leftIn));
    const rightIn = roundToEighth(finitePositive(choice.rightIn));
    // Any 1/8–6 inch filler may be chosen on either leg, as long as it fits in
    // the free space past that leg; the cabinet itself never moves.
    if (leftIn > 6 + EDGE_EPSILON_IN || rightIn > 6 + EDGE_EPSILON_IN) return null;
    if (leftIn > leftGapIn + EDGE_EPSILON_IN || rightIn > rightGapIn + EDGE_EPSILON_IN) return null;
    const legPiece = (side: AttachedFillerSide, widthIn: number) => ({
      side,
      wall: cornerLeg.wall,
      startIn: cornerLeg.legAtStart ? cornerLeg.legEndIn : cornerLeg.legEndIn - widthIn,
      widthIn,
      attachmentSide: (cornerLeg.legAtStart ? "right" : "left") as AttachedFillerSide,
    });
    const pieces: AttachedFillerPlan["pieces"] = [];
    if (leftIn > 0) {
      pieces.push(cornerLeg.at === "start" ? legPiece("left", leftIn) : { side: "left", startIn: cabinetStart - leftIn, widthIn: leftIn });
    }
    if (rightIn > 0) {
      pieces.push(cornerLeg.at === "start" ? { side: "right", startIn: cabinetStart + cabinetSpan, widthIn: rightIn } : legPiece("right", rightIn));
    }
    const legSide: AttachedFillerSide = cornerLeg.at === "start" ? "left" : "right";
    const ownSide: AttachedFillerSide = cornerLeg.at === "start" ? "right" : "left";
    const legSpan = cornerLeg.legAtStart
      ? { start: cornerLeg.legEndIn, end: cornerLeg.legEndIn + cornerLeg.gapIn }
      : { start: cornerLeg.legEndIn - cornerLeg.gapIn, end: cornerLeg.legEndIn };
    const ownSpan = cornerLeg.at === "start"
      ? { start: cabinetStart + cabinetSpan, end: cabinetStart + cabinetSpan + ownGapIn }
      : { start: cabinetStart - ownGapIn, end: cabinetStart };
    const openGaps = [
      openRemainder(legSide, cornerLeg.wall, legSpan.start, legSpan.end, legSide === "left" ? leftIn : rightIn, cornerLeg.legAtStart),
      openRemainder(ownSide, wall, ownSpan.start, ownSpan.end, ownSide === "left" ? leftIn : rightIn, cornerLeg.at === "start"),
    ].filter((gap): gap is AttachedFillerOpenGap => gap != null);
    return {
      wall,
      placement: candidate.placement,
      openingStartIn: openingStart,
      openingEndIn: openingEnd,
      availableFillerIn: leftGapIn + rightGapIn,
      leftGapIn,
      rightGapIn,
      leftAllowed,
      rightAllowed,
      cabinetStartIn: cabinetStart,
      cabinetSpanIn: cabinetSpan,
      cornerCabinet: true,
      pieces,
      openGaps,
    };
  }

  const availableFillerIn = Math.max(0, openingEnd - openingStart - cabinetSpan);
  const leftGapIn = Math.max(0, cabinetStart - openingStart);
  const rightGapIn = Math.max(0, openingEnd - (cabinetStart + cabinetSpan));
  const leftIn = roundToEighth(finitePositive(choice.leftIn));
  const rightIn = roundToEighth(finitePositive(choice.rightIn));
  // A side "near" a wall or cabinet (within six inches) is where a leftover
  // filler is suggested. Any 1/8–6 inch filler may still be chosen on either
  // side: next to a near wall/cabinet it butts that edge and the cabinet moves
  // over; on an open side it attaches to the cabinet's face and nothing moves.
  const leftAllowed = (openingStart <= EDGE_EPSILON_IN || leftPeer)
    && leftGapIn <= 6 + EDGE_EPSILON_IN;
  const rightAllowed = (openingEnd >= runLength - EDGE_EPSILON_IN || rightPeer)
    && rightGapIn <= 6 + EDGE_EPSILON_IN;
  if (leftIn > 6 + EDGE_EPSILON_IN || rightIn > 6 + EDGE_EPSILON_IN) return null;

  const placement = candidate.placement;
  let fittedStart = cabinetStart;
  if (leftIn > 0) {
    fittedStart = leftAllowed ? openingStart + leftIn : Math.max(cabinetStart, openingStart + leftIn);
  }
  if (rightIn > 0 && !(leftIn > 0 && leftAllowed)) {
    const rightFlushStart = openingEnd - rightIn - cabinetSpan;
    fittedStart = rightAllowed ? rightFlushStart : Math.min(fittedStart, rightFlushStart);
  }
  // Nothing may cross the wall or cabinet on either side.
  if (fittedStart - leftIn < openingStart - EDGE_EPSILON_IN) return null;
  if (fittedStart + cabinetSpan + rightIn > openingEnd + EDGE_EPSILON_IN) return null;
  const pieces: AttachedFillerPlan["pieces"] = [];
  if (leftIn > 0) pieces.push({ side: "left", startIn: fittedStart - leftIn, widthIn: leftIn });
  if (rightIn > 0) pieces.push({ side: "right", startIn: fittedStart + cabinetSpan, widthIn: rightIn });
  const openGaps = [
    openRemainder("left", wall, openingStart, fittedStart - leftIn, 0, true),
    openRemainder("right", wall, fittedStart + cabinetSpan + rightIn, openingEnd, 0, true),
  ].filter((gap): gap is AttachedFillerOpenGap => gap != null);
  return {
    wall,
    placement,
    openingStartIn: openingStart,
    openingEndIn: openingEnd,
    availableFillerIn,
    leftGapIn,
    rightGapIn,
    leftAllowed,
    rightAllowed,
    cabinetStartIn: fittedStart,
    cabinetSpanIn: cabinetSpan,
    cornerCabinet: false,
    pieces,
    openGaps,
  };
}

/** Seams an explicit filler choice left empty, including a "No filler" choice. */
export function declinedAttachedFillerSeams(
  candidate: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
  choice: AttachedFillerChoice,
): Array<{ wallId: string; layer: "base" | "wall" | "tall"; start: number; end: number }> {
  const plan = attachedFillerPlanForCandidate(candidate, placed, room, choice);
  if (!plan) return [];
  return plan.openGaps.map((gap) => ({
    wallId: gap.wall,
    layer: plan.placement,
    start: Math.round(gap.startIn * 1000) / 1000,
    end: Math.round(gap.endIn * 1000) / 1000,
  }));
}

export type AttachedFillerLeftoverOptions = {
  /** Space to fill: the whole leftover when both sides are bounded, otherwise the one bounded side's gap. */
  leftoverIn: number;
  left: AttachedFillerChoice | null;
  right: AttachedFillerChoice | null;
  split: AttachedFillerChoice | null;
  /** Corner cabinet: each leg has its own gap, so offer both fillers at once instead of a split. */
  corner: boolean;
  both: AttachedFillerChoice | null;
};

function fillableGap(gapIn: number) {
  const rounded = roundToEighth(gapIn);
  return rounded >= EDGE_EPSILON_IN && rounded <= 6 + EDGE_EPSILON_IN ? rounded : null;
}

/**
 * Tells the user the space to fill so they never have to measure it on the
 * drawing. With walls/cabinets on both sides, the whole leftover can go on
 * either side or be split evenly (the left strip rounds down to an eighth so
 * the two strips add up exactly). With only one bounded side, that side's
 * measured gap is offered on that side.
 */
export function attachedFillerLeftoverOptions(
  plan: Pick<AttachedFillerPlan, "availableFillerIn" | "leftGapIn" | "rightGapIn" | "leftAllowed" | "rightAllowed"> & { cornerCabinet?: boolean },
): AttachedFillerLeftoverOptions | null {
  if (plan.cornerCabinet) {
    const leftIn = plan.leftAllowed ? fillableGap(plan.leftGapIn) : null;
    const rightIn = plan.rightAllowed ? fillableGap(plan.rightGapIn) : null;
    if (leftIn == null && rightIn == null) return null;
    return {
      leftoverIn: (leftIn ?? 0) + (rightIn ?? 0),
      left: leftIn != null ? { leftIn, rightIn: 0 } : null,
      right: rightIn != null ? { leftIn: 0, rightIn } : null,
      split: null,
      corner: true,
      both: leftIn != null && rightIn != null ? { leftIn, rightIn } : null,
    };
  }
  if (plan.leftAllowed && plan.rightAllowed) {
    const leftoverIn = fillableGap(plan.availableFillerIn);
    if (leftoverIn == null) return null;
    const splitLeftIn = Math.floor((leftoverIn / 2) * 8) / 8;
    return {
      leftoverIn,
      left: { leftIn: leftoverIn, rightIn: 0 },
      right: { leftIn: 0, rightIn: leftoverIn },
      split: splitLeftIn > 0 ? { leftIn: splitLeftIn, rightIn: roundToEighth(leftoverIn - splitLeftIn) } : null,
      corner: false,
      both: null,
    };
  }
  if (plan.leftAllowed) {
    const gapIn = fillableGap(plan.leftGapIn);
    return gapIn == null ? null : { leftoverIn: gapIn, left: { leftIn: gapIn, rightIn: 0 }, right: null, split: null, corner: false, both: null };
  }
  if (plan.rightAllowed) {
    const gapIn = fillableGap(plan.rightGapIn);
    return gapIn == null ? null : { leftoverIn: gapIn, left: null, right: { leftIn: 0, rightIn: gapIn }, split: null, corner: false, both: null };
  }
  return null;
}

export type AttachedFillerSizeIssue = {
  side: AttachedFillerSide;
  chosenIn: number;
  /** Free space on that side before the next wall or cabinet. */
  spaceIn: number;
  /** "too-large": crosses the wall/cabinet. "too-small": leaves an uncovered gap. */
  problem: "too-large" | "too-small";
};

/**
 * Compares a chosen filler size with the measured space before anything is
 * placed. Too large means the filler would cross the next wall or cabinet (it
 * cannot be placed); too small means it leaves a gap of 1/8 inch or more
 * against a wall or cabinet within six inches. Open sides never warn.
 */
export function attachedFillerSizeIssues(
  candidate: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
  choice: AttachedFillerChoice,
): AttachedFillerSizeIssue[] {
  const leftIn = roundToEighth(finitePositive(choice.leftIn));
  const rightIn = roundToEighth(finitePositive(choice.rightIn));
  if (!(leftIn > 0) && !(rightIn > 0)) return [];
  const free = attachedFillerPlanForCandidate(candidate, placed, room);
  if (!free) return [];
  const chosen = attachedFillerPlanForCandidate(candidate, placed, room, { leftIn, rightIn });
  if (!chosen) {
    // Name the side(s) that run out of room.
    const issues: AttachedFillerSizeIssue[] = [];
    if (free.cornerCabinet || !(free.leftAllowed && free.rightAllowed)) {
      if (leftIn > free.leftGapIn + EDGE_EPSILON_IN || leftIn > 6 + EDGE_EPSILON_IN) issues.push({ side: "left", chosenIn: leftIn, spaceIn: free.leftGapIn, problem: "too-large" });
      if (rightIn > free.rightGapIn + EDGE_EPSILON_IN || rightIn > 6 + EDGE_EPSILON_IN) issues.push({ side: "right", chosenIn: rightIn, spaceIn: free.rightGapIn, problem: "too-large" });
    }
    if (issues.length === 0) {
      // Both sides share one leftover: report the chosen sides against it.
      const spaceIn = roundToEighth(free.availableFillerIn);
      if (leftIn > 0) issues.push({ side: "left", chosenIn: leftIn, spaceIn, problem: "too-large" });
      if (rightIn > 0) issues.push({ side: "right", chosenIn: rightIn, spaceIn, problem: "too-large" });
    }
    return issues;
  }
  const issues: AttachedFillerSizeIssue[] = [];
  const near = (gapIn: number) => gapIn <= 6 + EDGE_EPSILON_IN;
  if (chosen.cornerCabinet) {
    if (near(free.leftGapIn) && free.leftGapIn - leftIn >= EDGE_EPSILON_IN) issues.push({ side: "left", chosenIn: leftIn, spaceIn: free.leftGapIn, problem: "too-small" });
    if (near(free.rightGapIn) && free.rightGapIn - rightIn >= EDGE_EPSILON_IN) issues.push({ side: "right", chosenIn: rightIn, spaceIn: free.rightGapIn, problem: "too-small" });
    return issues;
  }
  const leftEdge = chosen.cabinetStartIn - leftIn;
  const rightEdge = chosen.cabinetStartIn + chosen.cabinetSpanIn + rightIn;
  const leftRemaining = roundToEighth(leftEdge - chosen.openingStartIn);
  const rightRemaining = roundToEighth(chosen.openingEndIn - rightEdge);
  if (free.leftAllowed && leftRemaining >= EDGE_EPSILON_IN) issues.push({ side: "left", chosenIn: leftIn, spaceIn: roundToEighth(leftRemaining + leftIn), problem: "too-small" });
  if (free.rightAllowed && rightRemaining >= EDGE_EPSILON_IN) issues.push({ side: "right", chosenIn: rightIn, spaceIn: roundToEighth(rightRemaining + rightIn), problem: "too-small" });
  return issues;
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
  // Measure along the filler's own wall: a corner cabinet's leg filler sits on
  // the adjoining wall, not its owner's.
  const wall = cabinetWall(filler as PlacedCabinet, room);
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

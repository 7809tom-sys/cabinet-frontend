/**
 * Owner rule: a filler is a front-face board and nothing else.
 *
 * A filler only ever sits in the cabinet FRONT FACE line, and only to close a
 * gap:
 *
 *   - between two cabinets,
 *   - between a cabinet and a wall end,
 *   - between a cabinet and an appliance.
 *
 * It is never:
 *
 *   - on the side of a refrigerator end panel (a panel is a finished skin, not a
 *     cabinet to fill against),
 *   - on the outside/side face of a cabinet that ends in open floor,
 *   - a default board on every cabinet.
 *
 * The designer used to break all three. A refrigerator end panel is deliberately
 * exempt from the plan-collision test (`sharesPlanCollisionZone`, design.ts:4170),
 * so a wall cabinet above the refrigerator measured its "before" gap back to the
 * wall start — straight through the 24-inch-deep, 84-inch-tall panel — and the
 * small-gap pass cut a board for it (`smallGapFiller.ts:284`, placed by
 * `designerLayoutRules.ts:905`). The board inherited the bridge's 72-inch datum
 * and 12-inch height, so in 3D it read as a white horizontal strip across the
 * panel's outside face.
 *
 * This module is the single judge for those rules. It is pure: it looks at the
 * finished placements and answers "is this board legal, and if not, why".
 */
import {
  cabinetWall,
  formatEighthInches,
  insideCornerHoldIn,
  isFillerItem,
  isPanelItem,
  isRefrigeratorEndPanel,
  wallRunFrame,
  wallRunJoinAt,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";

/** Touching ends of two pieces in one run are this close, or they are not a seam. */
export const FILLER_SEAM_TOLERANCE_IN = 0.02;

/** A filler this thick is cut from the front face stock, never a carcass side. */
export const FILLER_FRONT_FACE_MAX_DEPTH_IN = 1;

export type FillerRuleViolation =
  | { code: "against-refrigerator-panel"; detail: string }
  | { code: "on-open-side-face"; detail: string }
  | { code: "through-a-panel"; detail: string }
  | { code: "outside-the-front-face-line"; detail: string };

export type FillerAudit = {
  filler: PlacedCabinet;
  violation: FillerRuleViolation;
};

type RunBound = { at: "start" | "end"; kind: "wall" | "opening" | "item" | "nothing"; item: PlacedCabinet | null };

function runInterval(item: PlacedCabinet, wallId: string, room: RoomData) {
  const start = wallRunOffset(item, wallId, room);
  return { start, end: start + wallRunSpan(item, wallId, room) };
}

function isSameLayerPiece(item: PlacedCabinet, filler: PlacedCabinet): boolean {
  if (item.placement === filler.placement) return true;
  // A tall box (a refrigerator end panel, a pantry) runs floor to ceiling and
  // stands in the run on both layers, so it bounds a base board and a wall board
  // alike. A base-height appliance stands in the floor run beside a base board.
  if (item.placement === "tall") return true;
  if (filler.placement === "base" && item.placement === "appliance") return true;
  return false;
}

/** What bounds one end of a board along its own run. */
function boundAt(input: {
  filler: PlacedCabinet;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings: readonly WallOpening[];
  end: "start" | "end";
}): RunBound {
  const wallId = cabinetWall(input.filler, input.room);
  const frame = wallRunFrame(wallId, input.room);
  const mine = runInterval(input.filler, wallId, input.room);
  const at = input.end === "start" ? mine.start : mine.end;
  if (frame) {
    if (input.end === "start" && Math.abs(at - Math.max(0, frame.runStart)) <= FILLER_SEAM_TOLERANCE_IN) {
      return { at: input.end, kind: "wall", item: null };
    }
    if (input.end === "end" && Math.abs(at - frame.runEnd) <= FILLER_SEAM_TOLERANCE_IN) {
      return { at: input.end, kind: "wall", item: null };
    }
  }
  const opening = input.openings.find((candidate) => candidate.side === wallId
    && (Math.abs(candidate.offset - at) <= FILLER_SEAM_TOLERANCE_IN
      || Math.abs(candidate.offset + candidate.width - at) <= FILLER_SEAM_TOLERANCE_IN));
  if (opening) return { at: input.end, kind: "opening", item: null };
  const item = input.placed.find((candidate) => {
    if (candidate.uid === input.filler.uid) return false;
    if (!isSameLayerPiece(candidate, input.filler)) return false;
    if (cabinetWall(candidate, input.room) !== wallId) return false;
    const span = runInterval(candidate, wallId, input.room);
    const edge = input.end === "start" ? span.end : span.start;
    return Math.abs(edge - at) <= FILLER_SEAM_TOLERANCE_IN;
  }) ?? null;
  return item ? { at: input.end, kind: "item", item } : { at: input.end, kind: "nothing", item: null };
}

export type SeamBoundaryKind = "wall" | "opening" | "cabinet" | "appliance" | "panel" | "nothing";

export type SeamBoundary = {
  /** Which side of the cabinet this boundary is on. */
  at: "start" | "end";
  kind: SeamBoundaryKind;
  /** The piece that bounds this side, when a piece does. */
  item: PlacedCabinet | null;
  /** Free space between the cabinet and that boundary, in inches. */
  gapIn: number;
};

/**
 * What actually terminates a run on each side of a cabinet: the nearest piece
 * edge, wall end, or wall opening. A panel IS a boundary — it is a finished
 * 24-inch-deep skin standing in the run — so a cabinet beside one has no open
 * seam there to fill.
 */
export function seamBoundariesFor(input: {
  cabinet: PlacedCabinet;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings?: readonly WallOpening[];
}): { start: SeamBoundary; end: SeamBoundary } {
  const { cabinet, placed, room } = input;
  const wallId = cabinetWall(cabinet, room);
  const frame = wallRunFrame(wallId, room);
  const mine = runInterval(cabinet, wallId, room);
  const layerMatches = (item: PlacedCabinet) => {
    if (item.placement === cabinet.placement) return true;
    // A tall box spans floor to ceiling, so it bounds both layers of a run.
    if (item.placement === "tall") return true;
    if (cabinet.placement === "wall") return false;
    return item.placement === "appliance" || item.placement === "base";
  };
  const pieces = placed.filter((item) => item.uid !== cabinet.uid
    && !isFillerItem(item)
    && layerMatches(item)
    && cabinetWall(item, room) === wallId)
    .map((item) => ({ item, span: runInterval(item, wallId, room) }));
  const openings = input.openings ?? [];
  const side = (at: "start" | "end"): SeamBoundary => {
    const edge = at === "start" ? mine.start : mine.end;
    let best: { gap: number; kind: SeamBoundaryKind; item: PlacedCabinet | null } | null = null;
    const consider = (gap: number, kind: SeamBoundaryKind, item: PlacedCabinet | null) => {
      if (gap < -FILLER_SEAM_TOLERANCE_IN) return;
      if (best && best.gap <= gap + FILLER_SEAM_TOLERANCE_IN) return;
      best = { gap: Math.max(0, gap), kind, item };
    };
    for (const entry of pieces) {
      if (at === "start" && entry.span.end <= edge + FILLER_SEAM_TOLERANCE_IN) {
        consider(edge - entry.span.end, entry.item.placement === "appliance" ? "appliance" : isPanelItem(entry.item) ? "panel" : "cabinet", entry.item);
      }
      if (at === "end" && entry.span.start >= edge - FILLER_SEAM_TOLERANCE_IN) {
        consider(entry.span.start - edge, entry.item.placement === "appliance" ? "appliance" : isPanelItem(entry.item) ? "panel" : "cabinet", entry.item);
      }
    }
    for (const opening of openings.filter((candidate) => candidate.side === wallId)) {
      const openingStart = opening.offset;
      const openingEnd = opening.offset + opening.width;
      if (at === "start" && openingEnd <= edge + FILLER_SEAM_TOLERANCE_IN) consider(edge - openingEnd, "opening", null);
      if (at === "end" && openingStart >= edge - FILLER_SEAM_TOLERANCE_IN) consider(openingStart - edge, "opening", null);
    }
    if (frame) {
      if (at === "start") {
        const runStart = Math.max(0, frame.runStart);
        if (runStart <= edge + FILLER_SEAM_TOLERANCE_IN) consider(edge - runStart, "wall", null);
      } else {
        const runEnd = frame.runEnd;
        if (runEnd >= edge - FILLER_SEAM_TOLERANCE_IN) consider(runEnd - edge, "wall", null);
      }
    }
    if (!best) return { at, kind: "nothing", item: null, gapIn: Number.POSITIVE_INFINITY };
    const chosen = best as { gap: number; kind: SeamBoundaryKind; item: PlacedCabinet | null };
    return { at, kind: chosen.kind, item: chosen.item, gapIn: Math.round(chosen.gap * 1000) / 1000 };
  };
  return { start: side("start"), end: side("end") };
}

/** True when a filler may legally close a gap to this boundary. A panel never qualifies. */
export function isFillableBoundary(boundary: SeamBoundary): boolean {
  return boundary.kind === "wall" || boundary.kind === "opening" || boundary.kind === "cabinet" || boundary.kind === "appliance";
}

/**
 * The front-face rule does not apply at a corner. A 45°/135° miter pair, a
 * provisional corner board, a blind corner's own filler, and a board sitting
 * in the inside-corner hold are required there. A board in the open middle of
 * a run is unchanged.
 */
function isRequiredCornerFiller(filler: PlacedCabinet, room: RoomData): boolean {
  if (
    filler.fillerTransitionKind === "front-miter-pair"
    || filler.fillerTransitionKind === "angled-wedge"
    || filler.fillerTransitionKind === "corner-provisional"
    || filler.integratedWallBlindFiller === true
  ) return true;
  const wallId = cabinetWall(filler, room);
  const frame = wallRunFrame(wallId, room);
  if (!frame) return false;
  const span = runInterval(filler, wallId, room);
  for (const at of ["start", "end"] as const) {
    const join = wallRunJoinAt(frame, at, room);
    if (!join) continue;
    const angled = Math.abs(join.turnDeg - 45) <= 0.5;
    const square = Math.abs(join.turnDeg - 90) <= 0.5;
    if (!angled && !square) continue;
    const vertexAlong = at === "start" ? Math.max(0, frame.runStart) : frame.runEnd;
    const edge = at === "start" ? span.start : span.end;
    const zone = angled ? Math.max(insideCornerHoldIn(join.turnDeg, Number(filler.depth) || 24), 1) : 1;
    if (Math.abs(edge - vertexAlong) <= zone + FILLER_SEAM_TOLERANCE_IN) return true;
  }
  return false;
}

/** Two boxes on the same run whose along-run spans and depths both overlap. */
function overlapsInPlan(filler: PlacedCabinet, other: PlacedCabinet, room: RoomData): boolean {
  const wallId = cabinetWall(filler, room);
  if (cabinetWall(other, room) !== wallId) return false;
  const mine = runInterval(filler, wallId, room);
  const theirs = runInterval(other, wallId, room);
  const along = Math.min(mine.end, theirs.end) - Math.max(mine.start, theirs.start);
  if (along <= FILLER_SEAM_TOLERANCE_IN) return false;
  const mineDepth = Number(filler.depth) || 0;
  const theirDepth = Number(other.depth) || 0;
  return Math.min(mineDepth, theirDepth) > FILLER_SEAM_TOLERANCE_IN;
}

/**
 * Why this board breaks the front-face rule, or null when it is legal.
 *
 * A board is legal when both of its ends stop at a wall end, a wall opening, or
 * another cabinet/appliance on its own layer, and it does not run through a
 * panel. That is exactly "in the front face line, closing a gap".
 */
export function fillerRuleViolation(input: {
  filler: PlacedCabinet;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings?: readonly WallOpening[];
}): FillerRuleViolation | null {
  const { filler, placed, room } = input;
  if (!isFillerItem(filler)) return null;
  // A wall blind corner's 3-inch face board is drawn by its owner cabinet and
  // has no independent footprint. It is not a placed seam board.
  if (filler.integratedWallBlindFiller === true) return null;
  // Island and peninsula faces have no room-wall run to measure.
  if (filler.islandFace || !filler.wallId) return null;
  if (!wallRunFrame(filler.wallId, room)) return null;

  const through = placed.find((candidate) => candidate.uid !== filler.uid
    && isPanelItem(candidate)
    && overlapsInPlan(filler, candidate, room));
  if (through) {
    return {
      code: "through-a-panel",
      detail: `${filler.masterCode} runs through the ${through.masterCode} panel instead of closing a cabinet seam.`,
    };
  }

  const openings = input.openings ?? [];
  const bounds = (["start", "end"] as const).map((end) => boundAt({ filler, placed, room, openings, end }));

  const panelBound = bounds.find((bound) => bound.kind === "item" && bound.item != null
    && (isRefrigeratorEndPanel(bound.item) || isPanelItem(bound.item)));
  // A gap under 1.5 inches between a cabinet and a refrigerator panel is closed
  // with a filler. The board must still not run through the panel (caught above).
  const narrowCabinetToPanel = (Number(filler.width) || 0) <= 1.5 + FILLER_SEAM_TOLERANCE_IN;
  if (panelBound?.item && !narrowCabinetToPanel) {
    return {
      code: "against-refrigerator-panel",
      detail: `${filler.masterCode} is cut against the ${panelBound.item.masterCode} panel. A filler closes a cabinet-to-cabinet, cabinet-to-wall, or cabinet-to-appliance gap, never a panel side.`,
    };
  }

  // Corner and angled-join fillers are required. The open-side check is for a
  // board on the outside face of a run, not for the board that closes a corner.
  if (isRequiredCornerFiller(filler, room)) return null;

  const open = bounds.find((bound) => bound.kind === "nothing");
  if (open) {
    return {
      code: "on-open-side-face",
      detail: `${filler.masterCode} sits on the ${open.at} outside face of the run, where no cabinet, wall, or appliance closes the gap.`,
    };
  }

  // A board deeper than front-face stock is a carcass side, not a seam board.
  const depth = Number(filler.depth) || 0;
  if (depth > Number(filler.width || 0) + FILLER_FRONT_FACE_MAX_DEPTH_IN && depth > 24) {
    return {
      code: "outside-the-front-face-line",
      detail: `${filler.masterCode} is ${formatEighthInches(depth)} deep, so it is not a front-face board.`,
    };
  }
  return null;
}

/** Every illegal board on the plan, with its reason. */
export function auditFillerPlacements(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings?: readonly WallOpening[];
}): FillerAudit[] {
  return input.placed.flatMap((filler) => {
    const violation = fillerRuleViolation({ filler, placed: input.placed, room: input.room, openings: input.openings });
    return violation ? [{ filler, violation }] : [];
  });
}

/**
 * Drops every board that breaks the front-face rule. Saved designs written
 * before the rule are repaired the same way, so the 2D plan and the 3D render
 * never show a side-face board again.
 */
export function removeIllegalFillers(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  openings?: readonly WallOpening[];
}): { placed: PlacedCabinet[]; removed: FillerAudit[] } {
  const removed = auditFillerPlacements(input);
  if (!removed.length) return { placed: [...input.placed], removed: [] };
  const drop = new Set(removed.map((entry) => entry.filler.uid));
  return { placed: input.placed.filter((item) => !drop.has(item.uid)), removed };
}

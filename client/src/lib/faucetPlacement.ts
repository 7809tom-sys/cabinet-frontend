import { COUNTERTOP_DEPTH_IN, STD, WALL_LABELS, wallCeilingMin, type RoomData, type SinkFixture, type WallOpening, type WallSide } from "./design";

/**
 * Deck faucets are mounted on the counter behind the sink. The 3D window is not
 * a flat hole: its casing, sill, and apron project into the room, and a faucet
 * parked on a shallow rear deck rises through that frame. These inch values
 * match the meshes in `addWallOpening` (that code builds the frame in feet).
 */
export const FAUCET_WINDOW_CONFLICT_MESSAGE =
  "The faucet stands in front of the window. That is expected: the window is not moved or resized for a faucet.";

/** CylinderGeometry(0.075, 0.095, 0.11) on the deck faucet, converted to inches. */
export const FAUCET_BASE_RADIUS_IN = 0.095 * 12;
export const FAUCET_BASE_HEIGHT_IN = 0.11 * 12;
/** Non-arc spout tube radius, in inches. The arc form is slightly thinner. */
export const FAUCET_RISER_RADIUS_IN = 0.032 * 12;
/** Elevation's generic riser, used when a faucet has no published height. */
export const DEFAULT_DECK_FAUCET_HEIGHT_IN = 8;
/** Field-tile thickness. Used when the rear deck can hold the faucet in front of it. */
export const FAUCET_BACKSPLASH_THICKNESS_IN = 0.375;
/** The rendered backsplash plane sits this far off the interior wall face. */
export const FAUCET_BACKSPLASH_PLANE_IN = 0.07;
export const FAUCET_WALL_CLEARANCE_IN = 0.125;
/** Keep the drawn spout from z-fighting the sill nose. */
export const FAUCET_FRAME_GAP_IN = 0.2;
/** Handle sits about 0.145 ft to the side of the base. */
export const FAUCET_LATERAL_REACH_IN = 0.145 * 12;

/** Casing and sill nose, measured from the finished wall face. */
export const WINDOW_TRIM_PROJECTION_IN = 0.5;
const AGAINST_WALL_IN = COUNTERTOP_DEPTH_IN + 3;
const EPS = 0.05;

export type FaucetWindowClearanceNote = {
  openingUid: string;
  text: string;
  severity: "warning";
};

export type FaucetWindowRaiseResult = {
  /** The openings, unchanged. A faucet never moves, raises, or resizes a window. */
  openings: WallOpening[];
  notes: FaucetWindowClearanceNote[];
  /** Never true now: nothing about a faucet is unresolved for a window. */
  unresolved: boolean;
  /** True when at least one sink's faucet stands in front of a window (expected). */
  inFrontOfWindow: boolean;
};

export type FaucetCountertop = {
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation?: number;
  raisedBar?: boolean;
  polygon?: readonly { x: number; y: number }[];
};

export type DeckFaucetPlacement = {
  /**
   * True when the faucet should be drawn. The mandatory rule (owner, Nov 5 2026) is
   * that a faucet in front of a window IS drawn: a sink under glazing is the normal
   * kitchen, so overlapping the window aperture is expected and never a reason to
   * hide or omit the faucet. Only a position that would sit inside the solid wall,
   * or off the counter, is not drawn.
   */
  renderFaucet: boolean;
  /** True when mountX/mountY are the deck anchor the 3D mesh should use. */
  anchored: boolean;
  /** Inches from the sink's rear rim toward the wall. Smaller means farther into the room. */
  offsetIn: number;
  centerFromWallIn: number;
  mountX: number;
  mountY: number;
  onCountertop: boolean;
  clearOfWall: boolean;
  againstWall: boolean;
  /**
   * Kept for diagnostics only. A sink under a window reports `"window-frame"` to say
   * "this faucet stands in front of glazing", which is expected. It never suppresses
   * the faucet and never changes the window.
   */
  conflict: "window-frame" | null;
  warning: string | null;
  /** True when the faucet stands in front of a window. Expected, not an error. */
  inFrontOfWindow: boolean;
};

export type SinkDragClamp = {
  x: number;
  y: number;
  blocked: boolean;
  warning: string | null;
};

const isCardinalWall = (side: string | undefined): side is WallSide =>
  side === "top" || side === "bottom" || side === "left" || side === "right";

/** Trim width in inches. `addWallOpening` stores the same measure in feet. */
export function windowTrimWidthIn(openingWidthIn: number): number {
  const widthFeet = Math.max(0, openingWidthIn) / 12;
  return Math.min(0.12, Math.max(0.055, widthFeet * 0.075)) * 12;
}

/** How far the sill / casing / apron projects into the room, and the elevation it occupies. */
export function windowFrameObstacle(opening: Pick<WallOpening, "kind" | "offset" | "width" | "height" | "sill">) {
  if (opening.kind !== "window") return null;
  const trimIn = windowTrimWidthIn(opening.width);
  return {
    alongStart: opening.offset - trimIn * 1.35,
    alongEnd: opening.offset + opening.width + trimIn * 1.35,
    intoRoomIn: WINDOW_TRIM_PROJECTION_IN,
    bottomIn: opening.sill - trimIn * 1.6,
    topIn: opening.sill + opening.height + trimIn,
  };
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return Math.min(a1, b1) - Math.max(a0, b0) > EPS;
}

function faucetHitsWindow(
  centerFromWall: number,
  along: number,
  heightIn: number,
  opening: WallOpening,
): boolean {
  const frame = windowFrameObstacle(opening);
  if (!frame) return false;
  const lateral = Math.max(FAUCET_BASE_RADIUS_IN, FAUCET_LATERAL_REACH_IN);
  if (!rangesOverlap(along - lateral, along + lateral, frame.alongStart, frame.alongEnd)) return false;
  const counter = STD.COUNTERTOP_HEIGHT;
  const riserHits = rangesOverlap(counter, counter + heightIn, frame.bottomIn, frame.topIn)
    && rangesOverlap(centerFromWall - FAUCET_RISER_RADIUS_IN, centerFromWall + FAUCET_RISER_RADIUS_IN, 0, frame.intoRoomIn);
  const baseHits = rangesOverlap(counter, counter + FAUCET_BASE_HEIGHT_IN, frame.bottomIn, frame.topIn)
    && rangesOverlap(centerFromWall - FAUCET_BASE_RADIUS_IN, centerFromWall + FAUCET_BASE_RADIUS_IN, 0, frame.intoRoomIn);
  return riserHits || baseHits;
}

function clearanceCenter(heightIn: number, openings: readonly WallOpening[]): number {
  let required = 0;
  const counter = STD.COUNTERTOP_HEIGHT;
  for (const opening of openings) {
    const frame = windowFrameObstacle(opening);
    if (!frame) continue;
    const riserReaches = rangesOverlap(counter, counter + heightIn, frame.bottomIn, frame.topIn);
    const baseReaches = rangesOverlap(counter, counter + FAUCET_BASE_HEIGHT_IN, frame.bottomIn, frame.topIn);
    if (riserReaches) required = Math.max(required, frame.intoRoomIn + FAUCET_RISER_RADIUS_IN + FAUCET_FRAME_GAP_IN);
    if (baseReaches) required = Math.max(required, frame.intoRoomIn + FAUCET_BASE_RADIUS_IN + FAUCET_FRAME_GAP_IN);
  }
  return required;
}

type Anchor = {
  wall: WallSide;
  along: number;
  rearEdge: number;
  againstWall: boolean;
};

function sinkAnchor(sink: SinkFixture, room: RoomData): Anchor | null {
  const wall = sink.wallSide;
  if (!isCardinalWall(wall)) return null;
  if (wall === "top") {
    return { wall, along: sink.x + sink.width / 2, rearEdge: sink.y, againstWall: sink.y <= AGAINST_WALL_IN };
  }
  if (wall === "bottom") {
    const rearEdge = room.depth - (sink.y + sink.depth);
    return { wall, along: sink.x + sink.width / 2, rearEdge, againstWall: rearEdge <= AGAINST_WALL_IN };
  }
  if (wall === "left") {
    return { wall, along: sink.y + sink.depth / 2, rearEdge: sink.x, againstWall: sink.x <= AGAINST_WALL_IN };
  }
  const rearEdge = room.width - (sink.x + sink.width);
  return { wall, along: sink.y + sink.depth / 2, rearEdge, againstWall: rearEdge <= AGAINST_WALL_IN };
}

function mountPoint(anchor: Anchor, room: RoomData, centerFromWall: number): { x: number; y: number } {
  if (anchor.wall === "top") return { x: anchor.along, y: centerFromWall };
  if (anchor.wall === "bottom") return { x: anchor.along, y: room.depth - centerFromWall };
  if (anchor.wall === "left") return { x: centerFromWall, y: anchor.along };
  return { x: room.width - centerFromWall, y: anchor.along };
}

function pointOnCountertop(x: number, y: number, surface: FaucetCountertop): boolean {
  if (surface.raisedBar) return false;
  const rotation = ((surface.rotation ?? 0) % 360 + 360) % 360;
  const cx = surface.x + surface.width / 2;
  const cy = surface.y + surface.depth / 2;
  const radians = (-rotation * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const localX = dx * Math.cos(radians) - dy * Math.sin(radians) + surface.width / 2;
  const localY = dx * Math.sin(radians) + dy * Math.cos(radians) + surface.depth / 2;
  if (surface.polygon && surface.polygon.length >= 3) {
    let inside = false;
    for (let index = 0, previous = surface.polygon.length - 1; index < surface.polygon.length; previous = index, index += 1) {
      const current = surface.polygon[index]!;
      const prior = surface.polygon[previous]!;
      const crosses = (current.y > localY) !== (prior.y > localY)
        && localX < ((prior.x - current.x) * (localY - current.y)) / ((prior.y - current.y) || EPS) + current.x;
      if (crosses) inside = !inside;
    }
    return inside;
  }
  return localX >= -EPS && localX <= surface.width + EPS && localY >= -EPS && localY <= surface.depth + EPS;
}

function onMeasuredCounter(x: number, y: number, countertops: readonly FaucetCountertop[]): boolean {
  return countertops.some((surface) => pointOnCountertop(x, y, surface));
}

function onWallBand(anchor: Anchor, room: RoomData, centerFromWall: number): boolean {
  const mount = mountPoint(anchor, room, centerFromWall);
  if (mount.x < -EPS || mount.y < -EPS || mount.x > room.width + EPS || mount.y > room.depth + EPS) return false;
  return centerFromWall >= -EPS && centerFromWall <= COUNTERTOP_DEPTH_IN + EPS;
}

function windowsOnWall(anchor: Anchor, along: number, openings: readonly WallOpening[]): WallOpening[] {
  const lateral = Math.max(FAUCET_BASE_RADIUS_IN, FAUCET_LATERAL_REACH_IN);
  return openings.filter((opening) => {
    if (opening.side !== anchor.wall || opening.kind !== "window") return false;
    const frame = windowFrameObstacle(opening);
    return frame != null && rangesOverlap(along - lateral, along + lateral, frame.alongStart, frame.alongEnd);
  });
}

function emptyPlacement(sink: SinkFixture, warning: string | null = null): DeckFaucetPlacement {
  return {
    renderFaucet: false,
    anchored: false,
    offsetIn: sink.faucetRearDeckOffsetIn ?? 1.25,
    centerFromWallIn: 0,
    mountX: sink.x + sink.width / 2,
    mountY: sink.y,
    onCountertop: false,
    clearOfWall: false,
    againstWall: false,
    conflict: warning ? "window-frame" : null,
    warning,
    inFrontOfWindow: false,
  };
}

/**
 * Places a deck faucet on the counter behind the sink, inset from the wall.
 *
 * Owner clarification (Nov 5 2026): **the faucet is at the sink, in front of the
 * window. The window never moves.** A sink under glazing is the normal kitchen, so
 * the faucet standing in front of the window aperture is EXPECTED. It is never
 * omitted for that reason, and no window coordinate changes for a faucet.
 *
 * Resolution order:
 *  1. Start at the sink's rear-deck datum, held off the backsplash plane.
 *  2. If a window is on that wall, move the faucet forward on the deck as far as the
 *     deck allows, so the spout clears the sill where it can. The window is not
 *     touched.
 *  3. If the deck runs out, keep the forward-most point that is still on the deck,
 *     behind the basin. `conflict` reports `"window-frame"` and `inFrontOfWindow` is
 *     true — diagnostics that the faucet stands in front of the glazing. The faucet
 *     is STILL DRAWN.
 *
 * Only a spot inside the solid wall, or off the counter, stops the draw.
 */
export function resolveDeckFaucetPlacement(
  sink: SinkFixture,
  room: RoomData,
  openings: readonly WallOpening[] = [],
  countertops: readonly FaucetCountertop[] = [],
): DeckFaucetPlacement {
  if (!sink.faucet) return emptyPlacement(sink);
  const anchor = sinkAnchor(sink, room);
  const requestedOffset = sink.faucetRearDeckOffsetIn ?? 1.25;
  if (!anchor) {
    return {
      ...emptyPlacement(sink),
      renderFaucet: true,
      anchored: false,
      onCountertop: true,
      clearOfWall: true,
    };
  }
  if (sink.faucetForm === "wall-mounted-bridge") {
    const centerFromWall = Math.max(0, anchor.rearEdge - requestedOffset);
    const mount = mountPoint(anchor, room, centerFromWall);
    return {
      renderFaucet: true,
      anchored: true,
      offsetIn: requestedOffset,
      centerFromWallIn: centerFromWall,
      mountX: mount.x,
      mountY: mount.y,
      onCountertop: true,
      clearOfWall: true,
      againstWall: anchor.againstWall,
      conflict: null,
      warning: null,
      inFrontOfWindow: false,
    };
  }

  const heightIn = sink.faucetOverallHeight ?? DEFAULT_DECK_FAUCET_HEIGHT_IN;
  let center = anchor.rearEdge - requestedOffset;
  if (anchor.againstWall) {
    const tileClearCenter = FAUCET_BACKSPLASH_THICKNESS_IN + FAUCET_WALL_CLEARANCE_IN + FAUCET_BASE_RADIUS_IN;
    const bowlClearCenter = anchor.rearEdge - FAUCET_BASE_RADIUS_IN;
    if (tileClearCenter <= bowlClearCenter + 0.02) center = Math.max(center, tileClearCenter);
    const planeClearCenter = FAUCET_BACKSPLASH_PLANE_IN + FAUCET_BASE_RADIUS_IN;
    if (center < planeClearCenter) center = Math.min(Math.max(planeClearCenter, center), Math.max(anchor.rearEdge, 0));
  }
  center = Math.min(center, Math.max(anchor.rearEdge, 0));

  // A window on this wall. The faucet may move forward on the deck to clear the sill;
  // the window itself is never read into a change.
  const hitting = anchor.againstWall ? windowsOnWall(anchor, anchor.along, openings) : [];
  let inFrontOfWindow = hitting.length > 0;
  let conflict: "window-frame" | null = null;
  if (hitting.length > 0 && hitting.some((opening) => faucetHitsWindow(center, anchor.along, heightIn, opening))) {
    const needed = clearanceCenter(heightIn, hitting);
    if (needed <= anchor.rearEdge + EPS) {
      // The deck is deep enough: forward enough to clear the sill, window untouched.
      center = Math.max(center, needed);
      inFrontOfWindow = true;
    } else {
      // The deck cannot clear the sill. Keep the forward-most point that is still on
      // the deck behind the basin and draw the faucet in front of the glazing — which
      // is what the owner asked for. The window does not move.
      center = Math.max(anchor.rearEdge, 0);
      conflict = "window-frame";
      inFrontOfWindow = true;
    }
  }

  if (anchor.againstWall && center - FAUCET_BASE_RADIUS_IN < FAUCET_BACKSPLASH_PLANE_IN - EPS) {
    center = Math.min(Math.max(anchor.rearEdge, 0), Math.max(center, FAUCET_BACKSPLASH_PLANE_IN + FAUCET_BASE_RADIUS_IN));
  }
  const clearOfWall = !anchor.againstWall || center - FAUCET_BASE_RADIUS_IN >= FAUCET_BACKSPLASH_PLANE_IN - EPS;
  const mount = mountPoint(anchor, room, center);
  const onCountertop = countertops.length > 0
    ? onMeasuredCounter(mount.x, mount.y, countertops)
    : !anchor.againstWall || onWallBand(anchor, room, center);
  // A faucet in front of a window is DRAWN. Only a position inside the solid wall or
  // off the counter stops the draw.
  const renderFaucet = clearOfWall && (anchor.againstWall ? onWallBand(anchor, room, center) || onCountertop : onCountertop);
  const offsetIn = anchor.rearEdge - center;
  return {
    renderFaucet,
    anchored: true,
    offsetIn: Math.max(0, offsetIn),
    centerFromWallIn: center,
    mountX: mount.x,
    mountY: mount.y,
    onCountertop,
    clearOfWall,
    againstWall: anchor.againstWall,
    conflict,
    warning: null,
    inFrontOfWindow,
  };
}


function formatRaiseInches(value: number): string {
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}



/**
 * Window rule (owner clarification, Nov 5 2026): **a window never moves for a
 * faucet.** No coordinate and no dimension — offset, width, sill, height — is
 * changed by a faucet, ever.
 *
 * The faucet is required to be at the sink, **in front of the window**. A sink under
 * glazing is the normal kitchen: the faucet standing in front of the window aperture
 * is expected, not a conflict to resolve. `resolveDeckFaucetPlacement` still moves the
 * faucet forward on the deck where it can, but when the deck cannot clear the sill the
 * faucet is drawn in front of the glazing rather than omitted or the window resized.
 *
 * This function is kept because every caller already routes through it, and it is
 * the single place that could have changed a window. It now returns the openings
 * untouched, always, and reports which sinks stand in front of a window.
 */
export function raiseWindowsForDeckFaucet(input: {
  sinks: readonly SinkFixture[];
  room: RoomData;
  openings: readonly WallOpening[];
  countertops?: readonly FaucetCountertop[];
  wallLabels?: Readonly<Record<string, string>>;
}): FaucetWindowRaiseResult {
  // The openings are returned as the SAME objects, in the same order, unchanged. A
  // window is never shortened, raised, or moved for a faucet.
  const countertops = input.countertops ?? [];
  let inFrontOfWindow = false;
  for (const sink of input.sinks) {
    if (!sink.faucet || sink.faucetForm === "wall-mounted-bridge") continue;
    if (resolveDeckFaucetPlacement(sink, input.room, input.openings, countertops).inFrontOfWindow) {
      inFrontOfWindow = true;
    }
  }
  return {
    openings: input.openings as WallOpening[],
    notes: [],
    unresolved: false,
    inFrontOfWindow,
  };
}

/**
 * No warning is raised for a faucet in front of a window: that is the required
 * arrangement, not a conflict. Kept so existing callers compile; always returns null.
 */
export function deckFaucetWindowWarning(
  _sinks: readonly SinkFixture[],
  _room: RoomData,
  _openings: readonly WallOpening[] = [],
  _countertops: readonly FaucetCountertop[] = [],
): string | null {
  return null;
}

/**
 * Keeps a dragged sink — and the faucet mounted on it — on the countertop and out
 * of the solid wall. Standing in front of a window does NOT block a move: a sink
 * under glazing is normal, and the window never moves.
 */
export function clampSinkDragForFaucet(
  sink: SinkFixture,
  proposed: { x: number; y: number },
  room: RoomData,
  openings: readonly WallOpening[] = [],
  countertops: readonly FaucetCountertop[] = [],
): SinkDragClamp {
  const x = Math.max(0, Math.min(proposed.x, Math.max(0, room.width - sink.width)));
  const y = Math.max(0, Math.min(proposed.y, Math.max(0, room.depth - sink.depth)));
  if (!sink.faucet || sink.faucetForm === "wall-mounted-bridge") {
    return { x, y, blocked: false, warning: null };
  }
  const current = resolveDeckFaucetPlacement(sink, room, openings, countertops);
  const next = resolveDeckFaucetPlacement({ ...sink, x, y }, room, openings, countertops);
  const leavesCounter = current.onCountertop && !next.onCountertop;
  const entersWall = next.againstWall && !next.clearOfWall;
  if (leavesCounter || entersWall) {
    return { x: sink.x, y: sink.y, blocked: true, warning: null };
  }
  return { x, y, blocked: false, warning: null };
}

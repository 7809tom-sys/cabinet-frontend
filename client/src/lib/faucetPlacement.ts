import { COUNTERTOP_DEPTH_IN, STD, WALL_LABELS, wallCeilingMin, type RoomData, type SinkFixture, type WallOpening, type WallSide } from "./design";

/**
 * Deck faucets are mounted on the counter behind the sink. The 3D window is not
 * a flat hole: its casing, sill, and apron project into the room, and a faucet
 * parked on a shallow rear deck rises through that frame. These inch values
 * match the meshes in `addWallOpening` (that code builds the frame in feet).
 */
export const FAUCET_WINDOW_CONFLICT_MESSAGE =
  "Faucet conflicts with the window sill. Shorten the window by raising the sill; the top stays put.";

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

const WINDOW_GROUP_INSET_IN = 0.06;
const WINDOW_TRIM_DEPTH_IN = 0.12 * 12;
const WINDOW_SILL_DEPTH_IN = 0.2 * 12;
const WINDOW_SILL_CENTER_IN = 0.12 * 12;
const AGAINST_WALL_IN = COUNTERTOP_DEPTH_IN + 3;
const EPS = 0.05;

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
  /** False when drawing the faucet would put it inside a wall or window frame. */
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
  conflict: "window-frame" | null;
  warning: string | null;
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
  const intoRoomIn = WINDOW_GROUP_INSET_IN + WINDOW_SILL_CENTER_IN + WINDOW_SILL_DEPTH_IN / 2;
  const trimFrontIn = WINDOW_GROUP_INSET_IN + WINDOW_TRIM_DEPTH_IN;
  return {
    alongStart: opening.offset - trimIn * 1.35,
    alongEnd: opening.offset + opening.width + trimIn * 1.35,
    intoRoomIn: Math.max(intoRoomIn, trimFrontIn),
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
  };
}

/**
 * Places a deck faucet on the counter behind the sink, inset from the wall.
 * When the spout or base would pass through a window frame, sill, or apron, the
 * faucet moves forward on that deck (a smaller rear offset). A faucet that
 * still cannot clear is not given a position inside the wall.
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

  const hitting = anchor.againstWall ? windowsOnWall(anchor, anchor.along, openings) : [];
  let conflict: "window-frame" | null = null;
  if (hitting.length > 0 && hitting.some((opening) => faucetHitsWindow(center, anchor.along, heightIn, opening))) {
    const needed = clearanceCenter(heightIn, hitting);
    if (needed <= anchor.rearEdge + EPS) {
      center = Math.max(center, needed);
    } else {
      // The forward-most point still on the deck, behind the basin.
      center = Math.max(anchor.rearEdge, 0);
      conflict = "window-frame";
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
  const renderFaucet = !conflict && clearOfWall;
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
    warning: conflict ? FAUCET_WINDOW_CONFLICT_MESSAGE : null,
  };
}

/** Same floor used by `clampOpening` so a raised window stays a real opening. */
const WINDOW_MIN_HEIGHT_IN = 6;

export type FaucetWindowClearanceNote = {
  openingUid: string;
  text: string;
  /**
   * Always "warning": a window is never changed for a sink unless it is the last resort, and
   * the person must see it. Callers show these as warnings, never as quiet info.
   */
  severity: "warning";
};

export type FaucetWindowRaiseResult = {
  openings: WallOpening[];
  notes: FaucetWindowClearanceNote[];
  /** True when a conflicting window could not be lifted clear of the ceiling. */
  unresolved: boolean;
};

function roundSillUpToHalfInch(value: number): number {
  const halves = value * 2;
  const nearest = Math.round(halves);
  if (Math.abs(halves - nearest) <= 1e-6) return nearest / 2;
  return Math.ceil(halves - 1e-9) / 2;
}

function formatRaiseInches(value: number): string {
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function faucetWindowLabel(opening: WallOpening, room: RoomData, wallLabels?: Readonly<Record<string, string>>): string {
  const custom = room.customWalls?.find((wall) => wall.id === opening.side)?.label?.trim();
  if (custom) return custom;
  const numbered = wallLabels?.[opening.side]?.trim();
  if (numbered) return numbered;
  const standard = (WALL_LABELS as Record<string, string | undefined>)[opening.side];
  return standard ? `${standard} wall` : opening.side;
}

/**
 * Minimum sill so the faucet top, plus the frame gap, sits below the sill,
 * casing, and apron. The apron hangs `trim * 1.6` below the sill.
 */
export function minimumFaucetClearSill(opening: Pick<WallOpening, "width">, faucetHeightIn: number): number {
  const apronBelowSill = windowTrimWidthIn(opening.width) * 1.6;
  return STD.COUNTERTOP_HEIGHT + faucetHeightIn + FAUCET_FRAME_GAP_IN + apronBelowSill;
}

/**
 * Window rule: Auto-Design never moves a window sideways and never raises it.
 * The only change allowed for a faucet is to shorten the window by lifting the
 * sill, with the top held exactly where it is. A window that moved because its
 * wall was raised is locked and is left alone. A window that cannot clear
 * without moving the top is left alone.
 *
 * Order of resolution, and this is the ONLY place a window may change for a sink:
 *  1. `resolveDeckFaucetPlacement` first moves the faucet forward on the deck. If the faucet clears
 *     (no `conflict`), the window is left exactly as it is, the same object, no note.
 *  2. Only when the faucet still cannot clear any other way, and only the window(s) the faucet
 *     actually hits, the sill is raised the minimum half-inch that clears it and the height shrinks
 *     by the same amount so the top does not move. A window that cannot clear without moving the
 *     top, or that is locked to its wall, is left alone.
 * Every change, and every case where a change was needed but impossible, comes back as a
 * `severity: "warning"` note that callers must show visibly.
 * Every caller (Auto-Design engine, DesignTool stage, sink adoption, faucet pickers) goes through
 * this function, so the rule is enforced in one place.
 */
export function raiseWindowsForDeckFaucet(input: {
  sinks: readonly SinkFixture[];
  room: RoomData;
  openings: readonly WallOpening[];
  countertops?: readonly FaucetCountertop[];
  wallLabels?: Readonly<Record<string, string>>;
}): FaucetWindowRaiseResult {
  let openings = [...input.openings];
  const notes: FaucetWindowClearanceNote[] = [];
  let unresolved = false;
  const countertops = input.countertops ?? [];

  for (const sink of input.sinks) {
    if (!sink.faucet || sink.faucetForm === "wall-mounted-bridge") continue;
    const anchor = sinkAnchor(sink, input.room);
    if (!anchor) continue;
    const heightIn = sink.faucetOverallHeight ?? DEFAULT_DECK_FAUCET_HEIGHT_IN;
    const placement = resolveDeckFaucetPlacement(sink, input.room, openings, countertops);
    if (!placement.conflict) continue;
    const hitting = windowsOnWall(anchor, anchor.along, openings)
      .filter((opening) => faucetHitsWindow(placement.centerFromWallIn, anchor.along, heightIn, opening));
    // Only a window the faucet actually hits may change; a neighbouring window that is clear stays put.
    const targets = hitting;
    if (targets.length === 0) {
      unresolved = true;
      continue;
    }
    for (const opening of targets) {
      const label = faucetWindowLabel(opening, input.room, input.wallLabels);
      const refused = (text: string) => {
        unresolved = true;
        notes.push({ openingUid: opening.uid, text, severity: "warning" as const });
        openings = openings.map((item) => item.uid === opening.uid ? { ...item, faucetClearanceNote: text } : item);
      };
      if (opening.wallHeightLocked) {
        refused(`Window on ${label} is locked to its wall, so it was not shortened for the faucet.`);
        continue;
      }
      const requiredSill = roundSillUpToHalfInch(minimumFaucetClearSill(opening, heightIn));
      const wallTop = wallCeilingMin(input.room, opening.side);
      // Never lift the head. If the saved head is already above this wall, hold it at the wall.
      const fixedTop = Math.min(opening.sill + opening.height, wallTop);
      const nextSill = Math.max(opening.sill, requiredSill);
      const nextHeight = fixedTop - nextSill;
      if (nextSill <= opening.sill + 1e-6 || nextHeight < WINDOW_MIN_HEIGHT_IN - 1e-6) {
        refused(`Window on ${label} was left where it is. The sill could not be raised enough for the faucet without moving the top.`);
        continue;
      }
      const candidate: WallOpening = { ...opening, sill: nextSill, height: nextHeight };
      if (Math.abs(candidate.sill + candidate.height - fixedTop) > 1e-6
        || faucetHitsWindow(placement.centerFromWallIn, anchor.along, heightIn, candidate)) {
        refused(`Window on ${label} was left where it is. The sill could not be raised enough for the faucet without moving the top.`);
        continue;
      }
      const delta = nextSill - opening.sill;
      const text = `Window on ${label}: sill raised ${formatRaiseInches(delta)} in. so the faucet clears it (new sill height ${formatRaiseInches(nextSill)} in.). The window was not raised or moved; the top stayed put. Window height is now ${formatRaiseInches(nextHeight)} in.`;
      notes.push({ openingUid: opening.uid, text, severity: "warning" });
      openings = openings.map((item) => item.uid === opening.uid ? { ...candidate, faucetClearanceNote: text } : item);
    }
  }

  return { openings: notes.length === 0 ? input.openings as WallOpening[] : openings, notes, unresolved };
}

export function deckFaucetWindowWarning(
  sinks: readonly SinkFixture[],
  room: RoomData,
  openings: readonly WallOpening[] = [],
  countertops: readonly FaucetCountertop[] = [],
): string | null {
  for (const sink of sinks) {
    const warning = resolveDeckFaucetPlacement(sink, room, openings, countertops).warning;
    if (warning) return warning;
  }
  return null;
}

/**
 * Keeps a dragged sink — and the faucet mounted on it — on the countertop and
 * out of the wall and window frame. A move that cannot be made valid stays at
 * the sink's current position.
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
  const entersWindow = next.conflict != null;
  if (leavesCounter || entersWall || entersWindow) {
    return {
      x: sink.x,
      y: sink.y,
      blocked: true,
      warning: entersWindow ? FAUCET_WINDOW_CONFLICT_MESSAGE : null,
    };
  }
  return { x, y, blocked: false, warning: null };
}

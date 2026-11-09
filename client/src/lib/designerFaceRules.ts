/**
 * Owner face rules the Designer applies to every Auto-Design kitchen.
 *
 *   Rule 5  a two-drawer base shows its drawers side by side, never stacked
 *   Rule 6  every kitchen has at least one single-door base
 *   Rule 7  adjacent single-door cabinets meet handles at the shared seam by default,
 *           and the user can still choose the hinge side
 *   Rule 9  windows are fixed height and never move; faucets outside the wall are ignored
 *   Rule 11 uppers hang at 54", tops land at 84/90/96 for 30/36/42" uppers
 *
 * These are pure over an already-built plan so the elevation, 3D and the review list all read
 * the same answer.
 */
import {
  STD,
  COLLISION_EPSILON_IN,
  cabinetWall,
  isFillerItem,
  isGlassDoorCabinet,
  isPanelItem,
  ordinaryWallMountBottom,
  overSinkOrRangeNeighborAlignedMountBottom,
  placedHeight,
  resolveSwing,
  wallRunOffset,
  wallRunSpan,
  type DoorSwing,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";
import { AUTO_DESIGN_FILLER_MAX_IN, autoDesignFillerMaxIn } from "./autoDesignSeamFillers";

/** Rule 11: the top line each upper height must land on. */
export function upperTopLineFor(heightIn: number): 84 | 90 | 96 | null {
  if (Math.abs(heightIn - 30) <= 0.01) return 84;
  if (Math.abs(heightIn - 36) <= 0.01) return 90;
  if (Math.abs(heightIn - 42) <= 0.01) return 96;
  return null;
}

/** Rule 11: the mount bottom that puts this upper's top on its 84/90/96 line. */
export function upperMountBottomFor(heightIn: number): number | null {
  const top = upperTopLineFor(heightIn);
  return top == null ? null : top - heightIn;
}

/** True when an upper is hung at the rule's 54" bottom (or its exact top line). */
export function upperHangsAtRuleHeight(item: PlacedCabinet): boolean {
  if (item.placement !== "wall" || isFillerItem(item) || isPanelItem(item)) return false;
  const height = placedHeight(item);
  const bottom = Number(item.mountBottom);
  const expectedBottom = upperMountBottomFor(height);
  if (expectedBottom != null && Number.isFinite(bottom)) {
    return Math.abs(bottom - expectedBottom) <= 0.01 || Math.abs(bottom - STD.WALL_MOUNT_BOTTOM) <= 0.01;
  }
  return Number.isFinite(bottom) ? Math.abs(bottom - STD.WALL_MOUNT_BOTTOM) <= 0.01 : true;
}

/** Rule 11: apply the 54" / 84-90-96 datum to every ordinary upper. */
export function normalizeUpperHeights(
  placed: readonly PlacedCabinet[],
  context?: { room: RoomData; openings?: readonly WallOpening[] },
): PlacedCabinet[] {
  const datum = upperHeightsOnDatum(placed);
  if (!context) return datum;
  // Tom's rule (Nov 8): an upper over the sink or range keeps its neighbour's
  // top line rather than the height-keyed datum, read from the re-hung run.
  return datum.map((item, index) => {
    const original = placed[index]!;
    if (original.mountBottomAdjusted || original.refrigeratorAssemblyRole === "bridge" || original.overRangeMicrowaveBridge === true) return item;
    const aligned = overSinkOrRangeNeighborAlignedMountBottom(item, datum, context.openings ?? [], context.room);
    if (aligned == null) return item;
    if (Number(original.mountBottom) === aligned) return original;
    return { ...original, mountBottom: aligned };
  });
}

function upperHeightsOnDatum(placed: readonly PlacedCabinet[]): PlacedCabinet[] {
  return placed.map((item) => {
    if (item.placement !== "wall" || isFillerItem(item) || isPanelItem(item)) return item;
    if (item.stackedOnCabinetUid) return item;
    // The cabinet above a refrigerator is height-ruled by its own bay: its top
    // lands on the running upper line and its bottom keeps the appliance
    // clearance. Re-hanging it here on the generic short-upper datum is what put
    // a 12 5/8-inch bridge's bottom at 71 3/8 — inside the two-inch clearance.
    if (item.refrigeratorAssemblyRole === "bridge") return item;
    // The mandatory bridge above the range hangs from the fixed 72" microwave
    // datum, not from the ordinary upper line. A frameless line stores that bridge
    // as 12⅝" or 17⅝" tall rather than 12/15/18", so the height-keyed rule below
    // used to shove it down to 66⅜" — a bridge floating below the microwave it
    // rests on, and a hole above the range. A bridge keeps its own datum.
    if (item.overRangeMicrowaveBridge === true) return item;
    const height = placedHeight(item);
    const bottom = upperMountBottomFor(height) ?? ordinaryWallMountBottom(item);
    if (Number(item.mountBottom) === bottom) return item;
    return { ...item, mountBottom: bottom };
  });
}

/** Rule 5: a two-drawer base is a drawer base whose fronts sit in one row. */
export function isTwoDrawerBase(item: PlacedCabinet): boolean {
  if (item.placement !== "base") return false;
  const code = `${item.masterCode ?? ""}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^2DB\d/.test(code) || /^2VDB\d/.test(code)) return true;
  return (item.numberOfDoors ?? 0) === 0 && (item.numberOfDrawers ?? 0) === 2;
}

/** Rule 5: the drawer-row contract for a two-drawer base, shared by every view. */
export function twoDrawerRowLayout(item: PlacedCabinet): { rows: Array<{ count: number; height: number }>; sideBySide: boolean } {
  if (!isTwoDrawerBase(item)) return { rows: [], sideBySide: false };
  return { rows: [{ count: 2, height: placedHeight(item) }], sideBySide: true };
}

/** A real single-door cabinet: exactly one hinged door, not a drawer box or an open cabinet. */
export function isSingleDoorBase(item: PlacedCabinet): boolean {
  if (item.placement !== "base") return false;
  if (isFillerItem(item) || isPanelItem(item)) return false;
  if ((item.numberOfDoors ?? 0) !== 1) return false;
  if ((item.numberOfDrawers ?? 0) > 1) return false;
  const code = `${item.masterCode ?? ""}`.toUpperCase();
  if (/^(?:2DB|3DB|2VDB|3VDB|DB|BD|VKD|VSD|SBF|CSB|DCB|CDB|BEC|BA)/.test(code)) return false;
  return true;
}

/** Rule 6: at least one single-door base in the whole kitchen. */
export function kitchenHasSingleDoorBase(placed: readonly PlacedCabinet[]): boolean {
  return placed.some(isSingleDoorBase);
}

/**
 * Rule 6: make the plan legal. Prefers the narrowest single-door base the line sells in place of
 * the narrowest plain double-door base of the same width, so nothing else moves. Returns the
 * plan unchanged plus a warning when the line sells no single-door base at all.
 */
export function ensureSingleDoorBase(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  /** Real straight base rows of the selected line. */
  catalog: readonly { masterCode?: string | null; description?: string | null; width?: string | number | null; id?: number }[];
  makeUid: () => string;
  styleId: number | null;
}): { placed: PlacedCabinet[]; added: PlacedCabinet | null; warning: string | null } {
  if (kitchenHasSingleDoorBase(input.placed)) return { placed: [...input.placed], added: null, warning: null };
  const widthOf = (value: string | number | null | undefined) => {
    const parsed = Number.parseFloat(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const singleDoors = input.catalog
    .filter((row) => /^B-?\d+$/i.test(`${row.masterCode ?? ""}`))
    // Only a row that is really a single door may stand in for a single-door base.
    .filter((row) => (row as { numberOfDoors?: number | null }).numberOfDoors !== 2)
    .map((row) => ({ row, width: widthOf(row.width) }))
    .filter((entry) => entry.width > 0 && entry.width <= 21)
    .sort((left, right) => left.width - right.width);
  if (!singleDoors.length) {
    return {
      placed: [...input.placed],
      added: null,
      warning: "This cabinet line sells no single-door base, so the kitchen has no single-door base. Add one by hand if you want it.",
    };
  }
  // Swap a plain double-door base of the same width so the run does not change length.
  const candidates = input.placed
    .filter((item) => item.placement === "base" && !isFillerItem(item) && !isPanelItem(item))
    .filter((item) => /^B-?\d+$/i.test(`${item.masterCode ?? ""}`))
    .filter((item) => (item.numberOfDoors ?? 0) >= 2)
    .sort((left, right) => (Number(left.width) || 0) - (Number(right.width) || 0));
  for (const target of candidates) {
    const match = singleDoors.find((entry) => Math.abs(entry.width - (Number(target.width) || 0)) <= 0.05);
    if (!match) continue;
    const replacement: PlacedCabinet = {
      ...target,
      uid: input.makeUid(),
      cabinetId: Number(match.row.id) || target.cabinetId,
      masterCode: String(match.row.masterCode ?? target.masterCode),
      description: String(match.row.description ?? target.description),
      numberOfDoors: 1,
      numberOfDrawers: Math.min(1, Number(target.numberOfDrawers) || 0),
      styleId: target.styleId ?? input.styleId,
    };
    return {
      placed: input.placed.map((item) => (item.uid === target.uid ? replacement : item)),
      added: replacement,
      warning: null,
    };
  }
  // No same-width swap: keep the plan and say so rather than silently resizing the run.
  return {
    placed: [...input.placed],
    added: null,
    warning: "No double-door base in this kitchen can become a single-door base at the same width, so no single-door base was added. Choose a narrower door base by hand.",
  };
}

/** Which side of a single-door cabinet its hinge is on, in plan terms. */
export type HingeSide = "left" | "right";

export function hingeSideOf(item: PlacedCabinet): HingeSide {
  return resolveSwing(item) === "right" ? "right" : "left";
}

/**
 * Rule 7: adjacent single-door cabinets meet their handles at the shared seam.
 *
 * Two single-door cabinets butted together default to a mirrored pair: the left cabinet hinges
 * left (handle on its right edge, at the seam) and the right cabinet hinges right (handle on its
 * left edge, at the seam). The user's explicit choice on either cabinet always wins.
 */
export function pairAdjacentSingleDoorHandles(input: {
  placed: readonly PlacedCabinet[];
  room: RoomData;
  /** Cabinet uid whose hinge the user set explicitly; left alone. */
  explicitHingeUids?: readonly string[];
}): { placed: PlacedCabinet[]; pairedUids: string[] } {
  const explicit = new Set(input.explicitHingeUids ?? []);
  const pairedUids: string[] = [];
  const byWall = new Map<string, PlacedCabinet[]>();
  for (const item of input.placed) {
    if (!isSingleDoorBase(item) || item.islandFace) continue;
    const wall = cabinetWall(item, input.room);
    const list = byWall.get(wall) ?? [];
    list.push(item);
    byWall.set(wall, list);
  }
  const nextSwing = new Map<string, DoorSwing>();
  for (const wall of Array.from(byWall.keys())) {
    const items = byWall.get(wall)!;
    const sorted = [...items].sort((left, right) => (
      wallRunOffset(left, wall, input.room) - wallRunOffset(right, wall, input.room)
    ));
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const left = sorted[index]!;
      const right = sorted[index + 1]!;
      const leftEnd = wallRunOffset(left, wall, input.room) + wallRunSpan(left, wall, input.room);
      const rightStart = wallRunOffset(right, wall, input.room);
      if (Math.abs(leftEnd - rightStart) > 0.05) continue;
      if (explicit.has(left.uid) && explicit.has(right.uid)) continue;
      if (!explicit.has(left.uid)) nextSwing.set(left.uid, "left");
      if (!explicit.has(right.uid)) nextSwing.set(right.uid, "right");
      if (!pairedUids.includes(left.uid)) pairedUids.push(left.uid);
      if (!pairedUids.includes(right.uid)) pairedUids.push(right.uid);
    }
  }
  if (!nextSwing.size) return { placed: [...input.placed], pairedUids: [] };
  return {
    placed: input.placed.map((item) => {
      const swing = nextSwing.get(item.uid);
      return swing && item.swing !== swing ? { ...item, swing } : item;
    }),
    pairedUids,
  };
}

/** Rule 9: windows never move and never change height. Only their position/height is reported. */
export function windowRuleViolations(input: {
  before: readonly WallOpening[];
  after: readonly WallOpening[];
}): string[] {
  const violations: string[] = [];
  for (const original of input.before.filter((opening) => opening.kind === "window")) {
    const current = input.after.find((opening) => opening.uid === original.uid);
    if (!current) {
      violations.push(`Window ${original.label ?? original.uid} was removed. Windows are fixed and never move.`);
      continue;
    }
    if (Math.abs(current.offset - original.offset) > 0.01 || current.side !== original.side) {
      violations.push(`Window ${original.label ?? original.uid} moved. Windows are fixed and never move.`);
    }
    if (Math.abs(current.height - original.height) > 0.01) {
      violations.push(`Window ${original.label ?? original.uid} changed height. Windows keep their measured height.`);
    }
  }
  return violations;
}

/** Rule 9: a faucet whose plan position is outside the room shell is ignored entirely. */
export function faucetInsideRoom(
  faucet: { x: number; y: number },
  room: RoomData,
): boolean {
  const tolerance = COLLISION_EPSILON_IN;
  return faucet.x >= -tolerance
    && faucet.y >= -tolerance
    && faucet.x <= room.width + tolerance
    && faucet.y <= room.depth + tolerance;
}

/**
 * Rule 9: the sink window is a fixed opening. A cabinet may only stop `clearance` short of it;
 * nothing about the build may move or resize it.
 */
export function upperStopsShortOfWindow(input: {
  cabinetStart: number;
  cabinetEnd: number;
  window: Pick<WallOpening, "offset" | "width">;
  clearance?: number;
}): boolean {
  const clearance = input.clearance ?? 3;
  return input.cabinetEnd <= input.window.offset - clearance + 0.01
    || input.cabinetStart >= input.window.offset + input.window.width + clearance - 0.01;
}

/** Rule 9 window clearance for uppers, in one place. */
export const UPPER_WINDOW_CLEARANCE_IN = 3;

/** Rule 9 + 3: filler may never be used to bridge a window opening. */
export function fillerWouldCrossWindow(input: {
  startIn: number;
  widthIn: number;
  window: Pick<WallOpening, "offset" | "width">;
}): boolean {
  const end = input.startIn + input.widthIn;
  return input.startIn < input.window.offset + input.window.width - 0.01
    && end > input.window.offset + 0.01;
}

/** True when a wall cabinet is a glass topper / stacker. */
export function isGlassTopper(item: PlacedCabinet): boolean {
  return isGlassDoorCabinet(item) && (item.stackedOnCabinetUid != null || /stack/i.test(`${item.description ?? ""} ${item.masterCode ?? ""}`));
}

/** Rule 12 + 3: the widest single filler Auto-Design will ever place. */
export const AUTO_DESIGN_MAX_FILLER_IN = AUTO_DESIGN_FILLER_MAX_IN;

/** Live cap: the widest single filler Auto-Design will place right now. */
export function autoDesignMaxFillerIn(): number {
  return autoDesignFillerMaxIn();
}

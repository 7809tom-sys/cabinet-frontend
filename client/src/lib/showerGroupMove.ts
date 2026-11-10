import type { PlacedFurniture, RoomData } from "./design";


/**
 * Moving a whole shower as one unit.
 *
 * A shower is not one object in the plan: it is a pan, a wall-panel set, a valve
 * and head, a niche or soap tray, and a glass door, each placed separately and
 * each owned by the same wizard step ("surround", "pan", "heads", "niche",
 * "door"). Tom asked to move the finished shower in one step instead of dragging
 * five pieces and hoping they stayed aligned.
 *
 * The rules here, and nowhere else:
 *
 *  1. GROUP MEMBERSHIP is `showerStepId`. Anything the Build Shower wizard placed
 *     belongs to the shower; a vanity, a toilet or a loose cabinet does not.
 *  2. A MOVE IS A RIGID TRANSLATION. Every member moves by the same delta, so the
 *     pan stays inside its surround, the door stays on the curb line, and the
 *     valve stays centred over the pan. Nothing is resized, rotated or re-fitted.
 *  3. THE GROUP STAYS INSIDE THE ROOM. A delta that would push any member through
 *     a wall is reduced to the largest one that keeps every member inside, so a
 *     drag can never leave the shower half in the next room.
 *
 * Nothing here reads or writes the cart or a price. A move changes only x and y,
 * which are placement coordinates, so the bill is untouched by construction.
 */

/** The minimum a placed part must carry to be part of a shower. */
export type ShowerPartIdentity = Pick<PlacedFurniture, "uid"> & {
  showerStepId?: PlacedFurniture["showerStepId"];
};

/** The shower steps the wizard owns. Kept as a list so membership is explicit. */
const SHOWER_STEPS = ["surround", "pan", "heads", "niche", "door"] as const;

export function isShowerPart(part: ShowerPartIdentity): boolean {
  return part.showerStepId != null && (SHOWER_STEPS as readonly string[]).includes(part.showerStepId);
}

/**
 * Every part of the shower an object belongs to, including that object.
 *
 * Selecting any one part selects the whole shower, which is what lets the user
 * drag one piece and move the rest with it.
 */
export function showerGroupMembers(
  furniture: readonly PlacedFurniture[],
  uid: string | null | undefined,
): PlacedFurniture[] {
  if (!uid) return [];
  const selected = furniture.find((item) => item.uid === uid);
  if (!selected || !isShowerPart(selected)) return [];
  return furniture.filter(isShowerPart);
}

/** A group that can be moved, with the box it occupies in the plan. */
export type ShowerGroupBox = {
  uids: string[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** The plan-space box around every member of the shower. */
export function showerGroupBox(members: readonly PlacedFurniture[]): ShowerGroupBox | null {
  if (members.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const member of members) {
    // The frame's bound extents are the drawn, rotation-aware footprint — what the
    // user sees and what has to stay inside the walls. A member whose definition is
    // missing contributes nothing rather than skewing the box.
    const extent = placedExtent(member);
    minX = Math.min(minX, extent.left);
    minY = Math.min(minY, extent.top);
    maxX = Math.max(maxX, extent.left + extent.width);
    maxY = Math.max(maxY, extent.top + extent.depth);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { uids: members.map((member) => member.uid), minX, minY, maxX, maxY };
}

/**
 * The largest part of a requested move that keeps the whole group in the room.
 *
 * Requesting `dx = 40` into a wall 12" away moves 12", not 40 and not 0, so a
 * drag against the wall slides along it instead of stopping dead or escaping.
 */
export function clampShowerMove(
  box: ShowerGroupBox | null,
  dx: number,
  dy: number,
  room: Pick<RoomData, "width" | "depth">,
): { dx: number; dy: number } {
  if (!box) return { dx: 0, dy: 0 };
  // Positive dx moves right, so the right-hand wall limits it to the gap between
  // the box's right edge and the wall; negative dx is limited by the left gap.
  const maxRight = Math.max(0, room.width - box.maxX);
  const maxLeft = Math.max(0, box.minX);
  const clampedX = dx >= 0 ? Math.min(dx, maxRight) : Math.max(dx, -maxLeft);

  const maxDown = Math.max(0, room.depth - box.maxY);
  const maxUp = Math.max(0, box.minY);
  const clampedY = dy >= 0 ? Math.min(dy, maxDown) : Math.max(dy, -maxUp);

  return { dx: round(clampedX), dy: round(clampedY) };
}

/**
 * Move every part of the shower by the same delta.
 *
 * Returns the new furniture list. Untouched parts keep their exact object identity
 * so React and the 3D scene do not re-create them; only coordinates change, which
 * is what keeps the cart, the price and the geometry identical.
 */
export function moveShowerGroup(
  furniture: readonly PlacedFurniture[],
  uids: readonly string[],
  dx: number,
  dy: number,
): PlacedFurniture[] {
  if (dx === 0 && dy === 0) return furniture as PlacedFurniture[];
  const moving = new Set(uids);
  return furniture.map((item) => (
    moving.has(item.uid) ? { ...item, x: round(item.x + dx), y: round(item.y + dy) } : item
  ));
}

/**
 * Apply a requested move to the shower that owns `uid`, clamped to the room.
 *
 * This is the one entry point the designer calls for both the arrow buttons and a
 * drag, so the two can never disagree about what a legal move is.
 */
export function applyShowerMove(
  furniture: readonly PlacedFurniture[],
  uid: string,
  dx: number,
  dy: number,
  room: Pick<RoomData, "width" | "depth">,
): { furniture: PlacedFurniture[]; moved: boolean; dx: number; dy: number } {
  const members = showerGroupMembers(furniture, uid);
  if (members.length === 0) return { furniture: furniture as PlacedFurniture[], moved: false, dx: 0, dy: 0 };
  const box = showerGroupBox(members);
  const delta = clampShowerMove(box, dx, dy, room);
  if (delta.dx === 0 && delta.dy === 0) {
    return { furniture: furniture as PlacedFurniture[], moved: false, dx: 0, dy: 0 };
  }
  return {
    furniture: moveShowerGroup(furniture, box!.uids, delta.dx, delta.dy),
    moved: true,
    dx: delta.dx,
    dy: delta.dy,
  };
}

/**
 * Does this shower still fit the room it is in?
 *
 * The move clamp keeps a shower inside when it starts inside, but a shower can be
 * loaded from a saved design into a smaller room. The nudge buttons use this to
 * say why they are disabled rather than silently doing nothing.
 */
export function showerFitsRoom(
  members: readonly PlacedFurniture[],
  room: Pick<RoomData, "width" | "depth">,
): boolean {
  const box = showerGroupBox(members);
  if (!box) return true;
  return box.minX >= -0.01 && box.minY >= -0.01 && box.maxX <= room.width + 0.01 && box.maxY <= room.depth + 0.01;
}


/**
 * The drawn extent of one placement, in plan inches.
 *
 * Shower parts are Pelican catalog products placed through `showerStepId`, so
 * their ids are not in `FURNITURE_CATALOG`; `furniturePlanFrame` would return
 * null for every one of them. The placement itself carries the measured envelope
 * (`width`/`depth`, or the profile's `widthIn`/`depthIn`), and a quarter turn
 * swaps the two axes exactly as the plan draws it.
 */
function placedExtent(member: PlacedFurniture): { left: number; top: number; width: number; depth: number } {
  const raw = member as PlacedFurniture & {
    width?: number | null;
    depth?: number | null;
    widthIn?: number | null;
    depthIn?: number | null;
  };
  const width = Number(raw.width ?? raw.widthIn ?? 0) || Number(raw.depth ?? raw.depthIn ?? 0) || 1;
  const depth = Number(raw.depth ?? raw.depthIn ?? 0) || width;
  const quarter = ((member.rotation % 360) + 360) % 360;
  const swapped = quarter === 90 || quarter === 270;
  const boundW = swapped ? depth : width;
  const boundD = swapped ? width : depth;
  // `x`/`y` locate the rotated bounding box, so the extent starts at the placement.
  return { left: member.x, top: member.y, width: boundW, depth: boundD };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

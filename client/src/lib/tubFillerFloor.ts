/**
 * Floor-space rule for a freestanding tub faucet (a floor-mounted tub filler).
 *
 * A tub filler is not an ordinary floor body. Every other fixture owns its
 * footprint and may not intersect another, but a filler has to stand beside the
 * tub and reach *over* the rim: Pelican's published spout reach is only 6½ to
 * 8⅞ inches, so a filler held a footprint away pours onto the floor.
 *
 * This module is the single place that rule lives. It answers one question for
 * every caller — placement, dragging, rotating, and collision — instead of the
 * generic collision code carrying tub-filler exceptions.
 *
 * The rule, in order:
 *  1. A filler may share the tub's floor envelope. Nothing else: it may not
 *     intersect a vanity, cabinet, toilet, or any other floor body.
 *  2. Its column must stand clear of the tub's shell (the column is 2.45 inches
 *     behind the footprint centre, matching the mesh).
 *  3. Its spout outlet — reach inches forward of the column — must land inside
 *     the tub opening, inset from the rim, so water goes in the basin.
 *
 * The 14-inch occupancy is illustrative: it is not a manufacturer clearance and
 * not a verified rough-in. The reach and outlet position are the published
 * numbers, which is why they, not the square, decide the rule.
 */
import {
  COLLISION_EPSILON_IN,
  FURNITURE_CATALOG,
  furnitureFootprint,
  type PlacedFurniture,
  type RoomData,
} from "./design";
import { verifiedPelicanBathroomFixtureProfile } from "./pelicanBathroomFixtureProfiles";

/**
 * Floor rectangles and overlap, kept here so this module has no import cycle
 * with `floorOccupancy`, which calls the rule below.
 */
export type TubFloorRect = { uid: string; x: number; y: number; w: number; d: number; label: string };

function rectsOverlap(a: TubFloorRect | { x: number; y: number; w: number; d: number }, b: { x: number; y: number; w: number; d: number }): boolean {
  return a.x < b.x + b.w - COLLISION_EPSILON_IN
    && a.x + a.w > b.x + COLLISION_EPSILON_IN
    && a.y < b.y + b.d - COLLISION_EPSILON_IN
    && a.y + a.d > b.y + COLLISION_EPSILON_IN;
}

function insideRoom(rect: { x: number; y: number; w: number; d: number }, room: Pick<RoomData, "width" | "depth">): boolean {
  return rect.x >= -COLLISION_EPSILON_IN && rect.y >= -COLLISION_EPSILON_IN
    && rect.x + rect.w <= room.width + COLLISION_EPSILON_IN
    && rect.y + rect.d <= room.depth + COLLISION_EPSILON_IN;
}

/** The column stands 2.45" behind the footprint centre (see pelicanTubFillerMesh). */
export const TUB_FILLER_COLUMN_OFFSET_IN = 2.45;
/** A conservative reach when a sheet states none. */
const TUB_FILLER_DEFAULT_REACH_IN = 7;

export type TubFillerBody = { x: number; y: number; w: number; d: number; rotation: number };

function profileFor(item: PlacedFurniture | null | undefined) {
  if (!item) return null;
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === item.defId);
  return verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? definition?.pelicanCode);
}

/** True when this item is a floor-mounted tub filler. */
export function isTubFillerFurniture(item: PlacedFurniture | null | undefined): boolean {
  return profileFor(item)?.kind === "floor-tub-filler";
}

/** True when this item is a bathtub whose bowl a filler may reach over. */
export function isTubFurniture(item: PlacedFurniture | null | undefined): boolean {
  const kind = profileFor(item)?.kind;
  return kind === "freestanding-tub" || kind === "alcove-tub";
}

/** Source-stated spout reach, or a conservative 7 inches when the sheet has none. */
export function tubFillerSpoutReachIn(
  profile: { tubFillerSpoutReachIn?: number | null } | null | undefined,
): number {
  const reach = profile?.tubFillerSpoutReachIn;
  return typeof reach === "number" && Number.isFinite(reach) && reach > 0
    ? Math.min(Math.max(reach, 3), 9)
    : TUB_FILLER_DEFAULT_REACH_IN;
}

/** The reach this placed filler is drawn with. */
export function tubFillerReachFor(item: PlacedFurniture): number {
  return tubFillerSpoutReachIn(profileFor(item));
}

function columnRectFor(body: TubFillerBody, uid = ""): TubFloorRect {
  const size = 4;
  const cx = body.x + body.w / 2;
  const cy = body.y + body.d / 2;
  const rotation = ((body.rotation % 360) + 360) % 360;
  // The column sits toward the back (local +Z), opposite the spout.
  const dx = rotation === 90 ? TUB_FILLER_COLUMN_OFFSET_IN : rotation === 270 ? -TUB_FILLER_COLUMN_OFFSET_IN : 0;
  const dy = rotation === 0 ? TUB_FILLER_COLUMN_OFFSET_IN : rotation === 180 ? -TUB_FILLER_COLUMN_OFFSET_IN : 0;
  return { uid: `${uid}:column`, x: cx + dx - size / 2, y: cy + dy - size / 2, w: size, d: size, label: "filler column" };
}

/** The spout outlet: `reach` inches forward of the column, along the filler's facing. */
export function tubFillerSpoutTip(body: TubFillerBody, reachIn: number): { x: number; y: number } {
  const column = columnRectFor(body);
  const cx = column.x + column.w / 2;
  const cy = column.y + column.d / 2;
  const reach = Math.max(0, reachIn);
  const rotation = ((body.rotation % 360) + 360) % 360;
  return {
    x: cx + (rotation === 90 ? -reach : rotation === 270 ? reach : 0),
    y: cy + (rotation === 0 ? -reach : rotation === 180 ? reach : 0),
  };
}

/** The tub opening, inset from the shell so the column clears the tub wall. */
export function tubBowlInnerRect(tub: TubFloorRect): TubFloorRect {
  const insetX = Math.min(3.5, tub.w * 0.12);
  const insetY = Math.min(3.5, tub.d * 0.12);
  return {
    uid: `${tub.uid}:bowl`,
    x: tub.x + insetX,
    y: tub.y + insetY,
    w: Math.max(4, tub.w - insetX * 2),
    d: Math.max(4, tub.d - insetY * 2),
    label: "tub bowl",
  };
}

/**
 * Whether this filler position obeys the tub-filler rule.
 *
 * `others` is the rest of the occupied floor, already excluding this filler; the
 * tub's own rectangle is allowed to intersect, every other body is not.
 */
export function tubFillerPlacementFits(input: {
  body: TubFillerBody;
  reachIn: number;
  tub: TubFloorRect;
  others: readonly TubFloorRect[];
  room: Pick<RoomData, "width" | "depth">;
}): boolean {
  const { body, reachIn, tub, others, room } = input;
  if (!insideRoom(body, room)) return false;
  const rect: TubFloorRect = { uid: "", ...body, label: "" };
  if (others.some((other) => other.uid !== tub.uid && rectsOverlap(rect, other))) return false;
  if (rectsOverlap(columnRectFor(body), tub)) return false;
  const tip = tubFillerSpoutTip(body, reachIn);
  const bowl = tubBowlInnerRect(tub);
  return tip.x >= bowl.x && tip.x <= bowl.x + bowl.w
    && tip.y >= bowl.y && tip.y <= bowl.y + bowl.d;
}

/**
 * May this filler's footprint stay where it is while sharing `other`?
 *
 * This is the one predicate the generic collision code asks, so dragging and
 * rotating a filler follow the same rule as placing it.
 */
export function tubFillerMayShareFloorWith(input: {
  filler: PlacedFurniture;
  other: TubFloorRect;
  furniture: readonly PlacedFurniture[];
}): boolean {
  if (!isTubFillerFurniture(input.filler)) return false;
  const otherItem = input.furniture.find((entry) => entry.uid === input.other.uid);
  return isTubFurniture(otherItem);
}

/** The tub the filler should serve: the last tub already in the room. */
function latestTubRect(
  furniture: readonly PlacedFurniture[],
  occupied: readonly TubFloorRect[],
): TubFloorRect | null {
  const reversed = [...furniture].reverse();
  for (const item of reversed) {
    if (!isTubFurniture(item)) continue;
    const rect = occupied.find((body) => body.uid === item.uid);
    if (rect) return rect;
  }
  return null;
}

/**
 * Place a floor-mounted tub filler so its spout reaches the tub.
 *
 * `occupied` is the rest of the floor, excluding this filler. With no tub in the
 * room there is nothing to reach, so the filler goes to the nearest clear spot.
 * With a tub, every side is tried at one-inch steps into the rim; the position
 * that overlaps the tub least while still reaching the bowl wins. Returns null
 * when no position satisfies the rule.
 */
export function placeTubFiller(
  filler: PlacedFurniture,
  furniture: readonly PlacedFurniture[],
  room: Pick<RoomData, "width" | "depth">,
  occupied: readonly TubFloorRect[],
): PlacedFurniture | null {
  const definition = FURNITURE_CATALOG.find((entry) => entry.id === filler.defId);
  if (!definition || !isTubFillerFurniture(filler)) return null;
  const footprint = furnitureFootprint(filler, definition);
  const w = footprint.w;
  const d = footprint.d;
  const reach = tubFillerReachFor(filler);
  const tub = latestTubRect(furniture, occupied);

  if (!tub) {
    const centered = { x: (room.width - w) / 2, y: (room.depth - d) / 2 };
    const body: TubFillerBody = { ...centered, w, d, rotation: 0 };
    if (insideRoom(body, room) && !occupied.some((other) => rectsOverlap({ uid: filler.uid, ...body, label: "" }, other))) {
      return { ...filler, ...centered, rotation: 0 };
    }
    return null;
  }

  // `dx`/`dy` is the direction the spout pours, so the filler stands on the
  // opposite side of the tub and reaches back over the rim.
  const directions = [
    { rotation: 0 as const, dx: 0, dy: -1 },
    { rotation: 180 as const, dx: 0, dy: 1 },
    { rotation: 90 as const, dx: -1, dy: 0 },
    { rotation: 270 as const, dx: 1, dy: 0 },
  ];
  const overlapLimit = Math.min(Math.max(w, d), reach + TUB_FILLER_COLUMN_OFFSET_IN + 6);
  const candidates: TubFillerBody[] = [];
  for (const { rotation, dx, dy } of directions) {
    for (let overlap = 0; overlap <= overlapLimit; overlap += 1) {
      const x = dx === 0 ? tub.x + (tub.w - w) / 2
        : dx === -1 ? tub.x + tub.w - overlap
          : tub.x - w + overlap;
      const y = dy === -1 ? tub.y + tub.d - overlap
        : dy === 1 ? tub.y - d + overlap
          : tub.y + (tub.d - d) / 2;
      candidates.push({ x, y, w, d, rotation });
    }
  }

  const overlapArea = (body: TubFillerBody) => Math.max(0, Math.min(body.y + d, tub.y + tub.d) - Math.max(body.y, tub.y))
    * Math.max(0, Math.min(body.x + w, tub.x + tub.w) - Math.max(body.x, tub.x));
  let best: TubFillerBody | null = null;
  for (const body of candidates) {
    if (!tubFillerPlacementFits({ body, reachIn: reach, tub, others: occupied, room })) continue;
    if (!best || overlapArea(body) < overlapArea(best) - 1e-6) best = body;
  }
  if (best) {
    return { ...filler, x: Math.max(0, best.x), y: Math.max(0, best.y), rotation: best.rotation };
  }
  // Nothing reaches the bowl cleanly. Do not leave the filler on top of another
  // floor body; return null so the caller can say so.
  return null;
}

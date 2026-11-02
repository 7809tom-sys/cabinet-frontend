/**
 * Rule: nothing past a wall or room bound. Every cabinet body, filler and panel an Auto-Design
 * build adds must sit inside the run it was measured on and inside the drawn room shell.
 *
 * Three separate bugs used to let pieces escape:
 *   - `appendCollisionFreePlacements` never asked whether the body was inside the room;
 *   - `wallPlacementAt` clamps an along-wall start but happily lets a cabinet hang past the wall
 *     end when the requested span does not fit;
 *   - a U-shape added a run on a fourth wall that is not part of the kitchen.
 *
 * This module owns the one containment test the build uses to reject a candidate.
 */
import {
  COLLISION_EPSILON_IN,
  cabinetWall,
  placedInsideDrawnRoom,
  wallPlacementAt,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";

/** True when the whole body sits inside the room shell (drawn polygon, or the bounding room). */
export function cabinetInsideRoom(item: PlacedCabinet, room: RoomData): boolean {
  if (item.islandFace) return true;
  return placedInsideDrawnRoom(item, room);
}

/**
 * True when the body sits wholly inside its own wall run: it starts at or after the run start and
 * ends at or before the run end. A body with no wall run is judged by the room shell only.
 */
export function cabinetInsideWallRun(item: PlacedCabinet, room: RoomData): boolean {
  if (item.islandFace) return true;
  const wall = cabinetWall(item, room);
  const frame = wallRunFrame(wall, room);
  if (!frame) return true;
  const along = wallRunOffset(item, wall, room);
  const span = wallRunSpan(item, wall, room);
  if (!(span > 0)) return true;
  return along >= frame.runStart - COLLISION_EPSILON_IN
    && along + span <= frame.runEnd + COLLISION_EPSILON_IN;
}

/**
 * The one containment gate. A candidate that leaves the room shell or its wall run is rejected
 * before it can be committed, so a too-wide cabinet can never hang past a wall end and a body can
 * never be pushed outside a drawn room.
 */
export function cabinetInsideBounds(item: PlacedCabinet, room: RoomData): boolean {
  return cabinetInsideWallRun(item, room) && cabinetInsideRoom(item, room);
}

/**
 * True when a cabinet of `width` starting at `along` fits the run without hanging past either end.
 * `wallPlacementAt` clamps the start, so a caller that only checked its return value could still
 * hang the box off the end of the wall.
 */
export function spanFitsWallRun(
  along: number,
  width: number,
  wallId: string,
  room: RoomData,
): boolean {
  const frame = wallRunFrame(wallId, room);
  if (!frame) return false;
  return width > 0
    && along >= frame.runStart - COLLISION_EPSILON_IN
    && along + width <= frame.runEnd + COLLISION_EPSILON_IN;
}

/**
 * Seats a body on its run only when the whole span fits, otherwise returns null. Use this in
 * place of `wallPlacementAt` anywhere a width may be wider than the remaining wall.
 */
export function boundedWallPlacementAt(
  along: number,
  width: number,
  depth: number,
  wallId: string,
  room: RoomData,
): ReturnType<typeof wallPlacementAt> | null {
  if (!spanFitsWallRun(along, width, wallId, room)) return null;
  const spot = wallPlacementAt(along, width, depth, wallId as never, room);
  if (!spot) return null;
  if (!spanFitsWallRun(spot.wallOffset ?? along, width, spot.wallId ?? wallId, room)) return null;
  return spot;
}

/**
 * Walls a U-shape may receive cabinets on: Wall 1–3, plus Wall 4 only when the room really has a
 * fourth wall. A U never grows a run on a wall that is not part of the kitchen.
 */
export function uShapeRunWallLabels(hasWall4: boolean): readonly string[] {
  return hasWall4 ? ["Wall 1", "Wall 2", "Wall 3", "Wall 4"] : ["Wall 1", "Wall 2", "Wall 3"];
}

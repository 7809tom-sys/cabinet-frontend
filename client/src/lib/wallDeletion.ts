import type { PlacedCabinet, RoomData } from "@/lib/design";
import { cabinetWall, peninsulaRunAssemblyLocked, type PeninsulaRun } from "@/lib/design";
import { deleteCustomWallSegment } from "@/lib/polygonRoom";

/** Shown when a drawn room would have no walls left. */
export const LAST_WALL_DELETE_REASON = "The last remaining wall cannot be deleted. Start a new room layout instead.";
/** A width/depth rectangle always has four sides. Removing one is not a supported room. */
export const CARDINAL_WALL_DELETE_REASON = "A rectangular room keeps all four walls. Delete an added wall, or start a new room layout.";
/** A wall locked onto this one would be left without its host. */
export const HOSTED_WALL_DELETE_REASON = "Another wall is attached to this one. Delete that wall first so the room stays intact.";
/** Peninsula deletion also removes every return connected to the run. */
export const PENINSULA_RETURN_DELETE_REASON = "A return is connected to this wall. Delete the return first so only this wall is removed.";
export const LAYOUT_LOCKED_DELETE_REASON = "Unlock the room layout before deleting a wall.";
export const PENINSULA_LOCKED_DELETE_REASON = "Unlock this peninsula before deleting a run or connected return.";
export const CABINETS_LOCKED_DELETE_REASON = "Unlock cabinets before deleting this peninsula.";
export const MISSING_WALL_DELETE_REASON = "This wall is no longer on the plan.";

const CARDINAL_WALL_IDS = new Set(["top", "bottom", "left", "right"]);

export type WallDeletionRoom = Pick<RoomData, "customWalls" | "preserveCardinalWalls" | "peninsulaRuns" | "vertices">;

function peninsulaById(room: WallDeletionRoom, wallId: string): PeninsulaRun | null {
  return room.peninsulaRuns?.find((run) => run.id === wallId) ?? null;
}

/**
 * Why Delete wall must stay disabled. A null reason means this wall can go
 * through the existing confirm. Locks are included only when the caller passes
 * them, so the wall-settings button keeps its previous structural checks.
 */
export function wallDeleteDisabledReason(input: {
  room: WallDeletionRoom;
  wallId: string;
  layoutLocked?: boolean;
  cabinetsLocked?: boolean;
}): string | null {
  const wallId = input.wallId;
  const customWalls = input.room.customWalls ?? [];
  const custom = customWalls.find((wall) => wall.id === wallId) ?? null;
  const peninsula = peninsulaById(input.room, wallId);
  const cardinal = CARDINAL_WALL_IDS.has(wallId);
  if (!custom && !peninsula && !cardinal) return MISSING_WALL_DELETE_REASON;
  if (!custom && !peninsula && cardinal) return CARDINAL_WALL_DELETE_REASON;

  if (custom && customWalls.some((wall) => wall.id !== wallId && wall.hostWallId === wallId)) {
    return HOSTED_WALL_DELETE_REASON;
  }
  if (custom && !input.room.preserveCardinalWalls && customWalls.length <= 1) {
    return LAST_WALL_DELETE_REASON;
  }
  if (peninsula && (input.room.peninsulaRuns ?? []).some((run) => run.parentRunId === wallId)) {
    return PENINSULA_RETURN_DELETE_REASON;
  }

  if (input.layoutLocked) return LAYOUT_LOCKED_DELETE_REASON;
  if (peninsula && peninsulaRunAssemblyLocked(peninsula, { peninsulaRuns: input.room.peninsulaRuns })) {
    return PENINSULA_LOCKED_DELETE_REASON;
  }
  if (peninsula && input.cabinetsLocked) return CABINETS_LOCKED_DELETE_REASON;
  return null;
}

/** Cabinets, appliances, and fillers are all placed cabinets owned by one wall. */
export function countCabinetsOnWall(placed: readonly PlacedCabinet[], room: RoomData, wallId: string): number {
  return placed.filter((cabinet) => cabinetWall(cabinet, room) === wallId).length;
}

function withoutDimensionMemory(room: RoomData, wallId: string, openingUids: readonly string[]): RoomData {
  const adjustments = room.dimensionAdjustments;
  if (!adjustments) return room;
  const openingKeys = new Set(openingUids.map((uid) => `opening:${uid}`));
  let changed = false;
  const next: NonNullable<RoomData["dimensionAdjustments"]> = {};
  for (const [key, value] of Object.entries(adjustments)) {
    const belongsToWall = key === `wall:${wallId}`
      || key.startsWith(`run:${wallId}:`)
      || key.startsWith(`available:${wallId}:`)
      || openingKeys.has(key);
    if (belongsToWall) {
      changed = true;
      continue;
    }
    next[key] = value;
  }
  if (!changed) return room;
  return { ...room, dimensionAdjustments: Object.keys(next).length > 0 ? next : undefined };
}

function withoutWallMemories(room: RoomData, wallId: string, openingUids: readonly string[]): RoomData {
  let next = withoutDimensionMemory(room, wallId, openingUids);
  const suppressions = next.deletedFillerSuppressions;
  if (suppressions?.some((record) => record.wallId === wallId)) {
    const remaining = suppressions.filter((record) => record.wallId !== wallId);
    next = { ...next, deletedFillerSuppressions: remaining.length > 0 ? remaining : undefined };
  }
  if (next.wallCeilings && Object.prototype.hasOwnProperty.call(next.wallCeilings, wallId)) {
    const ceilings = { ...next.wallCeilings };
    delete (ceilings as Record<string, unknown>)[wallId];
    next = { ...next, wallCeilings: ceilings };
  }
  return next;
}

/**
 * Remove one drawn or added wall. Every other wall keeps its endpoints,
 * length, height, and label. A wall added onto a rectangular room does not
 * resize that room. Returns null when the deletion would leave no room.
 */
export function deleteHighlightedCustomWall(
  room: RoomData,
  wallId: string,
  openingUids: readonly string[] = [],
): RoomData | null {
  const customWalls = room.customWalls ?? [];
  const wall = customWalls.find((candidate) => candidate.id === wallId);
  if (!wall || !room.vertices) return null;
  if (wallDeleteDisabledReason({ room, wallId })) return null;

  if (room.preserveCardinalWalls && customWalls.length <= 1) {
    const {
      vertices: _vertices,
      customWalls: _customWalls,
      preserveCardinalWalls: _preserveCardinalWalls,
      openWallPath: _openWallPath,
      ...rest
    } = room;
    return withoutWallMemories(rest, wallId, openingUids);
  }

  if (room.preserveCardinalWalls) {
    const remaining = customWalls.filter((candidate) => candidate.id !== wallId);
    const usedVertexIds = new Set(remaining.flatMap((candidate) => [candidate.startVertexId, candidate.endVertexId]));
    return withoutWallMemories({
      ...room,
      vertices: room.vertices.filter((vertex) => usedVertexIds.has(vertex.id)),
      customWalls: remaining,
    }, wallId, openingUids);
  }

  const updated = deleteCustomWallSegment(wallId, room.vertices, customWalls);
  if (!updated) return null;
  return withoutWallMemories({ ...room, ...updated }, wallId, openingUids);
}

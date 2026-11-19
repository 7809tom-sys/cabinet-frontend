/**
 * Deleted fillers stay deleted (Tom, voice, Nov 19 2026, 7:36 AM CT).
 *
 * The designer re-runs its filler repairs (straight-seam / inside-corner
 * adjoining fillers, 45° miter pairs, frameless door-clearance fillers) after
 * every plan change. Before this, a filler the person deleted on the canvas or
 * in Materials & Parts came straight back on the next render. Now each filler
 * the person deletes is remembered by its purchase group id AND by the seam it
 * covered (wall, layer, along-run span), because the repair can rebuild the same
 * seam board from either neighbor under a different group id. The memory is
 * saved with the room (so a reload keeps it) and cleared by an Auto Design run
 * or a new design.
 */
import {
  cabinetWall,
  isFillerItem,
  isPanelItem,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";

export type DeletedFillerRecord = {
  groupId: string | null;
  wallId: string;
  layer: "base" | "wall" | "tall";
  start: number;
  end: number;
  masterCode?: string;
};

const OVERLAP_IN = 0.05;
const MAX_RECORDS = 200;

function layerOf(item: PlacedCabinet): DeletedFillerRecord["layer"] {
  if (item.placement === "tall") return "tall";
  if (item.placement === "wall") return "wall";
  return "base";
}

/** Records for the fillers among `removed` (cabinets and panels are not remembered). */
export function deletedFillerRecords(removed: readonly PlacedCabinet[], room: RoomData): DeletedFillerRecord[] {
  const records: DeletedFillerRecord[] = [];
  for (const item of removed) {
    if (!isFillerItem(item) || isPanelItem(item)) continue;
    const wallId = cabinetWall(item, room);
    const start = wallRunOffset(item, wallId, room);
    const width = wallRunSpan(item, wallId, room);
    records.push({
      groupId: item.fillerPieceGroupId ?? null,
      wallId,
      layer: layerOf(item),
      start: Math.round(start * 1000) / 1000,
      end: Math.round((start + Math.max(width, 0)) * 1000) / 1000,
      masterCode: item.masterCode,
    });
  }
  return records;
}

export function mergeDeletedFillerRecords(
  current: readonly DeletedFillerRecord[] | null | undefined,
  added: readonly DeletedFillerRecord[],
): DeletedFillerRecord[] {
  const merged = [...(current ?? [])];
  for (const record of added) {
    const duplicate = merged.some((entry) => entry.groupId === record.groupId && entry.wallId === record.wallId
      && entry.layer === record.layer && Math.abs(entry.start - record.start) < 0.01 && Math.abs(entry.end - record.end) < 0.01);
    if (!duplicate) merged.push(record);
  }
  return merged.slice(-MAX_RECORDS);
}

/** True when a filler a repair wants to (re)add matches one the person deleted. */
export function isSuppressedFiller(
  candidate: PlacedCabinet,
  records: readonly DeletedFillerRecord[] | null | undefined,
  room: RoomData,
): boolean {
  if (!records?.length || !isFillerItem(candidate)) return false;
  const groupId = candidate.fillerPieceGroupId ?? null;
  if (groupId && records.some((record) => record.groupId === groupId)) return true;
  const wallId = cabinetWall(candidate, room);
  const start = wallRunOffset(candidate, wallId, room);
  const end = start + wallRunSpan(candidate, wallId, room);
  const layer = layerOf(candidate);
  return records.some((record) => record.wallId === wallId && record.layer === layer
    && Math.min(end, record.end) - Math.max(start, record.start) > OVERLAP_IN);
}

/** The group ids a repair must not rebuild. */
export function suppressedFillerGroupIds(records: readonly DeletedFillerRecord[] | null | undefined): Set<string> {
  return new Set((records ?? []).map((record) => record.groupId).filter((id): id is string => Boolean(id)));
}

/**
 * Drop the fillers a repair just added (present in `after`, not in `before`) that
 * match a deleted record. Returns `after` itself when nothing was dropped.
 */
export function dropResurrectedFillers(
  before: readonly PlacedCabinet[],
  after: PlacedCabinet[],
  records: readonly DeletedFillerRecord[] | null | undefined,
  room: RoomData,
): PlacedCabinet[] {
  if (!records?.length || after === before) return after;
  const existing = new Set(before.map((item) => item.uid));
  const dropped = new Set(after
    .filter((item) => !existing.has(item.uid) && isSuppressedFiller(item, records, room))
    .map((item) => item.uid));
  if (!dropped.size) return after;
  return after.filter((item) => !dropped.has(item.uid));
}

/** Seam-level check for repairs that work from a seam span rather than a drafted board. */
export function isSuppressedSeam(
  seam: { wallId: string; layer: DeletedFillerRecord["layer"]; start: number; end: number },
  records: readonly DeletedFillerRecord[] | null | undefined,
): boolean {
  return (records ?? []).some((record) => record.wallId === seam.wallId && record.layer === seam.layer
    && Math.min(seam.end, record.end) - Math.max(seam.start, record.start) > OVERLAP_IN);
}

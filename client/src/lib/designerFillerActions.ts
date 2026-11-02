/**
 * Rule 13: fillers the Designer placed can be right-click deleted and moved, like any other
 * cabinet.
 *
 * The Designer's own filler groups carry a shared purchase group id, and the delete path was
 * written for cabinets: it kept a filler whose sibling in the group was still present, and the
 * move path refused anything it did not recognise as a wall run. Both left a Designer filler
 * stuck. This module owns the two decisions.
 */
import {
  cabinetWall,
  isFillerItem,
  isPanelItem,
  wallPlacementAt,
  wallRunOffset,
  type PlacedCabinet,
  type RoomData,
} from "./design";

/** A filler the Designer itself placed (not one the user dragged in from the palette). */
export function isDesignerPlacedFiller(item: PlacedCabinet): boolean {
  if (!isFillerItem(item) || isPanelItem(item)) return false;
  return Boolean(
    item.fillerPieceGroupId
    || item.fillerForCabinetUid
    || item.fillerAttachmentSide
    || item.autoPlacedReason
    || item.fillerContinuousVertical,
  );
}

/**
 * Rule 13: deleting a Designer filler removes it and every piece cut from the same purchase, so
 * a two-piece group can never leave half a board on the plan.
 */
export function designerFillerDeletionSet(
  placed: readonly PlacedCabinet[],
  uid: string,
): string[] {
  const target = placed.find((item) => item.uid === uid);
  if (!target || !isDesignerPlacedFiller(target)) return [uid];
  const groupId = target.fillerPieceGroupId;
  if (!groupId) return [uid];
  return placed
    .filter((item) => item.fillerPieceGroupId === groupId || item.uid === uid)
    .map((item) => item.uid);
}

/**
 * Rule 13: a Designer filler is movable along its run. It keeps its width, its finish and its
 * purchase group; only the along-wall offset changes.
 */
export function moveDesignerFiller(input: {
  placed: readonly PlacedCabinet[];
  uid: string;
  requestedOffsetIn: number;
  room: RoomData;
}): { ok: true; placed: PlacedCabinet[]; item: PlacedCabinet } | { ok: false; reason: string } {
  const target = input.placed.find((item) => item.uid === input.uid);
  if (!target) return { ok: false, reason: "That filler is no longer on the plan." };
  if (!isDesignerPlacedFiller(target)) return { ok: false, reason: `${target.masterCode} is not a Designer filler.` };
  if (target.locked) return { ok: false, reason: `${target.masterCode} is locked. Unlock it before moving it.` };
  const wallId = target.wallId ?? cabinetWall(target, input.room);
  if (!wallId) return { ok: false, reason: `${target.masterCode} is not seated on a wall.` };
  const offset = Math.round(Math.max(0, input.requestedOffsetIn) * 8) / 8;
  const spot = wallPlacementAt(offset, Number(target.width) || 0, Number(target.depth) || 0, wallId as never, input.room);
  if (!spot) return { ok: false, reason: `${target.masterCode} cannot move to that position.` };
  const moved: PlacedCabinet = {
    ...target,
    ...spot,
    wallId: spot.wallId ?? target.wallId,
    wallOffset: spot.wallOffset ?? offset,
  };
  return {
    ok: true,
    placed: input.placed.map((item) => (item.uid === target.uid ? moved : item)),
    item: moved,
  };
}

/** Current along-run offset of a Designer filler, for the move control. */
export function designerFillerOffset(item: PlacedCabinet, room: RoomData): number {
  const wallId = item.wallId ?? cabinetWall(item, room);
  return wallId ? wallRunOffset(item, wallId, room) : 0;
}

/**
 * True when the plan still holds any Designer filler the user may right-click (the context menu
 * shows Delete and Move only for these).
 */
export function planHasMovableDesignerFillers(placed: readonly PlacedCabinet[]): boolean {
  return placed.some(isDesignerPlacedFiller);
}

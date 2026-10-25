import { cabinetWall, elevationBox, isRangeOrOven, isRefrigerator, isSinkBaseCabinet, placedCornerGeometryKind, wallRunAlongAtPoint, wallRunFrame, wallRunOffset, wallRunSpan, type PlacedCabinet, type RoomData, type WallSide } from "@/lib/design";

export type ThreeDWallDropTarget = { x: number; y: number; wall?: WallSide; placementUid?: string | null };

export type WallFreeSegment = { start: number; length: number };

/** A visible sink-base/countertop hit is an intentional over-sink target. */
export function targetedSinkBaseForThreeDDrop(
  placed: PlacedCabinet[],
  target?: ThreeDWallDropTarget,
  room?: RoomData,
): PlacedCabinet | null {
  if (!target) return null;
  if (target.placementUid) {
    const hit = placed.find((cabinet) => cabinet.uid === target.placementUid) ?? null;
    // A direct hit on another cabinet remains an ordinary explicit drop. Only a
    // sink-base/countertop identity is allowed to trigger over-sink centering.
    return hit?.placement === "base" && isSinkBaseCabinet(hit) ? hit : null;
  }
  if (!room || !target.wall) return null;
  // One run-frame projection for every wall kind (standard, drawn, diagonal).
  const frame = wallRunFrame(target.wall, room);
  if (!frame) return null;
  const targetAlong = wallRunAlongAtPoint(frame, { x: target.x, y: target.y });
  const candidates = placed.filter((cabinet) => {
    if (cabinet.placement !== "base" || !isSinkBaseCabinet(cabinet) || cabinetWall(cabinet, room) !== target.wall) return false;
    const start = wallRunOffset(cabinet, target.wall!, room);
    const span = wallRunSpan(cabinet, target.wall!, room);
    return targetAlong >= start - 0.01 && targetAlong <= start + span + 0.01;
  });
  if (candidates.length === 0) return null;
  const runCenter = (cabinet: PlacedCabinet) => wallRunOffset(cabinet, target.wall!, room) + wallRunSpan(cabinet, target.wall!, room) / 2;
  return candidates.reduce((nearest, cabinet) => (
    Math.abs(runCenter(cabinet) - targetAlong) < Math.abs(runCenter(nearest) - targetAlong) ? cabinet : nearest
  ));
}

/** A lower cabinet/appliance hit is an explicit request to align an upper to it. */
export function targetedLowerCabinetForThreeDDrop(
  placed: PlacedCabinet[],
  target?: ThreeDWallDropTarget,
  room?: RoomData,
): PlacedCabinet | null {
  if (!target || !room) return null;
  const eligible = (cabinet: PlacedCabinet): boolean => {
    if (cabinet.placement !== "base" && cabinet.placement !== "appliance") return false;
    if (cabinet.placement === "appliance" && (isRefrigerator(cabinet) || isRangeOrOven(cabinet.masterCode, cabinet.description) || elevationBox(cabinet, room).bottom > 0.01)) return false;
    return placedCornerGeometryKind(cabinet) === "standard";
  };
  if (target.placementUid) {
    const hit = placed.find((cabinet) => cabinet.uid === target.placementUid) ?? null;
    return hit && eligible(hit) ? hit : null;
  }
  if (!target.wall) return null;
  // One run-frame projection for every wall kind (standard, drawn, diagonal).
  const frame = wallRunFrame(target.wall, room);
  if (!frame) return null;
  const wall = target.wall;
  const targetAlong = wallRunAlongAtPoint(frame, { x: target.x, y: target.y });
  const candidates = placed.filter((cabinet) => {
    if (!eligible(cabinet) || cabinetWall(cabinet, room) !== wall) return false;
    const start = wallRunOffset(cabinet, wall, room);
    const span = wallRunSpan(cabinet, wall, room);
    return targetAlong >= start - 0.01 && targetAlong <= start + span + 0.01;
  });
  if (candidates.length === 0) return null;
  const runCenter = (cabinet: PlacedCabinet) => wallRunOffset(cabinet, wall, room) + wallRunSpan(cabinet, wall, room) / 2;
  return candidates.reduce((nearest, cabinet) => (
    Math.abs(runCenter(cabinet) - targetAlong) < Math.abs(runCenter(nearest) - targetAlong) ? cabinet : nearest
  ));
}

/**
 * Chooses a cabinet start within a free wall segment nearest to the point where
 * the designer released the catalog item. Falls back to the first fit only
 * when the drop target does not land in a segment wide enough for the item.
 */
export function nearestFreeWallDropStart(
  targetAlong: number,
  width: number,
  segments: WallFreeSegment[],
  allowNearestFittingSegment = false,
): number | null {
  const fits = segments.filter((segment) => segment.length >= width);
  if (fits.length === 0) return null;
  const containing = fits.find((segment) => targetAlong >= segment.start && targetAlong <= segment.start + segment.length);
  // An explicit 3D drop must honor its actual target. It may not silently move
  // the cabinet to another open run just because that run happens to fit. A
  // sink base is the narrow exception: customers routinely aim beside a
  // dishwasher face instead of at the exposed counter run, so it may recover
  // to the closest full sink-base opening on that same wall.
  const segment = containing ?? (allowNearestFittingSegment
    ? fits.reduce((nearest, candidate) => {
      const distanceTo = (segment: WallFreeSegment) => targetAlong < segment.start
        ? segment.start - targetAlong
        : targetAlong > segment.start + segment.length
          ? targetAlong - (segment.start + segment.length)
          : 0;
      return distanceTo(candidate) < distanceTo(nearest) ? candidate : nearest;
    })
    : null);
  if (!segment) return null;
  return Math.max(segment.start, Math.min(targetAlong - width / 2, segment.start + segment.length - width));
}

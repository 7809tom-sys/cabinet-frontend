import {
  isRangeOrOven,
  rangeOvenClearanceViolations,
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import {
  anchorAlongStartIn,
  wallLabelToEngineWallId,
  type FourAnchorOriginCorner,
  type FourAnchorRunDirection,
  type WallLabel,
} from "./fourAnchorAutoBuild";

export type CornerRangeEnd = "start" | "end";
export const CORNER_RANGE_HANDLE_FILLER_IN = 3;

export type CornerRangeRequest = {
  range: Pick<PlacedCabinet, "masterCode" | "description" | "placement" | "width" | "depth">;
  room: RoomData;
  wallLabel: WallLabel;
  centerOffsetIn: number;
  originCorner: FourAnchorOriginCorner;
  runDirection: FourAnchorRunDirection;
  cornerEnd: CornerRangeEnd;
  placed?: PlacedCabinet[];
};

export type CornerRangePlacement = {
  ok: true;
  wallId: string;
  wallLabel: WallLabel;
  cornerEnd: CornerRangeEnd;
  alongStart: number;
  spot: ReturnType<typeof wallPlacementAt>;
  requiredFillerIn: number;
};

export type CornerRangeRejection = {
  ok: false;
  reason: "not-range-or-oven" | "not-appliance" | "invalid-measurement" | "wall-unavailable" | "wrong-corner";
};

export type CornerRangeResult = CornerRangePlacement | CornerRangeRejection;

const EPSILON_IN = 0.125;

/**
 * Resolve an explicit wall-relative corner range/oven anchor. A corner range
 * does not receive a guessed offset: its center must land at the requested
 * wall endpoint, and the returned filler requirement belongs on the interior
 * side between the appliance and the adjoining cabinet.
 */
export function placeCornerRange(request: CornerRangeRequest): CornerRangeResult {
  const { range, room } = request;
  if (!isRangeOrOven(range.masterCode, range.description)) return { ok: false, reason: "not-range-or-oven" };
  if (range.placement !== "appliance") return { ok: false, reason: "not-appliance" };
  const width = Number(range.width);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(request.centerOffsetIn) || request.centerOffsetIn < 0) {
    return { ok: false, reason: "invalid-measurement" };
  }
  const wall = wallLabelToEngineWallId(request.wallLabel, room, request.originCorner, request.runDirection);
  if (!wall) return { ok: false, reason: "wall-unavailable" };
  const alongStart = anchorAlongStartIn(
    { wallLabel: request.wallLabel, centerOffsetIn: request.centerOffsetIn },
    width,
    wall,
  );
  const expectedStart = wall.frame.runStart;
  const expectedEnd = wall.frame.runEnd - width;
  const atRequestedCorner = request.cornerEnd === "start"
    ? Math.abs(alongStart - expectedStart) <= EPSILON_IN
    : Math.abs(alongStart - expectedEnd) <= EPSILON_IN;
  if (!atRequestedCorner) return { ok: false, reason: "wrong-corner" };
  return {
    ok: true,
    wallId: wall.engineWallId,
    wallLabel: request.wallLabel,
    cornerEnd: request.cornerEnd,
    alongStart,
    spot: wallPlacementAt(alongStart, width, Number(range.depth) || 24, wall.engineWallId as Parameters<typeof wallPlacementAt>[3], room),
    requiredFillerIn: CORNER_RANGE_HANDLE_FILLER_IN,
  };
};

export type PlacedCornerRangeValidation = {
  ok: false;
  reason: "missing-filler";
  requiredFillerIn: number;
} | null;

/**
 * Adapter used by the normal Designer transaction after x/y normalization.
 * Missing handle-clearance filler is intentionally an advisory result: the
 * range remains placeable, while the existing conflict rail tells the user
 * to add the catalog filler. This preserves the current non-blocking warning
 * behavior and prevents generic snapping from hiding the requirement.
 */
export function validatePlacedCornerRange(
  range: PlacedCabinet,
  room: RoomData,
  placed: PlacedCabinet[],
): PlacedCornerRangeValidation {
  if (!isRangeOrOven(range.masterCode, range.description) || range.placement !== "appliance") return null;
  const violations = rangeOvenClearanceViolations(
    [...placed, range],
    room,
    CORNER_RANGE_HANDLE_FILLER_IN,
  );
  return violations.has(range.uid)
    ? { ok: false, reason: "missing-filler", requiredFillerIn: CORNER_RANGE_HANDLE_FILLER_IN }
    : null;
}

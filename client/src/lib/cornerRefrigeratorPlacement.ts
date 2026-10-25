import {
  cabinetPlacementCollisionDetail,
  cabinetWall,
  insideCornerHoldIn,
  isRefrigerator,
  wallPlacementAt,
  wallRunFrame,
  wallRunJoinAt,
  wallRunOffset,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";
import {
  anchorAlongStartIn,
  wallLabelToEngineWallId,
  type FourAnchorOriginCorner,
  type FourAnchorRunDirection,
  type WallLabel,
} from "./fourAnchorAutoBuild";

export type CornerRefrigeratorEnd = "start" | "end";

export type CornerRefrigeratorRequest = {
  refrigerator: Pick<PlacedCabinet, "masterCode" | "description" | "placement" | "width" | "depth">;
  room: RoomData;
  wallLabel: WallLabel;
  centerOffsetIn: number;
  originCorner: FourAnchorOriginCorner;
  runDirection: FourAnchorRunDirection;
  cornerEnd: CornerRefrigeratorEnd;
  placed?: PlacedCabinet[];
  openings?: WallOpening[];
};

export type CornerRefrigeratorPlacement = {
  ok: true;
  wallId: string;
  wallLabel: WallLabel;
  cornerEnd: CornerRefrigeratorEnd;
  alongStart: number;
  spot: ReturnType<typeof wallPlacementAt>;
  requiredCornerHoldIn: number;
};

export type CornerRefrigeratorRejection = {
  ok: false;
  reason:
    | "not-refrigerator"
    | "not-appliance"
    | "invalid-measurement"
    | "wall-unavailable"
    | "wrong-corner"
    | "insufficient-depth"
    | "corner-clearance"
    | "outside-wall"
    | "collision";
};

export type CornerRefrigeratorResult = CornerRefrigeratorPlacement | CornerRefrigeratorRejection;

const EPSILON_IN = 0.125;
const REFRIGERATOR_DEPTH_IN = 24;

/**
 * Adapter for the normal Designer transaction. Direct catalog placement has
 * already resolved the wall and authoritative x/y, so it does not have a
 * WallLabel form to submit. Return null for a refrigerator that is not at a
 * wall endpoint; return a rejection only when the candidate claims a corner
 * position but violates the refrigerator corner contract.
 */
export function validatePlacedCornerRefrigerator(
  refrigerator: PlacedCabinet,
  room: RoomData,
  placed: PlacedCabinet[],
): CornerRefrigeratorRejection | null {
  if (!isRefrigerator(refrigerator)) return null;
  const width = Number(refrigerator.width);
  const depth = Number(refrigerator.depth);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(depth) || depth < REFRIGERATOR_DEPTH_IN - EPSILON_IN) {
    return { ok: false, reason: "insufficient-depth" };
  }
  const side = cabinetWall(refrigerator, room);
  const frame = wallRunFrame(side, room);
  if (!frame) return { ok: false, reason: "wall-unavailable" };
  const offset = wallRunOffset(refrigerator, side, room);
  const nearStart = Math.abs(offset - frame.runStart) <= EPSILON_IN;
  const nearEnd = Math.abs(offset + width - frame.runEnd) <= EPSILON_IN;
  if (!nearStart && !nearEnd) return null;
  const cornerEnd: CornerRefrigeratorEnd = nearStart ? "start" : "end";
  const join = wallRunJoinAt(frame, cornerEnd, room);
  const requiredCornerHoldIn = join ? insideCornerHoldIn(join.turnDeg, depth) : 0;
  const holdStart = cornerEnd === "start" ? offset : offset + width - requiredCornerHoldIn;
  const holdEnd = cornerEnd === "start" ? offset + requiredCornerHoldIn : offset + width;
  if (holdStart < frame.runStart - EPSILON_IN || holdEnd > frame.runEnd + EPSILON_IN) {
    return { ok: false, reason: "corner-clearance" };
  }
  if (cabinetPlacementCollisionDetail(refrigerator, placed, room)) return { ok: false, reason: "collision" };
  return null;
}

/**
 * Seat a refrigerator at an explicit wall endpoint without inventing X/Y
 * coordinates. The refrigerator remains a normal source item; this helper only
 * returns the authoritative wall placement and the corner hold that must stay
 * reserved for adjoining geometry.
 */
export function placeCornerRefrigerator(request: CornerRefrigeratorRequest): CornerRefrigeratorResult {
  const { refrigerator, room } = request;
  if (!isRefrigerator(refrigerator)) return { ok: false, reason: "not-refrigerator" };
  if (refrigerator.placement !== "appliance") return { ok: false, reason: "not-appliance" };

  const width = Number(refrigerator.width);
  const depth = Number(refrigerator.depth);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(request.centerOffsetIn) || request.centerOffsetIn < 0) {
    return { ok: false, reason: "invalid-measurement" };
  }
  if (!Number.isFinite(depth) || depth < REFRIGERATOR_DEPTH_IN - EPSILON_IN) {
    return { ok: false, reason: "insufficient-depth" };
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
  const isAtRequestedCorner = request.cornerEnd === "start"
    ? Math.abs(alongStart - expectedStart) <= EPSILON_IN
    : Math.abs(alongStart - expectedEnd) <= EPSILON_IN;
  if (!isAtRequestedCorner) return { ok: false, reason: "wrong-corner" };

  const cornerJoin = wallRunJoinAt(wall.frame, request.cornerEnd, room);
  const requiredCornerHoldIn = cornerJoin ? insideCornerHoldIn(cornerJoin.turnDeg, depth) : 0;
  const holdStart = request.cornerEnd === "start" ? alongStart : alongStart + width - requiredCornerHoldIn;
  const holdEnd = request.cornerEnd === "start" ? alongStart + requiredCornerHoldIn : alongStart + width;
  if (holdStart < wall.frame.runStart - EPSILON_IN || holdEnd > wall.frame.runEnd + EPSILON_IN) {
    return { ok: false, reason: "corner-clearance" };
  }

  const spot = wallPlacementAt(alongStart, width, depth, wall.engineWallId as Parameters<typeof wallPlacementAt>[3], room);
  const candidate: PlacedCabinet = {
    ...refrigerator,
    uid: "__corner-refrigerator-candidate__",
    cabinetId: 0,
    x: spot.x,
    y: spot.y,
    rotation: spot.rotation,
    height: 84,
    numberOfDoors: null,
    numberOfDrawers: null,
  };
  const collision = cabinetPlacementCollisionDetail(candidate, request.placed ?? [], room);
  if (collision) return { ok: false, reason: "collision" };

  return {
    ok: true,
    wallId: wall.engineWallId,
    wallLabel: request.wallLabel,
    cornerEnd: request.cornerEnd,
    alongStart,
    spot,
    requiredCornerHoldIn,
  };
}

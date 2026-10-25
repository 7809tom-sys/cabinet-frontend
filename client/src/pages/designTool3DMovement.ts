import {
  cabinetWall,
  cabinetWallMovePreview,
  roundToEighth,
  seatedWallRunFrame,
  STD,
  wallRunFrame,
  wallRunOffset,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "@/lib/design";

export type ThreeDPlanMoveDirection = "left" | "right" | "in" | "out";
export const MAX_CABINET_PLAN_MOVE_IN = 120;

function controlledMoveStep(incrementIn: number) {
  return Math.max(0.125, Math.min(MAX_CABINET_PLAN_MOVE_IN, Number(incrementIn) || 1));
}

export interface ThreeDSeatedWallMoveTarget {
  /** The physically seated cabinet target, with its canonical wall identity. */
  candidate: PlacedCabinet;
  /** Kept for older call sites; the shared engine never constrains in/out here. */
  constrainedToWall: boolean;
}

/**
 * Resolves a 3D Left/Right move for a cabinet seated on ANY wall run (standard
 * side, drawn wall or peninsula) through the shared along-wall engine, so the
 * move keeps its wall identity, exact 1/8-inch offset, facing rotation and flush
 * depth exactly as a Plan drag or keyboard nudge would. Returns null when the
 * cabinet is not seated on a run (free-floating or deliberately pulled off the
 * wall) or when the direction is In/Out, which the generic plan path handles.
 */
export function threeDSeatedWallMoveTarget(
  cabinet: PlacedCabinet,
  room: RoomData,
  direction: ThreeDPlanMoveDirection,
  incrementIn: number,
  peers: PlacedCabinet[] = [],
  openings: WallOpening[] = [],
): ThreeDSeatedWallMoveTarget | null {
  if (direction === "in" || direction === "out") return null;
  const frame = seatedWallRunFrame(cabinet, room);
  if (!frame) return null;
  const step = controlledMoveStep(incrementIn);
  // Move along the run from the saved offset (the authoritative position), not
  // from a possibly stale plan envelope. Viewer-right is +tangent for a cabinet
  // whose front faces into the room.
  const offset = wallRunOffset(cabinet, frame.id, room);
  const delta = threeDPlanMoveDelta(cabinet, room, direction, step);
  const alongDelta = delta.x * frame.tangent.x + delta.y * frame.tangent.y;
  const nextOffset = roundToEighth(offset + alongDelta);
  const preview = cabinetWallMovePreview(cabinet, { x: cabinet.x, y: cabinet.y }, room, peers, openings, {
    magnet: false,
    exact: true,
    target: { wallId: frame.id, wallOffset: nextOffset },
  });
  if (!preview.candidate) return null;
  return { candidate: preview.candidate, constrainedToWall: false };
}

/** @deprecated Use threeDSeatedWallMoveTarget — one move path for every wall. */
export const threeDMeasuredWallMoveTarget = threeDSeatedWallMoveTarget;

export function countertopMountedCabinet(
  cabinet: PlacedCabinet,
  countertopTopIn = STD.COUNTERTOP_HEIGHT,
): PlacedCabinet {
  return {
    ...cabinet,
    mountBottom: countertopTopIn,
    mountBottomAdjusted: true,
  };
}

export function commitThreeDCabinetCandidate(
  placed: PlacedCabinet[],
  uid: string,
  candidate: PlacedCabinet,
): PlacedCabinet[] | null {
  if (!placed.some((cabinet) => cabinet.uid === uid) || candidate.uid !== uid) return null;
  return placed.map((cabinet) => cabinet.uid === uid ? candidate : cabinet);
}

/**
 * Converts the viewer-relative 3D move controls into inches on the authoritative
 * 2D plan. "Left" and "Right" are the viewer's left and right while facing the
 * cabinet's wall; "In" moves toward the room, "Out" toward the wall. The same
 * wall-run frame answers this for a standard side, a drawn wall or a peninsula.
 */
export function threeDPlanMoveDelta(
  cabinet: PlacedCabinet,
  room: RoomData,
  direction: ThreeDPlanMoveDirection,
  incrementIn: number,
) {
  const step = controlledMoveStep(incrementIn);
  const side = cabinetWall(cabinet, room);
  const frame = wallRunFrame(side, room);
  if (frame) {
    const facing = { x: -frame.inward.x, y: -frame.inward.y };
    const viewerLeft = { x: facing.y, y: -facing.x };
    const tidy = (value: number) => (Math.abs(value) < 1e-12 ? 0 : value);
    const vectors: Record<ThreeDPlanMoveDirection, { x: number; y: number }> = {
      left: { x: tidy(viewerLeft.x * step), y: tidy(viewerLeft.y * step) },
      right: { x: tidy(-viewerLeft.x * step), y: tidy(-viewerLeft.y * step) },
      in: { x: tidy(frame.inward.x * step), y: tidy(frame.inward.y * step) },
      out: { x: tidy(-frame.inward.x * step), y: tidy(-frame.inward.y * step) },
    };
    return vectors[direction];
  }
  const vectors: Record<ThreeDPlanMoveDirection, { x: number; y: number }> = {
    left: side === "top" ? { x: -step, y: 0 } : side === "bottom" ? { x: step, y: 0 } : side === "left" ? { x: 0, y: step } : { x: 0, y: -step },
    right: side === "top" ? { x: step, y: 0 } : side === "bottom" ? { x: -step, y: 0 } : side === "left" ? { x: 0, y: -step } : { x: 0, y: step },
    in: side === "top" ? { x: 0, y: step } : side === "bottom" ? { x: 0, y: -step } : side === "left" ? { x: step, y: 0 } : { x: -step, y: 0 },
    out: side === "top" ? { x: 0, y: -step } : side === "bottom" ? { x: 0, y: step } : side === "left" ? { x: -step, y: 0 } : { x: step, y: 0 },
  };
  return vectors[direction];
}

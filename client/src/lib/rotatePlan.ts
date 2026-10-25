import {
  FURNITURE_CATALOG,
  furnitureFootprint,
  placedFootprint,
  nearestWallRunAtPoint,
  wallRunAlongAtPoint,
  wallRunFrame,
  type IslandFace,
  type IslandZone,
  type PlacedCabinet,
  type PlacedFurniture,
  type PlanAnnotation,
  type PonyWall,
  type RoomData,
  type SinkFixture,
  type WallOpening,
  type WallSide,
} from "./design";

export interface RotatablePlanState {
  room: RoomData;
  cabinets: PlacedCabinet[];
  openings: WallOpening[];
  sinks: SinkFixture[];
  island: IslandZone | null;
  furniture: PlacedFurniture[];
  annotations: PlanAnnotation[];
  ponyWalls: PonyWall[];
}

export interface RotatedPlanState extends RotatablePlanState {}

const rounded = (value: number) => Math.round(value * 10_000) / 10_000;
const rotateAngle = (angle: number) => ((Number(angle || 0) + 90) % 360 + 360) % 360;

/** Rotate an axis-aligned plan rectangle 90° clockwise around the room bounds. */
export function rotatePlanRectClockwise(
  rect: { x: number; y: number; width: number; depth: number },
  oldRoomDepth: number,
) {
  return {
    x: rounded(oldRoomDepth - rect.y - rect.depth),
    y: rounded(rect.x),
    width: rounded(rect.depth),
    depth: rounded(rect.width),
  };
}

/** Rotate an arbitrary plan point 90° clockwise around the room bounds. */
export function rotatePlanPointClockwise(point: { x: number; y: number }, oldRoomDepth: number) {
  return { x: rounded(oldRoomDepth - point.y), y: rounded(point.x) };
}

const CARDINAL_ROTATION: Record<"top" | "right" | "bottom" | "left", "top" | "right" | "bottom" | "left"> = {
  top: "right",
  right: "bottom",
  bottom: "left",
  left: "top",
};

const ISLAND_FACE_ROTATION: Record<IslandFace, IslandFace> = {
  back: "right",
  right: "front",
  front: "left",
  left: "back",
};

/**
 * A wall keeps its id through a quarter turn: a drawn wall or peninsula is a
 * named run whose geometry rotates with the vertices, and a standard side
 * becomes the next clockwise side. Both are the same run afterwards.
 */
function rotateWallId(side: string | null | undefined, room: RoomData): string | undefined {
  if (!side) return undefined;
  const frame = wallRunFrame(side, room);
  if (frame && frame.kind !== "cardinal") return side;
  return CARDINAL_ROTATION[side as keyof typeof CARDINAL_ROTATION] ?? side;
}

function rotateWallCeilings(room: RoomData): RoomData["wallCeilings"] {
  if (!room.wallCeilings) return room.wallCeilings;
  if (room.customWalls?.length) return { ...room.wallCeilings };
  return Object.fromEntries(
    Object.entries(room.wallCeilings).map(([side, ceiling]) => [
      CARDINAL_ROTATION[side as keyof typeof CARDINAL_ROTATION] ?? side,
      ceiling,
    ]),
  ) as RoomData["wallCeilings"];
}

function rotateRoomClockwise(room: RoomData): RoomData {
  const vertices = room.vertices?.map((vertex) => ({
    ...vertex,
    ...rotatePlanPointClockwise(vertex, room.depth),
  }));
  return {
    ...room,
    width: room.depth,
    depth: room.width,
    vertices,
    wallCeilings: rotateWallCeilings(room),
  };
}

function wallOwnedCabinetAfterRotation(cabinet: PlacedCabinet, oldRoom: RoomData, nextRoom: RoomData): PlacedCabinet | null {
  if (cabinet.islandFace) return null;
  // Rotate the *body* first. Saved wallId/wallOffset metadata can lag after a
  // resize or an older drag, but it must never be allowed to pull a cabinet to
  // a different location when the user rotates the drawing. The on-canvas
  // geometry is authoritative for this operation.
  const oldFootprint = placedFootprint(cabinet);
  const rotated = rotatePlanRectClockwise(
    { x: cabinet.x, y: cabinet.y, width: oldFootprint.w, depth: oldFootprint.d },
    oldRoom.depth,
  );
  const center = { x: cabinet.x + oldFootprint.w / 2, y: cabinet.y + oldFootprint.d / 2 };
  const oldFrame = nearestWallRunAtPoint(oldRoom, center)?.frame ?? null;
  if (!oldFrame) return null;
  const wallId = (rotateWallId(oldFrame.id, oldRoom) ?? oldFrame.id) as WallSide;
  const nextFrame = wallRunFrame(wallId, nextRoom);
  if (!nextFrame) return null;
  const rotatedCenter = { x: rotated.x + rotated.width / 2, y: rotated.y + rotated.depth / 2 };
  const span = Math.max(0, Number(cabinet.width) || 0);
  const along = Math.max(0, Math.min(
    Math.max(0, nextFrame.length - span),
    wallRunAlongAtPoint(nextFrame, rotatedCenter) - span / 2,
 ));
  return {
    ...cabinet,
    // x/y are the plan-body origin. The catalog's width/depth remain the
    // cabinet's physical source dimensions; changing them here makes every
    // additional turn reinterpret the cabinet as a different-size product.
    x: rotated.x,
    y: rotated.y,
    rotation: rotateAngle(cabinet.rotation),
    wallId,
    // Refresh the saved offset from the visible cabinet body. The shared commit
    // boundary validates this against the rotated room without changing x/y.
    wallOffset: along,
  };
}

/**
 * Rotate the entire saved drawing 90° clockwise. Custom wall ids, measured wall
 * lengths, opening offsets, and cabinet run offsets remain authoritative.
 */
export function rotateCustomPlanClockwise(input: RotatablePlanState): RotatedPlanState {
  const oldRoom = input.room;
  const nextRoom = rotateRoomClockwise(oldRoom);
  const cabinets = input.cabinets.map((cabinet) => {
    const onWall = wallOwnedCabinetAfterRotation(cabinet, oldRoom, nextRoom);
    if (onWall) return onWall;
    const footprint = placedFootprint(cabinet);
    const rotated = rotatePlanRectClockwise(
      { x: cabinet.x, y: cabinet.y, width: footprint.w, depth: footprint.d },
      oldRoom.depth,
    );
    return {
      ...cabinet,
      x: rotated.x,
      y: rotated.y,
      rotation: rotateAngle(cabinet.rotation),
      wallId: rotateWallId(cabinet.wallId, oldRoom),
      islandFace: cabinet.islandFace ? ISLAND_FACE_ROTATION[cabinet.islandFace] : cabinet.islandFace,
    };
  });
  const openings = input.openings.map((opening) => ({
    ...opening,
    side: (rotateWallId(opening.side, oldRoom) ?? opening.side) as WallSide,
  }));
  const sinks = input.sinks.map((sink) => {
    const rotated = rotatePlanRectClockwise(sink, oldRoom.depth);
    return {
      ...sink,
      ...rotated,
      wallSide: rotateWallId(sink.wallSide, oldRoom) as WallSide | undefined,
      planRotation: rotateAngle(sink.planRotation ?? 0),
    };
  });
  const island = input.island
    ? (() => {
        const rotated = rotatePlanRectClockwise(input.island!, oldRoom.depth);
        return {
          ...input.island!,
          ...rotated,
          activeFace: input.island!.activeFace ? ISLAND_FACE_ROTATION[input.island!.activeFace] : input.island!.activeFace,
          countertopWidth: input.island!.countertopDepth ?? input.island!.countertopWidth,
          countertopDepth: input.island!.countertopWidth ?? input.island!.countertopDepth,
          countertopOffsetX: input.island!.countertopOffsetY ?? input.island!.countertopOffsetX,
          countertopOffsetY: input.island!.countertopOffsetX ?? input.island!.countertopOffsetY,
        };
      })()
    : null;
  const furniture = input.furniture.map((item) => {
    const definition = FURNITURE_CATALOG.find((candidate) => candidate.id === item.defId);
    const footprint = definition ? furnitureFootprint(item, definition) : { w: 24, d: 24 };
    const rotated = rotatePlanRectClockwise(
      { x: item.x, y: item.y, width: footprint.w, depth: footprint.d },
      oldRoom.depth,
    );
    return { ...item, x: rotated.x, y: rotated.y, rotation: rotateAngle(item.rotation) };
  });
  const annotations = input.annotations.map((annotation) => ({
    ...annotation,
    ...rotatePlanPointClockwise(annotation, oldRoom.depth),
  }));
  const ponyWalls = input.ponyWalls.map((wall) => ({
    ...wall,
    ...rotatePlanRectClockwise(wall, oldRoom.depth),
  }));
  return { room: nextRoom, cabinets, openings, sinks, island, furniture, annotations, ponyWalls };
}

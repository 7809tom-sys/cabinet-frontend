import {
  type PlacedCabinet,
  type PlacedFurniture,
  type PonyWall,
  type IslandZone,
  type RoomData,
  type SinkFixture,
  type WallOpening,
  furniturePlanFrame,
  placedFootprint,
  roomWallRunFrames,
  wallRunFrame,
} from "@/lib/design";
import {
  ROOM_WALL_THICKNESS_IN,
  appendAttachedWall,
  faceWallFootprint,
  hostOffsetAtPoint,
  slideHostedWall,
  type AppendAttachedWallResult,
  type AttachedWallAngle,
  type AttachedWallTurn,
  type PlanPoint,
  type SlideHostedWallResult,
  type WallAttachmentFrame,
} from "@/lib/polygonRoom";

function box(x: number, y: number, width: number, depth: number): PlanPoint[] | null {
  if (!(width > 0.5) || !(depth > 0.5)) return null;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + depth },
    { x, y: y + depth },
  ];
}

function rotatedBox(x: number, y: number, width: number, depth: number, rotation = 0): PlanPoint[] | null {
  if (!(width > 0.5) || !(depth > 0.5)) return null;
  const radians = ((rotation % 360) * Math.PI) / 180;
  const center = { x: x + width / 2, y: y + depth / 2 };
  return [
    { x: -width / 2, y: -depth / 2 },
    { x: width / 2, y: -depth / 2 },
    { x: width / 2, y: depth / 2 },
    { x: -width / 2, y: depth / 2 },
  ].map((point) => ({
    x: center.x + point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: center.y + point.x * Math.sin(radians) + point.y * Math.cos(radians),
  }));
}

function outwardWallSlab(frame: WallAttachmentFrame): PlanPoint[] {
  const outward = { x: -frame.inward.x * ROOM_WALL_THICKNESS_IN, y: -frame.inward.y * ROOM_WALL_THICKNESS_IN };
  return [
    frame.start,
    frame.end,
    { x: frame.end.x + outward.x, y: frame.end.y + outward.y },
    { x: frame.start.x + outward.x, y: frame.start.y + outward.y },
  ];
}

function openingColumn(frame: WallAttachmentFrame, offset: number, width: number): PlanPoint[] | null {
  if (!(width > 0.5)) return null;
  const tangent = { x: Math.cos(frame.angle), y: Math.sin(frame.angle) };
  const start = {
    x: frame.start.x + tangent.x * offset,
    y: frame.start.y + tangent.y * offset,
  };
  const end = {
    x: start.x + tangent.x * width,
    y: start.y + tangent.y * width,
  };
  const depth = Math.max(frame.length, 240);
  return [
    start,
    end,
    { x: end.x + frame.inward.x * depth, y: end.y + frame.inward.y * depth },
    { x: start.x + frame.inward.x * depth, y: start.y + frame.inward.y * depth },
  ];
}

export interface AttachedWallScene {
  room: RoomData;
  placed?: readonly PlacedCabinet[];
  openings?: readonly WallOpening[];
  furniture?: readonly PlacedFurniture[];
  sinks?: readonly SinkFixture[];
  ponyWalls?: readonly PonyWall[];
  island?: IslandZone | null;
  /** Wall being moved is not an obstacle to itself. */
  ignoreWallId?: string;
}

/** Everything a projected wall is forbidden to cross, as convex plan polygons. */
export function attachedWallObstacles(scene: AttachedWallScene, hostId: string): PlanPoint[][] {
  const obstacles: PlanPoint[][] = [];
  const room = scene.room;
  for (const frame of roomWallRunFrames(room)) {
    if (frame.id === hostId || frame.id === scene.ignoreWallId) continue;
    if (frame.kind === "cardinal") {
      obstacles.push(outwardWallSlab(frame));
      continue;
    }
    const hosted = room.customWalls?.find((wall) => wall.id === frame.id);
    if (hosted?.hostWallId && hosted.hostAngle && hosted.hostOffset != null) {
      const host = wallRunFrame(hosted.hostWallId, room);
      if (host) {
        const length = Math.hypot(frame.end.x - frame.start.x, frame.end.y - frame.start.y);
        obstacles.push(faceWallFootprint(host, hosted.hostOffset, length, hosted.hostAngle, hosted.hostTurn ?? "right"));
        continue;
      }
    }
    obstacles.push(outwardWallSlab(frame));
  }
  for (const cabinet of scene.placed ?? []) {
    if (cabinet.wallId && cabinet.wallId === scene.ignoreWallId) continue;
    const footprint = placedFootprint(cabinet);
    const polygon = box(cabinet.x, cabinet.y, footprint.w, footprint.d);
    if (polygon) obstacles.push(polygon);
  }
  for (const opening of scene.openings ?? []) {
    if (opening.side === scene.ignoreWallId) continue;
    const frame = wallRunFrame(opening.side, room);
    if (!frame) continue;
    const polygon = openingColumn(frame, opening.offset, opening.width);
    if (polygon) obstacles.push(polygon);
  }
  for (const item of scene.furniture ?? []) {
    const plan = furniturePlanFrame(item);
    const polygon = plan ? box(item.x, item.y, plan.boundWidth, plan.boundDepth) : null;
    if (polygon) obstacles.push(polygon);
  }
  for (const sink of scene.sinks ?? []) {
    const polygon = box(sink.x, sink.y, sink.width, sink.depth);
    if (polygon) obstacles.push(polygon);
  }
  for (const pony of scene.ponyWalls ?? []) {
    const polygon = rotatedBox(pony.x, pony.y, pony.width, pony.depth, pony.rotation ?? 0);
    if (polygon) obstacles.push(polygon);
  }
  if (scene.island) {
    const polygon = rotatedBox(scene.island.x, scene.island.y, scene.island.width, scene.island.depth, scene.island.rotation ?? 0);
    if (polygon) obstacles.push(polygon);
  }
  return obstacles;
}

export function placeAttachedWall(input: {
  scene: AttachedWallScene;
  frame: WallAttachmentFrame;
  clickPoint: PlanPoint;
  lengthIn: number;
  heightIn: number;
  angle: AttachedWallAngle;
  turn?: AttachedWallTurn;
  ceilingIn?: number;
  label?: string;
}): AppendAttachedWallResult | { error: string } | null {
  const room = input.scene.room;
  return appendAttachedWall({
    width: room.width,
    depth: room.depth,
    vertices: room.vertices ?? [],
    customWalls: room.customWalls ?? [],
    preserveCardinalWalls: Boolean(room.preserveCardinalWalls),
    clickPoint: input.clickPoint,
    frame: input.frame,
    obstacles: attachedWallObstacles(input.scene, input.frame.id),
    turn: input.turn,
    angle: input.angle,
    lengthIn: input.lengthIn,
    heightIn: input.heightIn,
    ceilingIn: input.ceilingIn,
    label: input.label,
  });
}

export function slideAttachedWall(input: {
  scene: AttachedWallScene;
  wallId: string;
  point: PlanPoint;
  /** Along-wall distance from the attachment to the pointer when the drag started. */
  grabAlong?: number;
}): (SlideHostedWallResult & { snapped: boolean }) | null {
  const room = input.scene.room;
  const wall = room.customWalls?.find((candidate) => candidate.id === input.wallId);
  const frame = wall?.hostWallId ? wallRunFrame(wall.hostWallId, room) : null;
  if (!wall || !frame || !room.vertices || !room.customWalls) return null;
  const desired = hostOffsetAtPoint(frame, input.point) - (input.grabAlong ?? 0);
  const moved = slideHostedWall(
    room.vertices,
    room.customWalls,
    wall.id,
    frame,
    desired,
    attachedWallObstacles({ ...input.scene, ignoreWallId: wall.id }, frame.id),
  );
  if (!moved) return null;
  return { ...moved, snapped: Math.abs(moved.offset - desired) > 0.2 };
}

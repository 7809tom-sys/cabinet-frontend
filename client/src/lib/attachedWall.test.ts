import { describe, expect, it } from "vitest";
import { placeAttachedWall, slideAttachedWall } from "./attachedWall";
import type { PlacedCabinet, RoomData } from "./design";
import {
  faceProjectionDirection,
  faceWallFootprint,
  hostOffsetAtPoint,
  hostedWallFreeOffsets,
  resolveHostedWallOffset,
  type WallAttachmentFrame,
} from "./polygonRoom";

const topWall: WallAttachmentFrame = {
  id: "top",
  start: { x: 0, y: 0 },
  end: { x: 120, y: 0 },
  angle: 0,
  inward: { x: 0, y: 1 },
  length: 120,
};

const room: RoomData = { width: 120, depth: 96, ceilingHeight: 96 };

function cabinet(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "x" | "y" | "width" | "depth">): PlacedCabinet {
  return {
    uid: "cab",
    masterCode: "B24",
    description: "Base",
    placement: "base",
    rotation: 0,
    wallId: "top",
    wallOffset: partial.x,
    ...partial,
  } as PlacedCabinet;
}

describe("face-projected walls", () => {
  it("sends a 90° wall straight out from the wall face", () => {
    const direction = faceProjectionDirection(topWall, 90, "right");
    expect(direction.x).toBeCloseTo(0, 5);
    expect(direction.y).toBeCloseTo(1, 5);
    const placed = placeAttachedWall({
      scene: { room },
      frame: topWall,
      clickPoint: { x: 60, y: 4 },
      lengthIn: 36,
      heightIn: 96,
      angle: 90,
    });
    expect(placed && "newWallId" in placed).toBe(true);
    if (!placed || !("newWallId" in placed)) return;
    const wall = placed.customWalls.find((candidate) => candidate.id === placed.newWallId);
    const start = placed.vertices.find((vertex) => vertex.id === wall?.startVertexId);
    const end = placed.vertices.find((vertex) => vertex.id === wall?.endVertexId);
    expect(start?.y).toBeCloseTo(0, 3);
    expect(end!.y - start!.y).toBeCloseTo(36, 3);
    expect(end!.x).toBeCloseTo(start!.x, 3);
    expect(wall?.hostWallId).toBe("top");
    expect(wall?.hostAngle).toBe(90);
    expect(placed.preserveCardinalWalls).toBe(true);
    expect(placed.width).toBe(120);
    expect(placed.depth).toBe(96);
  });

  it("leans a 45° wall to the right or the left of straight out", () => {
    const right = faceProjectionDirection(topWall, 45, "right");
    const left = faceProjectionDirection(topWall, 45, "left");
    expect(right.x).toBeGreaterThan(0.5);
    expect(right.y).toBeGreaterThan(0.5);
    expect(left.x).toBeLessThan(-0.5);
    expect(left.y).toBeGreaterThan(0.5);
    const placed = placeAttachedWall({
      scene: { room },
      frame: topWall,
      clickPoint: { x: 60, y: 2 },
      lengthIn: 40,
      heightIn: 96,
      angle: 45,
      turn: "left",
    });
    expect(placed && "error" in placed).toBe(false);
    if (!placed || !("newWallId" in placed)) return;
    const wall = placed.customWalls.find((candidate) => candidate.id === placed.newWallId);
    expect(wall?.hostTurn).toBe("left");
    expect(wall?.hostAngle).toBe(45);
    const start = placed.vertices.find((vertex) => vertex.id === wall?.startVertexId)!;
    const end = placed.vertices.find((vertex) => vertex.id === wall?.endVertexId)!;
    expect(end.x).toBeLessThan(start.x);
    expect(end.y).toBeGreaterThan(start.y);
  });

  it("does not move the host room when the new wall is added", () => {
    const placed = placeAttachedWall({
      scene: { room, placed: [cabinet({ x: 10, y: 0, width: 24, depth: 24 })] },
      frame: topWall,
      clickPoint: { x: 90, y: 1 },
      lengthIn: 30,
      heightIn: 84,
      angle: 90,
    });
    expect(placed && "translation" in placed && placed.translation).toEqual({ x: 0, y: 0 });
    expect(placed && "width" in placed && placed.width).toBe(120);
  });

  it("puts the wall in the nearest open spot when the click overlaps a cabinet", () => {
    const blocking = cabinet({ x: 48, y: 0, width: 24, depth: 24 });
    const placed = placeAttachedWall({
      scene: { room, placed: [blocking] },
      frame: topWall,
      clickPoint: { x: 60, y: 2 },
      lengthIn: 30,
      heightIn: 96,
      angle: 90,
    });
    expect(placed && "snapped" in placed && placed.snapped).toBe(true);
    if (!placed || !("offset" in placed)) return;
    const footprint = faceWallFootprint(topWall, placed.offset, 30, 90, "right");
    const cabinetBox = [
      { x: 48, y: 0 },
      { x: 72, y: 0 },
      { x: 72, y: 24 },
      { x: 48, y: 24 },
    ];
    const overlap = footprint.some((point) => point.x > 48.2 && point.x < 71.8 && point.y > 0.2 && point.y < 23.8);
    expect(overlap).toBe(false);
    expect(placed.offset).toBeLessThan(48);
  });

  it("stops a drag against a cabinet instead of jumping over it", () => {
    const blocking = cabinet({ x: 70, y: 0, width: 20, depth: 24 });
    const first = placeAttachedWall({
      scene: { room, placed: [blocking] },
      frame: topWall,
      clickPoint: { x: 30, y: 1 },
      lengthIn: 30,
      heightIn: 96,
      angle: 90,
    });
    expect(first && "newWallId" in first).toBe(true);
    if (!first || !("newWallId" in first)) return;
    const nextRoom: RoomData = {
      ...room,
      vertices: first.vertices,
      customWalls: first.customWalls,
      preserveCardinalWalls: true,
    };
    const dragged = slideAttachedWall({
      scene: { room: nextRoom, placed: [blocking] },
      wallId: first.newWallId,
      point: { x: 80, y: 0 },
      grabAlong: 0,
    });
    expect(dragged).not.toBeNull();
    expect(dragged!.offset).toBeLessThan(70);
    expect(dragged!.offset).toBeGreaterThan(first.offset);
    const jumped = slideAttachedWall({
      scene: { room: { ...nextRoom, vertices: dragged!.vertices, customWalls: dragged!.customWalls }, placed: [blocking] },
      wallId: first.newWallId,
      point: { x: 110, y: 0 },
      grabAlong: 0,
    });
    expect(jumped!.offset).toBeLessThan(70);
  });

  it("refuses when the wall cannot fit anywhere on the host", () => {
    const free = hostedWallFreeOffsets(topWall, 30, 90, "right", [
      [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 120, y: 40 },
        { x: 0, y: 40 },
      ],
    ]);
    expect(resolveHostedWallOffset(60, free)).toBeNull();
    const placed = placeAttachedWall({
      scene: { room, placed: [cabinet({ x: 0, y: 0, width: 120, depth: 36 })] },
      frame: topWall,
      clickPoint: { x: 60, y: 1 },
      lengthIn: 30,
      heightIn: 96,
      angle: 90,
    });
    expect(placed && "error" in placed && placed.error.length > 0).toBe(true);
  });

  it("projects the click onto the host wall", () => {
    expect(hostOffsetAtPoint(topWall, { x: 42, y: 18 })).toBeCloseTo(42, 5);
  });
});

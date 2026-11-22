import { describe, expect, it } from "vitest";
import { placeAttachedWall } from "./attachedWall";
import type { PlacedCabinet, RoomData } from "./design";
import { cabinetWall } from "./design";
import type { WallAttachmentFrame } from "./polygonRoom";
import {
  CARDINAL_WALL_DELETE_REASON,
  HOSTED_WALL_DELETE_REASON,
  LAST_WALL_DELETE_REASON,
  LAYOUT_LOCKED_DELETE_REASON,
  PENINSULA_RETURN_DELETE_REASON,
  countCabinetsOnWall,
  deleteHighlightedCustomWall,
  wallDeleteDisabledReason,
} from "./wallDeletion";

const topWall: WallAttachmentFrame = {
  id: "top",
  start: { x: 0, y: 0 },
  end: { x: 144, y: 0 },
  angle: 0,
  inward: { x: 0, y: 1 },
  length: 144,
};

const rectangle: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function cabinet(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "wallId" | "x" | "y">): PlacedCabinet {
  return {
    masterCode: "B24",
    description: "Base",
    placement: "base",
    width: 24,
    depth: 24,
    rotation: 0,
    ...partial,
  } as PlacedCabinet;
}

function hostedRoom(): RoomData {
  const first = placeAttachedWall({
    scene: { room: rectangle },
    frame: topWall,
    clickPoint: { x: 36, y: 1 },
    lengthIn: 30,
    heightIn: 96,
    angle: 45,
    turn: "right",
    label: "45° right wall",
  });
  if (!first || !("newWallId" in first)) throw new Error("first wall was not added");
  const withFirst: RoomData = {
    ...rectangle,
    vertices: first.vertices,
    customWalls: first.customWalls,
    preserveCardinalWalls: true,
  };
  const second = placeAttachedWall({
    scene: { room: withFirst },
    frame: topWall,
    clickPoint: { x: 110, y: 1 },
    lengthIn: 28,
    heightIn: 90,
    angle: 90,
    label: "90° wall",
  });
  if (!second || !("newWallId" in second)) throw new Error("second wall was not added");
  return {
    ...withFirst,
    vertices: second.vertices,
    customWalls: second.customWalls,
    width: second.width,
    depth: second.depth,
    preserveCardinalWalls: true,
    dimensionAdjustments: {
      "wall:top": { outsideIn: 2 },
      [`wall:${first.newWallId}`]: { alongIn: 4 },
      [`run:${first.newWallId}:base:0`]: { outsideIn: 1 },
      "run:top:base:0": { alongIn: 3 },
      "opening:door-on-added": { outsideIn: 1 },
      "opening:door-on-back": { outsideIn: 5 },
    },
    deletedFillerSuppressions: [
      { groupId: null, wallId: first.newWallId, layer: "base", start: 0, end: 3 },
      { groupId: "keep", wallId: "top", layer: "base", start: 10, end: 14 },
    ],
  };
}

describe("delete highlighted wall", () => {
  it("deletes only the right-clicked added wall and leaves the rectangular room and the other wall alone", () => {
    const room = hostedRoom();
    const angled = room.customWalls!.find((wall) => wall.label === "45° right wall")!;
    const straight = room.customWalls!.find((wall) => wall.label === "90° wall")!;
    const straightEnds = {
      start: room.vertices!.find((vertex) => vertex.id === straight.startVertexId),
      end: room.vertices!.find((vertex) => vertex.id === straight.endVertexId),
    };
    const onAngled = cabinet({ uid: "on-angled", wallId: angled.id, x: 30, y: 10 });
    const onBack = cabinet({ uid: "on-back", wallId: "top", x: 12, y: 0 });
    const onStraight = cabinet({ uid: "on-straight", wallId: straight.id, x: 100, y: 10 });

    expect(wallDeleteDisabledReason({ room, wallId: angled.id })).toBeNull();
    expect(countCabinetsOnWall([onAngled, onBack, onStraight], room, angled.id)).toBe(1);
    expect(countCabinetsOnWall([onAngled, onBack, onStraight], room, straight.id)).toBe(1);
    expect(countCabinetsOnWall([onAngled, onBack, onStraight], room, "top")).toBe(1);

    const deleted = deleteHighlightedCustomWall(room, angled.id, ["door-on-added"]);
    expect(deleted).not.toBeNull();
    expect(deleted!.customWalls).toHaveLength(1);
    expect(deleted!.customWalls!.some((wall) => wall.id === angled.id)).toBe(false);
    expect(deleted!.customWalls![0]).toBe(straight);
    expect(deleted!.vertices!.find((vertex) => vertex.id === straight.startVertexId)).toEqual(straightEnds.start);
    expect(deleted!.vertices!.find((vertex) => vertex.id === straight.endVertexId)).toEqual(straightEnds.end);
    expect(deleted!.width).toBe(144);
    expect(deleted!.depth).toBe(120);
    expect(deleted!.preserveCardinalWalls).toBe(true);
    expect(deleted!.openWallPath).toBeUndefined();
    expect(deleted!.dimensionAdjustments).toEqual({
      "wall:top": { outsideIn: 2 },
      "run:top:base:0": { alongIn: 3 },
      "opening:door-on-back": { outsideIn: 5 },
    });
    expect(deleted!.deletedFillerSuppressions).toEqual([
      { groupId: "keep", wallId: "top", layer: "base", start: 10, end: 14 },
    ]);
    expect(cabinetWall(onBack, deleted!)).toBe("top");
    expect(cabinetWall(onStraight, deleted!)).toBe(straight.id);
    expect(countCabinetsOnWall([onBack, onStraight], deleted!, straight.id)).toBe(1);
    expect(countCabinetsOnWall([onBack, onStraight], deleted!, "top")).toBe(1);
  });

  it("returns a rectangular room when the last added wall is deleted", () => {
    const room = hostedRoom();
    const straight = room.customWalls!.find((wall) => wall.label === "90° wall")!;
    const onlyAngled: RoomData = {
      ...room,
      customWalls: room.customWalls!.filter((wall) => wall.id !== straight.id),
      vertices: room.vertices!.filter((vertex) => vertex.id === room.customWalls!.find((wall) => wall.label === "45° right wall")!.startVertexId || vertex.id === room.customWalls!.find((wall) => wall.label === "45° right wall")!.endVertexId),
    };
    const angled = onlyAngled.customWalls![0]!;
    const deleted = deleteHighlightedCustomWall(onlyAngled, angled.id);
    expect(deleted).not.toBeNull();
    expect(deleted!.customWalls).toBeUndefined();
    expect(deleted!.vertices).toBeUndefined();
    expect(deleted!.preserveCardinalWalls).toBeUndefined();
    expect(deleted!.width).toBe(144);
    expect(deleted!.depth).toBe(120);
    expect(deleted!.ceilingHeight).toBe(96);
  });

  it("refuses the last drawn wall and a wall that still hosts another wall", () => {
    const drawn: RoomData = {
      width: 120,
      depth: 96,
      vertices: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 120, y: 0 },
        { id: "c", x: 120, y: 96 },
      ],
      customWalls: [
        { id: "back", startVertexId: "a", endVertexId: "b", label: "Back", height: 96 },
        { id: "right", startVertexId: "b", endVertexId: "c", label: "Right", height: 96 },
      ],
    };
    expect(wallDeleteDisabledReason({ room: drawn, wallId: "back" })).toBeNull();
    const deleted = deleteHighlightedCustomWall(drawn, "back");
    expect(deleted!.customWalls).toEqual([drawn.customWalls![1]]);
    expect(deleted!.customWalls![0]).toBe(drawn.customWalls![1]);
    expect(deleted!.openWallPath).toBe(true);
    expect(deleted!.vertices).toEqual([
      { id: "b", x: 120, y: 0 },
      { id: "c", x: 120, y: 96 },
    ]);

    const lastWall: RoomData = {
      ...drawn,
      customWalls: [drawn.customWalls![1]!],
      vertices: [drawn.vertices![1]!, drawn.vertices![2]!],
    };
    expect(wallDeleteDisabledReason({ room: lastWall, wallId: "right" })).toBe(LAST_WALL_DELETE_REASON);
    expect(deleteHighlightedCustomWall(lastWall, "right")).toBeNull();

    const hostedOnDrawn: RoomData = {
      ...drawn,
      customWalls: [
        ...drawn.customWalls!,
        { id: "added", startVertexId: "a", endVertexId: "c", label: "45° right wall", hostWallId: "back" },
      ],
    };
    expect(wallDeleteDisabledReason({ room: hostedOnDrawn, wallId: "back" })).toBe(HOSTED_WALL_DELETE_REASON);
    expect(deleteHighlightedCustomWall(hostedOnDrawn, "back")).toBeNull();
    expect(wallDeleteDisabledReason({ room: rectangle, wallId: "top" })).toBe(CARDINAL_WALL_DELETE_REASON);
    expect(deleteHighlightedCustomWall(rectangle, "top")).toBeNull();
  });

  it("disables a locked layout and a peninsula that would take a connected return with it", () => {
    const room: RoomData = {
      ...rectangle,
      vertices: [{ id: "a", x: 20, y: 0 }, { id: "b", x: 20, y: 36 }],
      customWalls: [{ id: "added", startVertexId: "a", endVertexId: "b", label: "90° wall", hostWallId: "top" }],
      preserveCardinalWalls: true,
      peninsulaRuns: [
        { id: "pen-root", parentWall: "top", startOffset: 40, turn: 90, direction: "right", length: 48, height: 96, label: "Peninsula" },
        { id: "pen-return", parentRunId: "pen-root", startOffset: 0, turn: 90, direction: "left", length: 24, height: 96, label: "Return" },
      ],
    };
    expect(wallDeleteDisabledReason({ room, wallId: "added", layoutLocked: true })).toBe(LAYOUT_LOCKED_DELETE_REASON);
    expect(wallDeleteDisabledReason({ room, wallId: "pen-root" })).toBe(PENINSULA_RETURN_DELETE_REASON);
    expect(wallDeleteDisabledReason({ room, wallId: "pen-return" })).toBeNull();
    expect(deleteHighlightedCustomWall(room, "added")).not.toBeNull();
  });
});

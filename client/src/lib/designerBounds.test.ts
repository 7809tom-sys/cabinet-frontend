import { describe, expect, it } from "vitest";
import {
  boundedWallPlacementAt,
  cabinetInsideBounds,
  cabinetInsideWallRun,
  spanFitsWallRun,
  uShapeRunWallLabels,
} from "./designerBounds";
import {
  DEFAULT_ROOM,
  appendCollisionFreePlacements,
  cabinetWall,
  wallPlacementAt,
  wallRunFrame,
  type PlacedCabinet,
} from "./design";

function base(uid: string, width: number, start: number, wall: "top" | "bottom" | "left" | "right" = "top"): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 24, wall, DEFAULT_ROOM);
  return {
    uid,
    cabinetId: 1,
    masterCode: `B${width}`,
    description: `${width} inch base cabinet`,
    category: "Base",
    subCategory: "Base",
    placement: "base",
    ...spot,
    width,
    depth: 24,
    height: 34.5,
    numberOfDoors: 1,
    numberOfDrawers: 1,
  } as PlacedCabinet;
}

describe("designer bounds", () => {
  it("never seats a cabinet past the end of its wall", () => {
    const room = { ...DEFAULT_ROOM, width: 120 };
    expect(spanFitsWallRun(96, 30, "top", room)).toBe(false);
    expect(boundedWallPlacementAt(96, 30, 24, "top", room)).toBeNull();
    // 96 + 24 = 120 is the exact wall end and is allowed.
    const fit = boundedWallPlacementAt(96, 24, 24, "top", room);
    expect(fit).not.toBeNull();
    expect(fit!.wallOffset).toBeCloseTo(96, 5);
  });

  it("rejects a body built by hand that hangs past the wall end", () => {
    const room = { ...DEFAULT_ROOM, width: 120 };
    // wallPlacementAt folds an over-long start back so the box still fits; a hand-built record
    // (a saved design, an import, a legacy filler) can still hang. The bounds gate catches that.
    const spot = wallPlacementAt(96, 60, 24, "top", room);
    expect(spot.wallOffset).toBeCloseTo(60, 5);
    const hung = { ...base("wide", 60, 0), ...spot, width: 60, wallOffset: 96 };
    expect(wallRunFrame("top", room)!.runEnd).toBeCloseTo(120, 5);
    expect(cabinetInsideWallRun(hung, room)).toBe(false);
    expect(cabinetInsideBounds(hung, room)).toBe(false);
  });

  it("keeps every body inside the room shell", () => {
    const room = { ...DEFAULT_ROOM, width: 120 };
    const inside = base("ok", 24, 0);
    expect(cabinetInsideBounds(inside, room)).toBe(true);
    const outside = { ...inside, uid: "out", y: room.depth + 10 };
    expect(cabinetInsideBounds(outside, room)).toBe(false);
  });

  it("adds only the candidates that stay inside the bounds", () => {
    const room = { ...DEFAULT_ROOM, width: 120 };
    const first = base("first", 36, 0);
    const hung = { ...base("hung", 90, 0), ...wallPlacementAt(60, 90, 24, "top", room), width: 90 };
    const result = appendCollisionFreePlacements([first], [hung], room);
    const accepted = result.placed.find((item) => item.uid === "hung");
    expect(accepted == null || cabinetInsideBounds(accepted, room)).toBe(true);
  });

  it("caps a U-shape at Wall 1-3 unless the room really has a fourth wall", () => {
    expect(uShapeRunWallLabels(false)).toEqual(["Wall 1", "Wall 2", "Wall 3"]);
    expect(uShapeRunWallLabels(true)).toEqual(["Wall 1", "Wall 2", "Wall 3", "Wall 4"]);
  });

  it("measures the run of a vertical wall too", () => {
    const room = { ...DEFAULT_ROOM, width: 120 };
    // A 130" body on a 120" vertical run cannot sit inside that run whatever the start is.
    const tall = { ...base("side", 130, 0, "right"), ...wallPlacementAt(0, 130, 24, "right", room), width: 130 };
    expect(cabinetWall(tall, room)).toBe("right");
    expect(cabinetInsideWallRun(tall, room)).toBe(false);
  });
});

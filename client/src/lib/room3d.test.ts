import { describe, it, expect } from "vitest";
import {
  buildRoomBoxes,
  surfaceColorsFromPicks,
  hasSinkPick,
  DEFAULT_SURFACE_COLORS,
  type SurfacePickLike,
} from "./room3d";
import { STD, WALL_MOUNT_BOTTOM, type PlacedCabinet, type RoomData } from "./design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function base(uid: string, x: number, y: number, width = 24): PlacedCabinet {
  return {
    uid,
    cabinetId: 1,
    masterCode: "B24",
    description: "Base 24",
    placement: "base",
    x,
    y,
    width,
    depth: STD.BASE_DEPTH,
    rotation: 0,
  } as PlacedCabinet;
}

function wall(uid: string, x: number, y: number): PlacedCabinet {
  return {
    uid,
    cabinetId: 2,
    masterCode: "W2430",
    description: "Wall 24x30",
    placement: "wall",
    x,
    y,
    width: 24,
    depth: STD.WALL_DEPTH,
    height: STD.WALL_HEIGHT,
    rotation: 0,
  } as PlacedCabinet;
}

describe("buildRoomBoxes", () => {
  it("always includes a floor and four walls even with no cabinets", () => {
    const boxes = buildRoomBoxes({ room, placed: [] });
    expect(boxes.find((b) => b.kind === "floor")).toBeTruthy();
    const walls = boxes.filter((b) => b.kind === "wall-structure");
    expect(walls.length).toBe(4);
  });

  it("floor spans the full room footprint", () => {
    const boxes = buildRoomBoxes({ room, placed: [] });
    const floor = boxes.find((b) => b.kind === "floor")!;
    expect(floor.size[0]).toBe(room.width);
    expect(floor.size[2]).toBe(room.depth);
  });

  it("places a base cabinet box on the floor (bottom at y=0)", () => {
    const boxes = buildRoomBoxes({ room, placed: [base("b1", 0, 0)] });
    const box = boxes.find((b) => b.id === "b1")!;
    expect(box.kind).toBe("base-cabinet");
    // center.y = bottom + height/2, bottom = 0 → center.y = height/2
    expect(box.center[1]).toBeCloseTo(STD.BASE_HEIGHT / 2, 5);
  });

  it("hangs a wall cabinet with its bottom at the 54\" mount line", () => {
    const boxes = buildRoomBoxes({ room, placed: [wall("w1", 0, 0)] });
    const box = boxes.find((b) => b.id === "w1")!;
    expect(box.kind).toBe("wall-cabinet");
    // center.y = mountBottom + height/2
    expect(box.center[1]).toBeCloseTo(WALL_MOUNT_BOTTOM + STD.WALL_HEIGHT / 2, 5);
  });

  it("lays a countertop over each base cabinet at counter height", () => {
    const boxes = buildRoomBoxes({ room, placed: [base("b1", 0, 0)] });
    const counters = boxes.filter((b) => b.kind === "countertop");
    expect(counters.length).toBe(1);
    expect(counters[0].center[1]).toBeCloseTo(
      STD.COUNTERTOP_HEIGHT + STD.COUNTERTOP_THICKNESS / 2,
      5,
    );
  });

  it("does not create a countertop for a wall cabinet", () => {
    const boxes = buildRoomBoxes({ room, placed: [wall("w1", 0, 0)] });
    expect(boxes.filter((b) => b.kind === "countertop").length).toBe(0);
  });

  it("adds a backsplash strip when a base run touches the back wall", () => {
    const boxes = buildRoomBoxes({ room, placed: [base("b1", 0, 0)] });
    const bs = boxes.find((b) => b.kind === "backsplash");
    expect(bs).toBeTruthy();
    // Bottom at counter height, top at the mount line.
    expect(bs!.center[1]).toBeCloseTo(
      STD.COUNTERTOP_HEIGHT + (WALL_MOUNT_BOTTOM - STD.COUNTERTOP_HEIGHT) / 2,
      5,
    );
  });

  it("adds a sink basin only when a sink surface is selected", () => {
    const noSink = buildRoomBoxes({ room, placed: [base("b1", 0, 0)] });
    expect(noSink.find((b) => b.kind === "sink")).toBeFalsy();

    const withSink = buildRoomBoxes({
      room,
      placed: [base("b1", 0, 0)],
      surfaces: [{ category: "Sinks & Faucets", subCategory: "Sinks", name: "Undermount Sink" }],
    });
    expect(withSink.find((b) => b.kind === "sink")).toBeTruthy();
  });

  it("colors cabinet boxes from the finish text", () => {
    const white = buildRoomBoxes({ room, placed: [base("b1", 0, 0)], finishText: "Arctic White Shaker" });
    const box = white.find((b) => b.id === "b1")!;
    expect(box.color.toLowerCase()).toBe("#f3f1ec");
  });
});

describe("surfaceColorsFromPicks", () => {
  it("returns defaults for empty picks", () => {
    expect(surfaceColorsFromPicks(null)).toEqual(DEFAULT_SURFACE_COLORS);
    expect(surfaceColorsFromPicks([])).toEqual(DEFAULT_SURFACE_COLORS);
  });

  it("maps flooring / countertop / backsplash picks to their swatches", () => {
    const picks: SurfacePickLike[] = [
      { category: "Flooring", subCategory: "Planks & Flooring", name: "Walnut Oak Plank" },
      { category: "Quartz Slabs (Countertops)", name: "Calacatta White Quartz" },
      { category: "Tile & Mosaic", subCategory: "Tile", name: "Slate Grey Subway" },
    ];
    const c = surfaceColorsFromPicks(picks);
    expect(c.floor).not.toBe(DEFAULT_SURFACE_COLORS.floor);
    expect(c.counter.toLowerCase()).toBe("#eeece7"); // white/calacatta
    expect(c.backsplash.toLowerCase()).toBe("#b7b8b6"); // grey
  });
});

describe("hasSinkPick", () => {
  it("is true only when a sink role is present", () => {
    expect(hasSinkPick([{ category: "Sinks & Faucets", subCategory: "Sinks", name: "Sink" }])).toBe(true);
    expect(hasSinkPick([{ category: "Sinks & Faucets", subCategory: "Faucets", name: "Faucet" }])).toBe(false);
    expect(hasSinkPick([{ category: "Flooring", name: "Oak" }])).toBe(false);
    expect(hasSinkPick(null)).toBe(false);
  });
});

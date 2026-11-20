import { describe, expect, it } from "vitest";
import {
  threeDBacksplashSegments,
  threeDBacksplashTakeoffSqFt,
  threeDRenderedBacksplashSegments,
  type ThreeDBacksplashSegment,
} from "./InteractiveRoom3D";
import { wallLength, wallPlacementAt, type PlacedCabinet, type RoomData, type WallOpening } from "@/lib/design";

/** U-shaped kitchen: left wall, short 45-degree return, range wall, short 45-degree return, right (window) wall. */
function uRoom(chamfer = 20): RoomData {
  return {
    width: 180,
    depth: 150,
    ceilingHeight: 96,
    openWallPath: true,
    vertices: [
      { id: "a", x: 0, y: 150 },
      { id: "b", x: 0, y: chamfer },
      { id: "c", x: chamfer, y: 0 },
      { id: "d", x: 180 - chamfer, y: 0 },
      { id: "e", x: 180, y: chamfer },
      { id: "f", x: 180, y: 150 },
    ],
    customWalls: [
      { id: "wall-left", startVertexId: "a", endVertexId: "b" },
      { id: "wall-nw", startVertexId: "b", endVertexId: "c", lockedAngle: 45 },
      { id: "wall-back", startVertexId: "c", endVertexId: "d" },
      { id: "wall-ne", startVertexId: "d", endVertexId: "e", lockedAngle: 45 },
      { id: "wall-right", startVertexId: "e", endVertexId: "f" },
    ],
  } as RoomData;
}

function place(
  uid: string,
  masterCode: string,
  description: string,
  placement: PlacedCabinet["placement"],
  width: number,
  depth: number,
  wallId: string,
  wallOffset: number,
  room: RoomData,
  extra: Partial<PlacedCabinet> = {},
): PlacedCabinet {
  return {
    uid,
    cabinetId: 0,
    masterCode,
    description,
    placement,
    width,
    depth,
    height: placement === "wall" ? 30 : placement === "appliance" ? 36 : 34.5,
    numberOfDoors: 1,
    numberOfDrawers: 0,
    ...wallPlacementAt(wallOffset, width, depth, wallId, room),
    wallId,
    wallOffset,
    ...extra,
  } as PlacedCabinet;
}

const on = (segments: ThreeDBacksplashSegment[], side: string) => segments.filter((segment) => segment.side === side);
const area = (segments: ThreeDBacksplashSegment[]) => segments.reduce((sum, s) => sum + ((s.end - s.start) * (s.top - s.bottom)) / 144, 0);
/** True when the tile on this wall (taken together) covers every point of the rectangle (along x height). */
function covers(segments: ThreeDBacksplashSegment[], side: string, start: number, end: number, bottom: number, top: number) {
  const tiles = on(segments, side);
  for (let x = start + 0.25; x < end; x += 0.5) {
    for (let y = bottom + 0.25; y < top; y += 0.5) {
      if (!tiles.some((s) => s.start <= x && s.end >= x && s.bottom <= y && s.top >= y)) return false;
    }
  }
  return true;
}
/** True when any tile overlaps the rectangle. */
function touches(segments: ThreeDBacksplashSegment[], side: string, start: number, end: number, bottom: number, top: number) {
  return on(segments, side).some((s) => s.start < end - 0.01 && s.end > start + 0.01 && s.bottom < top - 0.01 && s.top > bottom + 0.01);
}

describe("backsplash covers every wall segment, 45-degree returns, under windows and behind the hood", () => {
  it("tiles a short 45-degree return end to end, counter up to the uppers, on both sides of the range wall", () => {
    const room = uRoom(20);
    expect(wallLength("wall-nw", room)).toBeCloseTo(28.28, 1);
    // An 18-inch base and upper hang on each short return; 10 inches of bare wall would otherwise remain.
    const placed = [
      place("b-nw", "B18", "18 inch Base", "base", 18, 24, "wall-nw", 0, room),
      place("w-nw", "W1830", "18 inch Wall", "wall", 18, 12, "wall-nw", 0, room),
      place("b-ne", "B18", "18 inch Base", "base", 18, 24, "wall-ne", 10, room),
      place("w-ne", "W1830", "18 inch Wall", "wall", 18, 12, "wall-ne", 10, room),
      place("range", "RANGE-30", '30" Freestanding Range', "appliance", 30, 25, "wall-back", 60, room),
    ];
    const segments = threeDRenderedBacksplashSegments(placed, [], room);
    for (const side of ["wall-nw", "wall-ne"]) {
      const length = wallLength(side, room);
      expect(covers(segments, side, 0, length, 36, 54), `${side} counter-to-uppers tile spans the whole short wall`).toBe(true);
    }
  });

  it("bridges a bare strip of 12 inches or less on a long 45-degree wall, but not a large open stretch", () => {
    const room = uRoom(60); // 84.9 inch angled walls
    const placed = [place("b-nw", "B18", "18 inch Base", "base", 18, 24, "wall-nw", 10, room)];
    const segments = threeDRenderedBacksplashSegments(placed, [], room);
    expect(covers(segments, "wall-nw", 0, 28, 36, 54)).toBe(true); // 10 inch strip to the corner is tiled
    expect(touches(segments, "wall-nw", 40, 80, 36, 54)).toBe(false); // the open wall beyond stays open
  });

  it("wraps tile onto the return wall behind a corner cabinet seated on the neighbouring drawn wall", () => {
    const room = uRoom(60);
    const corner = place("lazy", "LS36", "Lazy Susan Corner", "base", 36, 36, "wall-nw", 0, room, { cornerType: "l-shape" } as Partial<PlacedCabinet>);
    const segments = threeDRenderedBacksplashSegments([corner], [], room);
    expect(on(segments, "wall-nw").length).toBeGreaterThan(0);
    const leftLength = wallLength("wall-left", room);
    expect(covers(segments, "wall-left", leftLength - 36, leftLength, 36, 54)).toBe(true);
  });

  it("keeps the strip of tile between counter and sill across a whole window on a drawn wall, and leaves the glass open", () => {
    const room = uRoom(20);
    // A 36 inch sink base, but a 48 inch window that overhangs the base run.
    const placed = [
      place("b24", "B24", "24 inch Base", "base", 24, 24, "wall-right", 30, room),
      place("sb", "SB36", "36 inch Sink Base", "base", 36, 24, "wall-right", 54, room),
    ];
    const openings = [{ id: "win", side: "wall-right", offset: 52, width: 48, sill: 46, height: 36, type: "window" }] as unknown as WallOpening[];
    const segments = threeDRenderedBacksplashSegments(placed, openings, room);
    expect(covers(segments, "wall-right", 52, 100, 36, 46)).toBe(true);
    expect(touches(segments, "wall-right", 52, 100, 46, 82)).toBe(false);
    // Tile still reaches the wall beside the window up to the standard height.
    expect(covers(segments, "wall-right", 30, 52, 36, 54)).toBe(true);
  });

  it("does not invent tile under a window with no counter anywhere near it", () => {
    const room = uRoom(20);
    const placed = [place("b24", "B24", "24 inch Base", "base", 24, 24, "wall-left", 20, room)];
    const openings = [{ id: "win", side: "wall-right", offset: 40, width: 36, sill: 46, height: 36, type: "window" }] as unknown as WallOpening[];
    expect(on(threeDRenderedBacksplashSegments(placed, openings, room), "wall-right")).toEqual([]);
  });

  it("runs one even tile column behind the hood from the counter to the top of the adjacent wall cabinets", () => {
    const room = uRoom(20);
    const placed = [
      place("range", "RANGE-30", '30" Freestanding Range', "appliance", 30, 25, "wall-back", 50, room),
      place("hood", "HOOD-30", '30" Stainless Range Hood', "appliance", 30, 18, "wall-back", 50, room),
      place("wl", "W1236", "12 inch Wall", "wall", 12, 12, "wall-back", 38, room, { height: 36 }),
      place("wr", "W1236", "12 inch Wall", "wall", 12, 12, "wall-back", 80, room, { height: 36 }),
    ];
    const segments = threeDRenderedBacksplashSegments(placed, [], room);
    // 54 + 36 inch uppers: the tile column behind the hood goes up to 90 inches, with no hole where the hood box is.
    expect(covers(segments, "wall-back", 50, 80, 36, 90)).toBe(true);
    const column = on(segments, "wall-back").filter((s) => s.start <= 50.01 && s.end >= 79.99 && s.top > 54);
    expect(column).toHaveLength(1);
    expect(column[0]!.bottom).toBeCloseTo(54, 3);
    expect(column[0]!.top).toBeCloseTo(90, 3);
    // Pricing matches exactly what is drawn, including the added tile above the hood.
    const drawn = threeDBacksplashSegments(placed, [], room);
    expect(threeDBacksplashTakeoffSqFt(segments)).toBe(Math.round(area(drawn) * 10) / 10);
    expect(area(segments)).toBeGreaterThan((30 * 18) / 144 + 0.0001);
  });

  it("stops the hood column at the standard wall cabinet line when no uppers sit beside it, and widens past a narrow range", () => {
    const room = uRoom(20);
    const placed = [
      place("range", "RANGE-30", '30" Freestanding Range', "appliance", 30, 25, "wall-back", 50, room),
      place("hood", "HOOD-30", '30" Stainless Range Hood', "appliance", 30, 18, "wall-back", 50, room),
    ];
    const segments = threeDRenderedBacksplashSegments(placed, [], room);
    expect(covers(segments, "wall-back", 50, 80, 36, 84)).toBe(true);
    expect(touches(segments, "wall-back", 50, 80, 84, 96)).toBe(false);
    // A 36 inch range under a 30 inch hood: the extra 3 inches each side stays tiled to the hood's bottom edge only.
    const wide = [
      place("range", "RANGE-36", '36" Freestanding Range', "appliance", 36, 25, "wall-back", 47, room),
      place("hood", "HOOD-30", '30" Stainless Range Hood', "appliance", 30, 18, "wall-back", 50, room),
    ];
    const wideSegments = threeDRenderedBacksplashSegments(wide, [], room);
    expect(covers(wideSegments, "wall-back", 47, 83, 36, 66)).toBe(true);
    expect(touches(wideSegments, "wall-back", 47, 50, 66, 84)).toBe(false);
    expect(covers(wideSegments, "wall-back", 50, 80, 36, 84)).toBe(true);
  });

  it("leaves a range with no hood exactly as before", () => {
    const room = uRoom(20);
    const placed = [place("range", "RANGE-30", '30" Freestanding Range', "appliance", 30, 25, "wall-back", 50, room)];
    expect(on(threeDRenderedBacksplashSegments(placed, [], room), "wall-back")).toEqual([
      { side: "wall-back", start: 50, end: 80, bottom: 36, top: 54 },
    ]);
  });
});

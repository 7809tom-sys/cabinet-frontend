import { describe, expect, it } from "vitest";
import { appendWallBuilderSegment, wallBuilderRoomGeometry, type WallBuilderSegment } from "./polygonRoom";
import { threeDCrownPerimeterSegments } from "@/components/design/InteractiveRoom3D";
import { crownTakeoffFromExposedSegments } from "./crownTakeoff";
import {
  cabinetTakeoffWallId, crownLinearInches, lightRailTakeoff, syncWallRunOffsets,
  toeKickLinearInches, wallCabinetVerticalMoveLimit, wallCeiling, wallPlacementAt,
  type PlacedCabinet, type RoomData, wallTopLimit, wallRunFrame, ceilingFitViolations } from "./design";

function drawnRoom(turn: "right90" | "right45" = "right90"): RoomData {
  let segments: WallBuilderSegment[] = [];
  segments = appendWallBuilderSegment(segments, 100, "start");
  segments = appendWallBuilderSegment(segments, 60, turn);
  const result = wallBuilderRoomGeometry(segments);
  if (!result.room) throw new Error(result.error ?? "invalid room");
  return { ...result.room, ceilingHeight: 96 };
}
function cabinet(room: RoomData, wall: string, code: string, placement: "base" | "wall", width: number, depth: number, offset = 25): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, depth, wall as never, room);
  return { ...spot, uid: `${code}-${offset}`, cabinetId: 1, masterCode: code, description: code,
    placement, width, depth, height: placement === "wall" ? 30 : 34.5 };
}
const STANDARD: RoomData = { width: 100, depth: 120, ceilingHeight: 96 };
const DRAWN = drawnRoom();
const ROOMS = [["standard", STANDARD, "top"], ["drawn", DRAWN, DRAWN.customWalls![0]!.id]] as const;

describe("Phase 2 shared takeoffs when wall seating metadata is cleared", () => {
  it("production crown, toe kick, and light rail totals match on rotated and inward-moved cabinets", () => {
    const totals = ROOMS.map(([, room, wall]) => {
      const upper = cabinet(room, wall, "W3030", "wall", 30, 12);
      const base = cabinet(room, wall, "B36", "base", 36, 24, 60);
      const states = [
        syncWallRunOffsets([{ ...upper, rotation: 90 }, { ...base, rotation: 45 }], room),
        syncWallRunOffsets([{ ...upper, y: upper.y + 1 }, { ...base, y: base.y + 1 }], room),
      ];
      return states.map(([w, b]) => ({
        crown: crownTakeoffFromExposedSegments(threeDCrownPerimeterSegments([w!], room)).totalLinearInches,
        crownWidthEstimate: crownLinearInches([w!], room),
        toeKick: toeKickLinearInches([b!]),
        lightRail: lightRailTakeoff([w!], room).totalLinearInches,
      }));
    });
    expect(totals[1]).toEqual(totals[0]);
    for (const row of totals[0]!) {
      expect(row).toMatchObject({ crownWidthEstimate: 33, toeKick: 36, lightRail: 58 });
      expect(row.crown).toBeGreaterThan(0);
    }
  });
  for (const [label, room, wall] of ROOMS) {
    it(`${label}: rotated W3030 still counts 30 crown, 30+24 light rail; rotated B36 still counts 36 toe kick`, () => {
      const upper = cabinet(room, wall, "W3030", "wall", 30, 12);
      const base = cabinet(room, wall, "B36", "base", 36, 24, 60);
      const [rotatedUpper, rotatedBase] = syncWallRunOffsets([
        { ...upper, rotation: 90 }, { ...base, rotation: 45 },
      ], room);
      // The commit-boundary sync restores ownership for seated rotated bodies.
      expect(rotatedUpper!.wallId).toBe(wall);
      expect(rotatedBase!.wallId).toBe(wall);
      expect(cabinetTakeoffWallId(rotatedUpper!, room)).toBe(wall);
      expect(crownLinearInches([rotatedUpper!], room)).toBe(33);
      const renderedCrown = crownTakeoffFromExposedSegments(threeDCrownPerimeterSegments([rotatedUpper!], room));
      expect(renderedCrown.totalLinearInches).toBeGreaterThan(0);
      expect(toeKickLinearInches([rotatedBase!])).toBe(36);
      expect(lightRailTakeoff([rotatedUpper!], room)).toMatchObject({
        exposedLinearInches: 54, installationAllowanceInches: 4, totalLinearInches: 58, assemblies: 1,
      });
    });
    it(`${label}: W3030 and B36 pulled 1 inch from the wall retain their material takeoff, not stale wall seating`, () => {
      const upper = cabinet(room, wall, "W3030", "wall", 30, 12);
      const base = cabinet(room, wall, "B36", "base", 36, 24, 60);
      const [movedUpper, movedBase] = syncWallRunOffsets([
        { ...upper, y: upper.y + 1 }, { ...base, y: base.y + 1 },
      ], room);
      expect(movedUpper!.wallId).toBeUndefined();
      expect(movedBase!.wallId).toBeUndefined();
      expect(cabinetTakeoffWallId(movedUpper!, room)).toBe(wall);
      expect(crownLinearInches([movedUpper!], room)).toBe(33);
      const renderedCrown = crownTakeoffFromExposedSegments(threeDCrownPerimeterSegments([movedUpper!], room));
      expect(renderedCrown.totalLinearInches).toBeGreaterThan(0);
      expect(toeKickLinearInches([movedBase!])).toBe(36);
      expect(lightRailTakeoff([movedUpper!], room)).toMatchObject({
        exposedLinearInches: 54, installationAllowanceInches: 4, totalLinearInches: 58, assemblies: 1,
      });
    });
    it(`${label}: seated adjacent W3030s share a side and each B36 counts catalog width`, () => {
      const uppers = [cabinet(room, wall, "W3030", "wall", 30, 12, 0), cabinet(room, wall, "W3030", "wall", 30, 12, 30)];
      const bases = [cabinet(room, wall, "B36", "base", 36, 24, 0), cabinet(room, wall, "B36", "base", 36, 24, 36)];
      expect(crownLinearInches(uppers, room)).toBe(63);
      expect(toeKickLinearInches(bases)).toBe(72);
      expect(lightRailTakeoff(uppers, room)).toMatchObject({ exposedLinearInches: 84, installationAllowanceInches: 4, totalLinearInches: 88, assemblies: 1 });
    });
  }
  it("catalog B36 at a 45° run counts 36 inches of toe kick, not the rotated bounding box", () => {
    const room = drawnRoom("right45");
    const wall = room.customWalls![1]!.id;
    const b36 = cabinet(room, wall, "B36", "base", 36, 24, 11);
    expect(toeKickLinearInches([b36])).toBe(36);
  });
  it("one room ceiling: a drawn wall can never be taller than it, so a 108-inch wall in a 96-inch room tops out at 96", () => {
    const room = drawnRoom();
    room.ceilingHeight = 96;
    const wall = room.customWalls![0]!;
    wall.height = 108;
    const upper = cabinet(room, wall.id, "W3030", "wall", 30, 12);
    expect(wallTopLimit(room, wall.id as never)).toBe(96);
    expect(wallCeiling(room, wall.id as never)).toEqual({ high: 96, low: 96 });
    expect(wallCabinetVerticalMoveLimit(upper, room).ceiling).toBe(96);
    expect(wallRunFrame(wall.id as never, room)!.height).toBe(96);
  });
  it("a full-height drawn wall uses the room ceiling exactly like a standard wall", () => {
    const room = drawnRoom();
    room.ceilingHeight = 108;
    const wall = room.customWalls![0]!;
    wall.height = 108;
    const upper = cabinet(room, wall.id, "W3030", "wall", 30, 12);
    expect(wallCeiling(room, wall.id as never)).toEqual({ high: 108, low: 108 });
    expect(wallCabinetVerticalMoveLimit(upper, room).ceiling).toBe(108);
    const standard: RoomData = { width: 144, depth: 120, ceilingHeight: 108 };
    const stdUpper = cabinet(standard, "top", "W3030", "wall", 30, 12);
    expect(wallCabinetVerticalMoveLimit(stdUpper, standard).ceiling).toBe(108);
  });
  it("a short drawn wall (half / pony wall) is not clamped to 84 and caps uppers at its own top", () => {
    const room = drawnRoom();
    room.ceilingHeight = 96;
    const wall = room.customWalls![0]!;
    wall.height = 42;
    expect(wallTopLimit(room, wall.id as never)).toBe(42);
    expect(wallCeiling(room, wall.id as never)).toEqual({ high: 42, low: 42 });
    const upper = cabinet(room, wall.id, "W3030", "wall", 30, 12);
    const limit = wallCabinetVerticalMoveLimit(upper, room);
    expect(limit.ceiling).toBe(42);
    // A 30-inch upper hung at the standard 54-inch line would stand above a 42-inch wall.
    expect(ceilingFitViolations([upper], room).has(upper.uid)).toBe(true);
    expect(limit.maxBottom).toBe(12);
  });
});

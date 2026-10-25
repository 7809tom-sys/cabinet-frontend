import { describe, expect, it } from "vitest";
import { appendWallBuilderSegment, wallBuilderRoomGeometry, type WallBuilderSegment } from "./polygonRoom";
import {
	  containCabinetOnDrawnWalls,
		 countertopSurfacePlanPolygon,
		 countertopSurfaces,
		 commitIndependentCabinetCandidate,
	 customWallCabinetSide,
  paletteActiveWallPlacement,
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
} from "./design";

function drawnRoom(turn: "left90" | "right90"): RoomData {
  let segments: WallBuilderSegment[] = [];
  segments = appendWallBuilderSegment(segments, 100, "start");
  segments = appendWallBuilderSegment(segments, 60, turn);
  const result = wallBuilderRoomGeometry(segments);
  if (!result.room) throw new Error(result.error ?? "Expected a measured room path");
  return { ...result.room, ceilingHeight: 96 };
}

function threeDrawerBase(spot: ReturnType<typeof wallPlacementAt>): PlacedCabinet {
  return {
    uid: "3db21",
    cabinetId: 21,
    masterCode: "3DB21",
    description: "21 inch Three Drawer Base",
    placement: "base",
    x: spot.x,
    y: spot.y,
    width: 21,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
  };
}

describe("Continuous Wall Builder placement parity", () => {
  it("uses the room's measured turn to keep a 3DB21 inside a counter-clockwise open path", () => {
    const room = drawnRoom("left90");
    const wall = room.customWalls![1]!;

    expect(customWallCabinetSide(room, wall.id)).toBe("right");
    const spot = wallPlacementAt(0, 21, 24, wall.id as never, room);

    // The measured second wall is x=100. Its inside face is west; the cabinet
    // body must end on x=100, never begin there and extend beyond the room.
    expect(spot).toMatchObject({ x: 76, y: 39, rotation: 90, wallId: wall.id, wallOffset: 0 });
  });

  it("uses that same inside face for a direct catalog add on the selected wall", () => {
    const room = drawnRoom("left90");
    const wall = room.customWalls![1]!;

    const spot = paletteActiveWallPlacement(
      wall.id as never,
      room,
      [],
      [],
      21,
      24,
      "base",
    );

    expect(spot).toMatchObject({ x: 76, y: 39, rotation: 90, wallId: wall.id, wallOffset: 0 });
  });

  it("repairs the screenshot's outside-right-wall 3DB21 using the same measured wall engine", () => {
    const room = drawnRoom("left90");
    const wall = room.customWalls![1]!;
    const outside: PlacedCabinet = {
      ...threeDrawerBase(wallPlacementAt(0, 21, 24, wall.id as never, room)),
      // Previous left-normal placement left the body to the east of x=100.
      x: 100,
      y: 39,
      rotation: 90,
      wallId: wall.id,
      wallOffset: 0,
    };

    const repaired = containCabinetOnDrawnWalls(outside, room);
    expect(repaired).toMatchObject({ x: 76, y: 39, rotation: 90, wallId: wall.id, wallOffset: 0 });
    expect(repaired.x + 24).toBe(100);
  });

  it("keeps the 1½-inch custom-wall countertop overhang inside the same measured face", () => {
    const room = drawnRoom("left90");
    const wall = room.customWalls![1]!;
    const cabinet = threeDrawerBase(wallPlacementAt(0, 21, 24, wall.id as never, room));
    const surface = countertopSurfaces([cabinet], room).find((candidate) => candidate.customWallId === wall.id);
    expect(surface).toBeDefined();

    const polygon = countertopSurfacePlanPolygon(surface!);
    expect(Math.max(...polygon.map((point) => point.x))).toBeCloseTo(100, 6);
    expect(Math.min(...polygon.map((point) => point.x))).toBeCloseTo(74.5, 6);
  });

  it("matches the standard Designer's right-wall inside placement for an equivalent clockwise path", () => {
    const room = drawnRoom("right90");
    const wall = room.customWalls![1]!;
    const continuousSpot = wallPlacementAt(0, 21, 24, wall.id as never, room);
    const standardSpot = wallPlacementAt(0, 21, 24, "right", { width: 100, depth: 60 });

    expect(customWallCabinetSide(room, wall.id)).toBe("left");
    expect(continuousSpot).toMatchObject({ x: standardSpot.x, y: standardSpot.y, rotation: standardSpot.rotation });
  });

  it("uses the shared run builder so a refrigerator bay ends both continuous-wall countertops at its panels", () => {
    const room = drawnRoom("right90");
    const wall = room.customWalls![0]!;
    const place = (uid: string, masterCode: string, placement: PlacedCabinet["placement"], start: number, width: number, depth: number): PlacedCabinet => {
      const spot = wallPlacementAt(start, width, depth, wall.id as never, room);
      return { uid, cabinetId: 1, masterCode, description: masterCode, placement, x: spot.x, y: spot.y, width, depth, height: placement === "base" ? 34.5 : 96, rotation: spot.rotation, wallId: wall.id, wallOffset: start };
    };
    const leftBase = place("left-base", "B24", "base", 0, 24, 24);
    const fridge = place("fridge", "FRIDGE-36", "appliance", 24, 36, 24);
	    const leftPanel = place("left-panel", "REPV2496", "tall", 23.25, 0.75, 24);
	    const rightPanel = place("right-panel", "REPV2496", "tall", 60.5, 0.75, 24);
    const rightBase = place("right-base", "B24", "base", 61.25, 24, 24);

    expect(countertopSurfaces([leftBase, fridge, leftPanel, rightPanel, rightBase], room)).toMatchObject([
      { customWallId: wall.id, customWallRunStartIn: 0, linearInches: 24 },
	      { customWallId: wall.id, customWallRunStartIn: 61.25, linearInches: 24 },
	    ]);
	  });

	  it("moves only the selected refrigerator on the measured wall", () => {
	    const room = drawnRoom("right90");
	    const wall = room.customWalls![0]!;
	    const place = (uid: string, masterCode: string, placement: PlacedCabinet["placement"], start: number, width: number, depth: number, role?: PlacedCabinet["refrigeratorAssemblyRole"]): PlacedCabinet => {
	      const spot = wallPlacementAt(start, width, depth, wall.id as never, room);
	      return {
	        uid, cabinetId: 1, masterCode, description: masterCode, placement,
	        x: spot.x, y: spot.y, width, depth, height: placement === "appliance" ? 70 : placement === "wall" ? 24 : 96,
	        rotation: spot.rotation, wallId: wall.id, wallOffset: start,
	        refrigeratorAssemblyId: role ? "fridge" : undefined,
	        refrigeratorAssemblyRole: role,
	        refrigeratorPanelMode: placement === "appliance" ? "both" : undefined,
	        mountBottom: role === "bridge" ? 72 : placement === "tall" ? 0 : undefined,
	        customProfile: role?.endsWith("panel") ? "refrigerator-end-panel" : undefined,
	      };
	    };
	    const fridge = place("fridge", "FRIDGE-36", "appliance", 24, 36, 30);
	    const cap = place("cap", "W301224", "wall", 27.5, 30, 24, "bridge");
	    const left = place("left", "REPV3096", "tall", 23.25, 0.75, 24, "left-panel");
	    const right = place("right", "REPV3096", "tall", 60.5, 0.75, 24, "right-panel");
	    const movedSpot = wallPlacementAt(48, 36, 30, wall.id as never, room);

	    const moved = commitIndependentCabinetCandidate(
	      [fridge, cap, left, right],
	      { ...fridge, ...movedSpot, wallOffset: 48 },
	    );

	    expect(moved.find((item) => item.uid === "fridge")?.wallOffset).toBeCloseTo(48);
	    expect(moved.find((item) => item.uid === "cap")).toBe(cap);
	    expect(moved.find((item) => item.uid === "left")).toBe(left);
	    expect(moved.find((item) => item.uid === "right")).toBe(right);
	  });
});

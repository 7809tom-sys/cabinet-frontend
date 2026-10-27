import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER } from "@shared/aefFramelessGeometry";
import {
  WALL_OPENING_CLEARANCE_IN,
  freeSegmentsOnWall,
  paletteActiveWallPlacement,
  wallOpeningClearanceViolations,
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
const window: WallOpening = { uid: "window", kind: "window", side: "top", offset: 39.5, width: 30, sill: 42, height: 36 };

function preview(marker: string | null): PlacedCabinet {
  const spot = wallPlacementAt(0, 36, 13.5, "top", room);
  return {
    uid: "preview",
    cabinetId: 1,
    masterCode: "W3630",
    description: "Wall",
    placement: "wall",
    ...spot,
    width: 36,
    depth: 13.5,
    height: 30.25,
    rotation: spot.rotation,
    constructionMethod: marker,
  };
}

describe("frameless window clearance", () => {
  it("adds the 3/4-inch panel to the existing 3-inch casing for an AEF wall cabinet only", () => {
    const aef = freeSegmentsOnWall("top", room, [], [window], 9, WALL_OPENING_CLEARANCE_IN, "wall", false, preview(AEF_PRINTED_GEOMETRY_MARKER));
    const framed = freeSegmentsOnWall("top", room, [], [window], 9, WALL_OPENING_CLEARANCE_IN, "wall", false, preview("framed"));
    const untouched = freeSegmentsOnWall("top", room, [], [window], 9, WALL_OPENING_CLEARANCE_IN, "wall");
    expect(aef[0]?.length).toBeCloseTo(39.5 - 3.75, 2);
    expect(framed[0]?.length).toBeCloseTo(39.5 - 3, 2);
    expect(untouched[0]?.length).toBeCloseTo(39.5 - 3, 2);
    const aefSpot = paletteActiveWallPlacement("top", room, [], [window], 36, 13.5, "wall", false, preview(AEF_PRINTED_GEOMETRY_MARKER));
    const framedSpot = paletteActiveWallPlacement("top", room, [], [window], 36, 13.5, "wall");
    expect(aefSpot?.wallOffset ?? 0).toBeGreaterThan(39.5);
    expect(framedSpot?.wallOffset).toBe(0);
    expect(paletteActiveWallPlacement("top", room, [], [window], 33, 13.5, "wall", false, preview(AEF_PRINTED_GEOMETRY_MARKER))?.wallOffset).toBe(0);
  });

  it("flags an AEF wall cabinet inside the panel clearance and leaves a framed cabinet at 3 inches", () => {
    const opening: WallOpening = { ...window, offset: 36.25 };
    const body = (marker: string | null): PlacedCabinet => {
      const spot = wallPlacementAt(0, 33, 13.5, "top", room);
      return { ...preview(marker), ...spot, width: 33, constructionMethod: marker };
    };
    expect(wallOpeningClearanceViolations([body(AEF_PRINTED_GEOMETRY_MARKER)], [opening], room).has("preview")).toBe(true);
    expect(wallOpeningClearanceViolations([body("framed")], [opening], room).has("preview")).toBe(false);
  });
});
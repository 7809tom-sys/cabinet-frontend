import { describe, expect, it } from "vitest";
import { appendCollisionFreePlacements, DEFAULT_ROOM, elevationBox, type DesignCabinet, type PlacedCabinet } from "@/lib/design";
import { isWscSpiceCabinet, wsc30UpperChoices, wsc30UpperPlacement } from "./spiceStack";

const spice: PlacedCabinet = {
  uid: "wsc-1",
  cabinetId: 1,
  masterCode: "WSC30",
  description: '30" x 6" Spice Cabinet',
  category: "Wall",
  subCategory: "Spice Cabinet",
  placement: "wall",
  x: 24,
  y: 0,
  width: 30,
  depth: 12,
  height: 6,
  rotation: 0,
  mountBottom: 54,
};

function wall(masterCode: string, width: string, height: string, description = 'Wall Cabinet'): DesignCabinet {
  return {
    id: Number(height),
    masterCode,
    description,
    category: "Wall",
    subCategory: "Wall Cabinet",
    width,
    height,
    depth: "12",
    placement: "wall",
    numberOfDoors: 2,
    numberOfDrawers: 0,
    isCornerCabinet: false,
  };
}

describe("WSC30 spice stack", () => {
  it("recognizes only the actual 30-inch, six-inch WSC spice cabinet", () => {
    expect(isWscSpiceCabinet(spice)).toBe(true);
    expect(isWscSpiceCabinet({ ...spice, masterCode: "WSC36" })).toBe(false);
    expect(isWscSpiceCabinet({ ...spice, height: 12 })).toBe(false);
  });

  it("offers only selected-line 30 x 30 or 30 x 36 ordinary wall cabinets", () => {
    const choices = wsc30UpperChoices(spice, [
      wall("W3036", "30", "36"),
      wall("W3030", "30", "30"),
      wall("W3012", "30", "12"),
      wall("WSC30", "30", "6", '30" x 6" Spice Cabinet'),
      wall("WSC36", "30", "36", '30" x 36" Stacker'),
      wall("W3630", "36", "30"),
    ]);

    expect(choices.map((cabinet) => cabinet.masterCode)).toEqual(["W3030", "W3036"]);
  });

  it("centers the selected upper directly on WSC30 and produces 36- or 42-inch visual stacks", () => {
    const upper30 = wall("W3030", "30", "30");
    const upper36 = wall("W3036", "30", "36");
    const spot30 = wsc30UpperPlacement(spice, upper30, DEFAULT_ROOM);
    const spot36 = wsc30UpperPlacement(spice, upper36, DEFAULT_ROOM);

    expect(spot30.x).toBe(spice.x);
    expect(spot36.x).toBe(spice.x);
    expect(spot30.mountBottom).toBe(elevationBox(spice, DEFAULT_ROOM).bottom + 6);
    expect(spot36.mountBottom).toBe(60);
    expect(spot30.mountBottom + 30 - 54).toBe(36);
    expect(spot36.mountBottom + 36 - 54).toBe(42);
  });

  it("accepts the directly stacked upper as a separate vertical cabinet rather than a collision", () => {
    const source = wall("W3030", "30", "30");
    const spot = wsc30UpperPlacement(spice, source, DEFAULT_ROOM);
    const upper: PlacedCabinet = {
      ...spice,
      uid: "upper-1",
      cabinetId: source.id,
      masterCode: source.masterCode,
      description: source.description,
      width: 30,
      depth: 12,
      height: 30,
      ...spot,
      mountBottom: spot.mountBottom,
      mountBottomAdjusted: true,
      spiceStackParentUid: spice.uid,
    };

    const result = appendCollisionFreePlacements([spice], [upper], DEFAULT_ROOM);
    expect(result.rejected).toEqual([]);
    expect(result.placed.map((cabinet) => cabinet.uid)).toEqual(["wsc-1", "upper-1"]);
  });
});

import { describe, expect, it } from "vitest";
import { anchorWiggleLimitIn } from "./designerLayoutRules";
import { removeIllegalFillers } from "./fillerPlacementRule";
import { holdRefrigeratorPanelsOnWall } from "./autoDesignRefrigeratorBay";
import { fillGapsUnderOneAndAHalf } from "./subOneAndHalfFiller";
import { wallPlacementAt, type PlacedCabinet, type RoomData } from "./design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
const fillerStock = [{
  id: 3, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler",
  width: "3", height: "34.5", depth: "24", catalogImageUrl: null,
}];

function box(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode" | "width">, along: number, depth = 24): PlacedCabinet {
  const spot = wallPlacementAt(along, partial.width, depth, "top", room);
  return {
    cabinetId: 1, description: partial.masterCode, category: "Base", subCategory: "Base",
    placement: "base", height: 34.5, numberOfDoors: 1, numberOfDrawers: 0,
    ...partial, ...spot, depth, rotation: spot.rotation, wallId: spot.wallId, wallOffset: spot.wallOffset,
  } as PlacedCabinet;
}

describe("gaps under 1.5 inches", () => {
  it("gives the refrigerator the same 3 inch wiggle cap as the other appliances", () => {
    expect(anchorWiggleLimitIn("refrigerator")).toBe(3);
    expect(anchorWiggleLimitIn("sink")).toBe(3);
  });

  it("fills a gap under 1.5 inches between two cabinets and leaves a wider gap alone", () => {
    const placed = [
      box({ uid: "a", masterCode: "B24", width: 24 }, 0),
      box({ uid: "b", masterCode: "B24b", width: 24 }, 25),
      box({ uid: "c", masterCode: "B30", width: 30 }, 51),
    ];
    const result = fillGapsUnderOneAndAHalf({ placed, room, fillers: fillerStock, makeUid: () => "fill-1", styleId: 1 });
    const filler = result.placed.find((item) => item.uid === "fill-1");
    expect(filler?.width).toBeCloseTo(1, 2);
    expect(filler?.width).toBeLessThanOrEqual(3);
    expect(result.placed.find((item) => item.uid === "b")?.x).toBe(placed[1]!.x);
    expect(result.placed.some((item) => item.width === 2)).toBe(false);
  });

  it("fills a gap under 1.5 inches between a cabinet and a refrigerator panel without moving the refrigerator", () => {
    const cabinet = box({ uid: "cab", masterCode: "B24", width: 24 }, 0);
    const fridge = box({
      uid: "fridge", masterCode: "FRIDGE-36", width: 36, placement: "appliance", category: "Appliance",
    }, 25.75);
    const panel = box({
      uid: "panel", masterCode: "REP2496", width: 0.75, placement: "tall",
      refrigeratorAssemblyRole: "left-panel", refrigeratorAssemblyId: "fridge",
      customProfile: "refrigerator-end-panel",
    }, 25);
    const fridgeX = fridge.x;
    const result = fillGapsUnderOneAndAHalf({
      placed: [cabinet, panel, fridge], room, fillers: fillerStock, makeUid: () => "fill-panel", styleId: 1,
    });
    const filler = result.placed.find((item) => item.uid === "fill-panel");
    expect(filler?.width).toBeCloseTo(1, 2);
    expect(result.placed.find((item) => item.uid === "fridge")?.x).toBe(fridgeX);
    const kept = removeIllegalFillers({ placed: result.placed, room });
    expect(kept.placed.some((item) => item.uid === "fill-panel")).toBe(true);
  });

  it("holds a panel on the wall instead of sliding the refrigerator for a small overhang", () => {
    const spot = wallPlacementAt(143.5, 0.75, 24, "top", room);
    const panel = {
      uid: "panel", cabinetId: 1, masterCode: "REP2496", description: "panel", placement: "tall" as const,
      ...spot, width: 0.75, depth: 24, height: 96, rotation: spot.rotation,
      wallId: "top", wallOffset: 143.5, refrigeratorAssemblyRole: "right-panel" as const,
    } as PlacedCabinet;
    const held = holdRefrigeratorPanelsOnWall([panel], room);
    expect(held.additions[0]?.wallOffset).toBeCloseTo(143.25, 2);
    expect(held.note).toMatch(/not slid/i);
  });
});

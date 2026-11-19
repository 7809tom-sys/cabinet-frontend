import { describe, expect, it } from "vitest";
import real from "./__fixtures__/autoDesignRealCatalog.json";
import { catalogFillerForGap, isFlutedFiller } from "./catalogFiller";
import { trimRefrigeratorWallSide } from "./autoDesignRefrigeratorWallSide";
import { wallPlacementAt, wallRunOffset, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";

const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
const accessory = (real as unknown as Record<string, { accessory: DesignCabinet[] }>)["330011"]!.accessory;

function item(uid: string, masterCode: string, along: number, width: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return {
    uid, cabinetId: 1, masterCode, description: masterCode, category: "Base", subCategory: "", placement: "base",
    ...wallPlacementAt(along, width, 24, "top", ROOM), width, depth: 24, height: 34.5, styleId: 1, ...extra,
  } as PlacedCabinet;
}

describe("fluted fillers are never auto-picked (Tom, voice, Nov 19 2026, 7:41 AM CT)", () => {
  it("isFlutedFiller spots WFF codes and 'fluted' descriptions", () => {
    expect(isFlutedFiller({ masterCode: "WFF342" })).toBe(true);
    expect(isFlutedFiller({ masterCode: "X1", description: "3 in Fluted Filler" })).toBe(true);
    expect(isFlutedFiller({ masterCode: "F342" })).toBe(false);
    expect(isFlutedFiller({ masterCode: "BFF3", description: "3\" x 34.5\" Fluted Base Filler" })).toBe(false);
  });
  it("catalogFillerForGap never returns a WFF, even when it is the only 3 in wall filler", () => {
    for (const gap of [0.75, 1.5, 2.25, 3, 6]) {
      const pick = catalogFillerForGap(accessory as never, gap, "wall");
      expect(pick == null || !/^WFF/.test(pick.masterCode)).toBe(true);
    }
    const onlyFluted = accessory.filter((row) => /^WFF/.test(row.masterCode));
    expect(catalogFillerForGap(onlyFluted as never, 2.25, "wall")).toBeNull();
  });
});

describe("refrigerator wall side: no panel, no filler (Tom, voice, Nov 19 2026, 7:41 AM CT)", () => {
  const appliance = { placement: "appliance", category: "Appliance", description: "36 in Refrigerator" } as Partial<PlacedCabinet>;
  it("removes the wall-side panel and filler, sets the fridge on the wall, keeps the open-side panel against it", () => {
    const placed = [
      item("p1", "REPV2496", 0, 0.75, { refrigeratorAssemblyId: "fr", refrigeratorAssemblyRole: "left-panel", category: "Panels" } as never),
      item("f1", "F342", 0.75, 0.5, { category: "Accessory", description: "Filler" }),
      item("fr", "FRIDGE-36", 1.25, 36, appliance),
      item("p2", "REPV2496", 37.25, 0.75, { refrigeratorAssemblyId: "fr", refrigeratorAssemblyRole: "right-panel", category: "Panels" } as never),
      item("b", "B21", 38, 21),
    ];
    const out = trimRefrigeratorWallSide({ placed, room: ROOM });
    expect(out.removedUids.sort()).toEqual(["f1", "p1"]);
    const fr = out.placed.find((p) => p.uid === "fr")!;
    const p2 = out.placed.find((p) => p.uid === "p2")!;
    expect(wallRunOffset(fr, "top", ROOM)).toBeCloseTo(0, 3);
    expect(wallRunOffset(p2, "top", ROOM)).toBeCloseTo(36, 3);
    expect(out.notes[0]).toMatch(/wall side needs no end panel and no filler/);
  });
  it("budget fridge with no panels and flush to the wall is left alone", () => {
    const placed = [item("fr", "FRIDGE-36", 0, 36, appliance), item("b", "B21", 36, 21)];
    const out = trimRefrigeratorWallSide({ placed, room: ROOM });
    expect(out.removedUids).toEqual([]);
    expect(out.placed).toEqual(placed);
  });
});

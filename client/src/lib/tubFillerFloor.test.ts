import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG, furnitureFootprint, makePelicanBathroomFixture } from "./design";
import {
  bathroomTubFillerPlacement,
  tubFillerSpoutTip,
} from "./bathroomPlanning";
import {
  isTubFillerFurniture,
  isTubFurniture,
  placeTubFiller,
  tubBowlInnerRect,
  tubFillerPlacementFits,
  tubFillerSpoutReachIn,
} from "./tubFillerFloor";
import { verifiedPelicanBathroomFixtureProfile } from "./pelicanBathroomFixtureProfiles";
import { floorRectsOverlap, occupiedFloor } from "./floorOccupancy";

const room = { width: 120, depth: 96 };
const filler = () => makePelicanBathroomFixture({ id: 804, pelicanCode: "PL-8515 MB", name: "PL-8515 MB", category: "Sinks & Faucets", sellPrice: 442.53 }, 0, 0)!;
const tub = (x = 10, y = 55, rotation: 0 | 90 | 180 | 270 = 90) =>
  ({ ...makePelicanBathroomFixture({ id: 1, pelicanCode: 'PL-02146 59"', name: "Tub", category: "Shower & Bath", sellPrice: 999 }, x, y)!, rotation });

const foot = (item: ReturnType<typeof tub>) => furnitureFootprint(item, FURNITURE_CATALOG.find((d) => d.id === item.defId)!);

describe("Freestanding tub faucet floor-space rule", () => {
  it("identifies fillers and tubs from their source profiles", () => {
    expect(isTubFillerFurniture(filler())).toBe(true);
    expect(isTubFurniture(tub())).toBe(true);
    expect(isTubFurniture(filler())).toBe(false);
    expect(isTubFillerFurniture(tub())).toBe(false);
  });

  it("uses the published spout reach, with a conservative fallback", () => {
    expect(tubFillerSpoutReachIn(verifiedPelicanBathroomFixtureProfile("PL-8515 MB"))).toBe(7);
    expect(tubFillerSpoutReachIn(verifiedPelicanBathroomFixtureProfile("PL-8522 CHR"))).toBe(6.5);
    expect(tubFillerSpoutReachIn(verifiedPelicanBathroomFixtureProfile("PL-8538 BG"))).toBe(8.875);
    expect(tubFillerSpoutReachIn(null)).toBe(7);
  });

  it("shares the tub's floor space and lands the spout inside the bowl", () => {
    const bath = tub();
    const placed = bathroomTubFillerPlacement(filler(), [bath], room)!;
    const tubFoot = foot(bath);
    const fillerFoot = foot(placed);
    // Rule 1: the filler footprint overlaps the tub.
    expect(floorRectsOverlap(
      { uid: "f", x: placed.x, y: placed.y, w: fillerFoot.w, d: fillerFoot.d, label: "" },
      { x: bath.x, y: bath.y, w: tubFoot.w, d: tubFoot.d },
    )).toBe(true);
    // Rule 3: the spout outlet lands inside the bowl.
    const reach = verifiedPelicanBathroomFixtureProfile(placed.pelicanCode)!.tubFillerSpoutReachIn!;
    const tip = tubFillerSpoutTip({ x: placed.x, y: placed.y, w: fillerFoot.w, d: fillerFoot.d, rotation: placed.rotation }, reach);
    const bowl = tubBowlInnerRect({ uid: "tub", x: bath.x, y: bath.y, w: tubFoot.w, d: tubFoot.d, label: "tub" });
    expect(tip.x).toBeGreaterThanOrEqual(bowl.x);
    expect(tip.x).toBeLessThanOrEqual(bowl.x + bowl.w);
    expect(tip.y).toBeGreaterThanOrEqual(bowl.y);
    expect(tip.y).toBeLessThanOrEqual(bowl.y + bowl.d);
  });

  it("still refuses to share floor with a cabinet", () => {
    const bath = tub();
    const occupied = occupiedFloor([bath], [], "filler");
    const w = foot(filler()).w, d = foot(filler()).d;
    // A position on top of a cabinet footprint is rejected even though it
    // overlaps the tub as the rule allows.
    const cabinet = { uid: "cab", x: bath.x + 4, y: bath.y + 4, w: 20, d: 20, label: "B24" };
    const body = { x: cabinet.x, y: cabinet.y, w, d, rotation: 0 as const };
    expect(tubFillerPlacementFits({
      body,
      reachIn: 7,
      tub: { uid: "tub", x: bath.x, y: bath.y, w: foot(bath).w, d: foot(bath).d, label: "tub" },
      others: [...occupied, cabinet],
      room,
    })).toBe(false);
  });

  it("keeps the column out of the tub shell", () => {
    const bath = tub();
    const tubRect = { uid: "tub", x: bath.x, y: bath.y, w: foot(bath).w, d: foot(bath).d, label: "tub" };
    const w = foot(filler()).w, d = foot(filler()).d;
    // Stand the filler squarely in the middle of the tub: the column would be
    // inside the shell, so the rule refuses it.
    const body = { x: bath.x + (tubRect.w - w) / 2, y: bath.y + (tubRect.d - d) / 2, w, d, rotation: 0 as const };
    expect(tubFillerPlacementFits({ body, reachIn: 7, tub: tubRect, others: [], room })).toBe(false);
  });

  it("places every filler model against every tub model with the spout in the bowl", () => {
    for (const tubCode of ['PL-02146 59"', 'PL-02138 59"', 'PL-02563 67"', "PL-02849LNSO"]) {
      for (const fillerCode of ["PL-8515 MB", "PL-8522 CHR", "PL-8538 BG"]) {
        const bath = { ...makePelicanBathroomFixture({ id: 1, pelicanCode: tubCode, name: "Tub", category: "Shower & Bath", sellPrice: 1 }, 10, 55)!, rotation: 90 as const };
        const item = makePelicanBathroomFixture({ id: 9, pelicanCode: fillerCode, name: fillerCode, category: "Sinks & Faucets", sellPrice: 1 }, 0, 0)!;
        const placed = placeTubFiller(item, [bath], room, occupiedFloor([bath], [], item.uid));
        expect(placed, `${tubCode} + ${fillerCode}`).not.toBeNull();
        const tubFoot = foot(bath);
        const fillerFoot = foot(placed!);
        const reach = verifiedPelicanBathroomFixtureProfile(fillerCode)!.tubFillerSpoutReachIn!;
        const tip = tubFillerSpoutTip({ x: placed!.x, y: placed!.y, w: fillerFoot.w, d: fillerFoot.d, rotation: placed!.rotation }, reach);
        const bowl = tubBowlInnerRect({ uid: "tub", x: bath.x, y: bath.y, w: tubFoot.w, d: tubFoot.d, label: "tub" });
        expect(tip.x >= bowl.x && tip.x <= bowl.x + bowl.w, `${tubCode} + ${fillerCode} x`).toBe(true);
        expect(tip.y >= bowl.y && tip.y <= bowl.y + bowl.d, `${tubCode} + ${fillerCode} y`).toBe(true);
      }
    }
  });

  it("does not invent a placement when there is no tub", () => {
    // Nothing to reach, so only a clear floor spot is used.
    expect(bathroomTubFillerPlacement(filler(), [], room)).not.toBeNull();
    expect(bathroomTubFillerPlacement(filler(), [], { width: 10, depth: 10 })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FURNITURE_CATALOG, furnitureFootprint, makePelicanBathroomFixture } from "./design";
import { bathroomTubFillerPlacement, bathroomPlanningGuidance, rotateBathroomFurniture, tubFillerSpoutTip } from "./bathroomPlanning";
import { verifiedPelicanBathroomFixtureProfile, pelicanBathroomFixturePlacementText } from "./pelicanBathroomFixtureProfiles";

const room = { width: 120, depth: 96 };
const filler = () => makePelicanBathroomFixture({ id: 804, pelicanCode: "PL-8515 MB", name: "PL-8515 MB", category: "Sinks & Faucets", sellPrice: 442.53 }, 0, 0)!;
const tub = () => ({ ...makePelicanBathroomFixture({ id: 1, pelicanCode: 'PL-02146 59"', name: "Tub", category: "Shower & Bath", sellPrice: 999 }, 10, 55)!, rotation: 90 });

describe("Pelican floor-mounted tub fillers", () => {
  it("uses exact finish SKUs and source heights/reaches without calling the occupancy a measured product envelope", () => {
    for (const [model, suffix, finish, height, spout, reach] of [
      ["8515", "BN", "brushed-nickel", 43.875, 40.25, 7], ["8515", "CHR", "chrome", 43.875, 40.25, 7], ["8515", "MB", "matte-black", 43.875, 40.25, 7],
      ["8522", "BG", "brushed-gold", 44.5, 32.875, 6.5], ["8522", "CHR", "chrome", 44.5, 32.875, 6.5], ["8522", "MB", "matte-black", 44.5, 32.875, 6.5],
      ["8538", "BG", "brushed-gold", 41.875, 35, 8.875], ["8538", "BN", "brushed-nickel", 41.875, 35, 8.875], ["8538", "MB", "matte-black", 41.875, 35, 8.875],
    ] as const) {
      const profile = verifiedPelicanBathroomFixtureProfile(`PL-${model} ${suffix}`)!;
      expect(profile).toMatchObject({ mounting: "floor", kind: "floor-tub-filler", finish, heightIn: height, tubFillerSpoutHeightIn: spout, tubFillerSpoutReachIn: reach, planningOnly: true, footprintBasis: "illustrative-occupancy" });
      expect(profile.specificationUrl).toContain(`PL-${model}LD.png`);
      expect(pelicanBathroomFixturePlacementText(profile.pelicanCode)).toContain("unverified");
    }
    expect(verifiedPelicanBathroomFixtureProfile("PL-8515 BG")).toBeNull();
    expect(verifiedPelicanBathroomFixtureProfile("PL-8369 MB")).toBeNull(); // kitchen pot filler is never a tub filler
    expect(bathroomPlanningGuidance(verifiedPelicanBathroomFixtureProfile("PL-8515 MB"))?.text).toContain("rough-in");
  });
  it("keeps the selected product price/identity and geometry source after draft JSON reload and rotation", () => {
    const item = filler();
    const restored = JSON.parse(JSON.stringify(item));
    expect(restored).toMatchObject({ pelicanProductId: 804, pelicanCode: "PL-8515 MB", pelicanSellPrice: 442.53, pelicanGeometrySource: { version: 1, mounting: "floor", footprintBasis: "illustrative-occupancy" } });
    const turned = rotateBathroomFurniture(restored, room);
    expect(turned).toMatchObject({ rotation: 90, pelicanProductId: 804, pelicanSellPrice: 442.53 });
    expect(FURNITURE_CATALOG.find((p) => p.id === item.defId)?.color).toBe("#1b1b1b");
  });
  it("places the filler so its spout reaches over the tub, sharing the tub's floor space", () => {
    const item = filler(), bath = tub();
    const placed = bathroomTubFillerPlacement(item, [bath], room)!;
    expect(placed).not.toBeNull();
    const tubDef = FURNITURE_CATALOG.find((p) => p.id === bath.defId)!;
    const tubFoot = furnitureFootprint(bath, tubDef);
    const fillerDef = FURNITURE_CATALOG.find((p) => p.id === placed.defId)!;
    const fillerFoot = furnitureFootprint(placed, fillerDef);
    // The whole point: the filler shares floor space with the tub, because its
    // spout must reach over the rim to fill the basin.
    const sharesTub = placed.x < bath.x + tubFoot.w && placed.x + fillerFoot.w > bath.x
      && placed.y < bath.y + tubFoot.d && placed.y + fillerFoot.d > bath.y;
    expect(sharesTub).toBe(true);
    // And the spout outlet lands inside the tub opening, not beside it.
    const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode)!;
    const tip = tubFillerSpoutTip(
      { x: placed.x, y: placed.y, w: fillerFoot.w, d: fillerFoot.d, rotation: placed.rotation },
      profile.tubFillerSpoutReachIn ?? 7,
    );
    expect(tip.x).toBeGreaterThanOrEqual(bath.x);
    expect(tip.x).toBeLessThanOrEqual(bath.x + tubFoot.w);
    expect(tip.y).toBeGreaterThanOrEqual(bath.y);
    expect(tip.y).toBeLessThanOrEqual(bath.y + tubFoot.d);
  });
  it("rejects a room too small to hold the filler, and supports another free side", () => {
    const bath = { ...tub(), y: 0 };
    const placement = bathroomTubFillerPlacement(filler(), [bath], room)!;
    expect(placement).not.toBeNull();
    expect(bathroomTubFillerPlacement(filler(), [], { width: 10, depth: 10 })).toBeNull();
  });
  it("connects real catalog cards to placement while keeping existing vanity faucets on their normal path", () => {
    const compact = readFileSync(new URL("../components/design/RecommendedSurfaces.tsx", import.meta.url), "utf8");
    const full = readFileSync(new URL("../components/design/SurfacesPickerDialog.tsx", import.meta.url), "utf8");
    const designer = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(compact).toContain('role === "bathroom-faucet" && verifiedPelicanBathroomFixtureProfile(item.pelicanCode)?.kind === "floor-tub-filler"');
    expect(full).toContain("Place floor-mounted tub filler");
    expect(designer.indexOf("No position is available where this filler's spout reaches the tub")).toBeLessThan(designer.indexOf('setSelectedSurfaces((previous) => previous.some'));
  });
});

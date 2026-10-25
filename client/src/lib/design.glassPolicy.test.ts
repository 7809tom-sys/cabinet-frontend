import { describe, expect, it } from "vitest";
import { glassCabinetPlacementAllowed, isGlassDoorCabinet, isGlassPolicyNomenclature, type PlacedCabinet } from "./design";
import { buildDesignCabinetCartLines, buildDesignPreviewPricingLines } from "./designCartLines";

const glassCabinet = {
  uid: "glass-wall-1",
  cabinetId: 921,
  masterCode: "W2430GD",
  description: '24" Glass Door Wall Cabinet',
  category: "Wall",
  placement: "wall",
  x: 12,
  y: 0,
  width: 24,
  depth: 12,
  height: 30,
  rotation: 0,
} as PlacedCabinet;

const pricing = {
  styleId: 7,
  distributorId: 13,
  tier: "homeowner" as const,
  styleNameById: new Map([[7, "Skylight White"]]),
  unitPriceFor: () => 400,
};

describe("distributor glass policy", () => {
  it("classifies PG, GD, and terminal-G nomenclature without classifying ordinary cabinets", () => {
    expect(isGlassPolicyNomenclature("W2430GD")).toBe(true);
    expect(isGlassPolicyNomenclature("PG-2430")).toBe(false);
    expect(isGlassPolicyNomenclature("W2430PG")).toBe(true);
    expect(isGlassPolicyNomenclature("W2430-G")).toBe(true);
    expect(isGlassPolicyNomenclature("W2430")).toBe(false);
    expect(isGlassPolicyNomenclature("B36")).toBe(false);
  });

  it("discloses separately purchased glass in cart and price-preview rows", () => {
    const separatelyPurchased = { ...glassCabinet, glassIncluded: false };
    const cart = buildDesignCabinetCartLines({ placed: [separatelyPurchased], ...pricing });
    const preview = buildDesignPreviewPricingLines({ placed: [separatelyPurchased], ...pricing });
    expect(cart[0]).toMatchObject({ name: '24" Glass Door Wall Cabinet — glass purchased separately' });
    expect(preview[0]).toMatchObject({ name: '24" Glass Door Wall Cabinet — glass purchased separately' });
  });

  it("does not add a separate-glass warning when the distributor includes the glass", () => {
    const included = { ...glassCabinet, glassIncluded: true };
    const [cartLine] = buildDesignCabinetCartLines({ placed: [included], ...pricing });
    expect(cartLine.name).toBe('24" Glass Door Wall Cabinet');
  });
  it("allows glass only in the wall layer and rejects floor placements", () => {
    const glass = { masterCode: "CG-B24", description: "Crystal Glass cabinet", glassDoor: true };
    expect(isGlassDoorCabinet(glass)).toBe(true);
    expect(glassCabinetPlacementAllowed({ ...glass, placement: "wall" })).toBe(true);
    for (const placement of ["base", "tall", "appliance"] as const) {
      expect(glassCabinetPlacementAllowed({ ...glass, placement })).toBe(false);
    }
  });
});

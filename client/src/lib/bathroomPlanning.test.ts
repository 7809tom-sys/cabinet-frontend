import { describe, expect, it } from "vitest";
import { BATHROOM_STARTER_TEMPLATE, bathroomFixtureChecklist, bathroomFixtureFreePlacement, bathroomPlanningGuidance, makeBathroomStarterTemplate } from "./bathroomPlanning";
import { FURNITURE_CATALOG, furnitureFootprint, makeFurniture } from "./design";
import { verifiedPelicanBathroomFixtureProfile } from "./pelicanBathroomFixtureProfiles";

describe("Bathroom starter and clearance guidance", () => {
  it("starts a blank 10 ft x 8 ft room with no planning zones", () => {
    const starter = makeBathroomStarterTemplate();
    expect(starter.room).toMatchObject({ width: 120, depth: 96, ceilingHeight: 96 });
    expect(starter.furniture).toEqual([]);
    expect(BATHROOM_STARTER_TEMPLATE.id).toBe("bathroom-blank-10x8-v1");
    expect(FURNITURE_CATALOG.every((item) => (item.category as string) !== "bathroom-zone")).toBe(true);
  });

  it("places every bathroom fixture freely, centered or in the first open spot, instead of snapping to a zone", () => {
    const tubs = FURNITURE_CATALOG.filter((item) => {
      const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode);
      return profile?.kind === "freestanding-tub" || profile?.kind === "alcove-tub";
    });
    expect(tubs.length).toBeGreaterThan(0);

    for (const tub of tubs) {
      const placement = bathroomFixtureFreePlacement(
        { ...makeFurniture(tub.id, 0, 0), pelicanCode: tub.pelicanCode },
        [],
        { width: 120, depth: 96 },
      );
      // A 67-inch tub in a 120 x 96 room still has an open position: free placement never rejects it.
      expect(placement, tub.id).not.toBeNull();
      expect(placement!.rotation).toBe(0);
      expect(placement!.x).toBeGreaterThanOrEqual(0);
      expect(placement!.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps a second fixture out of the first one's footprint without any zone", () => {
    const first = { ...makeFurniture("pelican-tub-pl-02146-59", 0, 0), x: 30, y: 36 };
    const placement = bathroomFixtureFreePlacement(
      { ...makeFurniture("pelican-toilet-pl-12044", 0, 0), pelicanCode: "PL-12044" },
      [first],
      { width: 120, depth: 96 },
    );
    expect(placement).not.toBeNull();
    const definition = FURNITURE_CATALOG.find((item) => item.id === first.defId)!;
    const tub = furnitureFootprint(first, definition);
    const toilet = FURNITURE_CATALOG.find((item) => item.id === "pelican-toilet-pl-12044")!;
    const overlaps = placement!.x < first.x + tub.w && placement!.x + toilet.w > first.x
      && placement!.y < first.y + tub.d && placement!.y + toilet.d > first.y;
    expect(overlaps).toBe(false);
  });

  it("makes clearance notes advisory and source-linked rather than collision rules", () => {
    const toilet = bathroomPlanningGuidance(verifiedPelicanBathroomFixtureProfile("PL-12044"));
    const shower = bathroomPlanningGuidance(verifiedPelicanBathroomFixtureProfile("PL-03A42S"));
    expect(toilet).toMatchObject({ title: "Toilet / bidet planning check" });
    expect(toilet?.text).toContain("Advisory");
    expect(shower).toMatchObject({ title: "Shower enclosure planning check" });
    expect(shower?.text).toContain("Nominal visual envelope only");
    expect(shower?.sourceUrl).toContain("PL-03A42S.pdf");
  });

  it("reports source-verified fixture selections without turning the checklist into a clearance rule", () => {
    const furniture = [
      { ...makeFurniture("pelican-toilet-pl-12044", 84, 12), uid: "selected-toilet" },
      { ...makeFurniture("pelican-tub-pl-02849-left", 0, 64), uid: "selected-tub" },
    ];
    const checklist = bathroomFixtureChecklist({
      cabinets: [{ masterCode: "VS30", description: "30 in Vanity Sink Base", subCategory: "Vanity" }],
      sinks: [{ pelicanProfileId: "pelican-pl-3099-pearl-porcelain-undermount-vanity", pelicanFaucetProfileId: "pelican-pl-8112-cascade-vanity-brushed-nickel" }],
      selectedSurfaceCodes: ["PL-8112 BN"],
      furniture,
    });

    expect(checklist.filter((step) => !step.optional).every((step) => step.complete)).toBe(true);
    expect(checklist.find((step) => step.id === "shower")).toMatchObject({ optional: true, complete: false });
    expect(checklist.find((step) => step.id === "toilet")?.detail).not.toMatch(/zone/i);
    expect(checklist.every((step) => !/zone/i.test(step.detail))).toBe(true);
  });
});

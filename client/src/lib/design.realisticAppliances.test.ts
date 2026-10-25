import { describe, expect, it } from "vitest";
import { APPLIANCES, applianceAppearanceImage, applianceAsDesignCabinet, applianceElevationPresentation, rangeVisualAppearance, type Appliance } from "@/lib/design";

describe("realistic designer appliance appearances", () => {
  it("offers the supplied 30-inch range visuals without changing the RANGE-30 envelope", () => {
    const ranges = APPLIANCES.filter((item) => item.masterCode === "RANGE-30");

    expect(ranges).toHaveLength(8);
    expect(ranges.every((item) => item.width === 30 && item.depth === 25 && item.elevHeight === 36)).toBe(true);
    expect(ranges.every((item) => item.catalogImageUrl?.startsWith("/manus-storage/"))).toBe(true);
  });

  it("offers the supplied hood visuals at their catalog dimensions and preserves their image when placed", () => {
    const hoods = APPLIANCES.filter((item) => /^HOOD-/.test(item.masterCode));
    const glassHood = hoods.find((item) => item.key === "hood-glass-stainless");
    const hood36 = hoods.find((item) => item.masterCode === "HOOD-36");

    expect(glassHood).toMatchObject({ width: 30, depth: 18, elevBottom: 66, elevHeight: 18 });
    expect(hood36).toMatchObject({ width: 36, depth: 18, elevBottom: 66, elevHeight: 18 });
    expect(applianceAsDesignCabinet(glassHood!).catalogImageUrl).toBe(glassHood?.catalogImageUrl);
  });

  it("gives legacy range and hood placements a supplied default while preserving a chosen visual", () => {
    expect(applianceAppearanceImage("RANGE-30")).toBe(APPLIANCES.find((item) => item.masterCode === "RANGE-30" && item.catalogImageUrl)?.catalogImageUrl);
    expect(applianceAppearanceImage("HOOD-30")).toBe(APPLIANCES.find((item) => item.masterCode === "HOOD-30" && item.catalogImageUrl)?.catalogImageUrl);
    expect(applianceAppearanceImage("RANGE-30")).toContain("-silhouette_");
    expect(applianceAppearanceImage("HOOD-30")).toContain("-cropped_");
    expect(applianceAppearanceImage("RANGE-30", "/manus-storage/customer-choice.webp")).toBe("/manus-storage/customer-choice.webp");
  });

  it("keeps the selected Black Gas Range as a black gas procedural appearance", () => {
    expect(rangeVisualAppearance({ description: '30" Black Gas Range', catalogImageUrl: "/manus-storage/30inchWideBlackGasRange-silhouette.webp" }))
      .toMatchObject({ finish: "black", fuel: "gas", controlPosition: "rear", bodyColor: "#15191e" });
    expect(rangeVisualAppearance({ description: '30" Stainless Electric Range', catalogImageUrl: null }))
      .toMatchObject({ finish: "stainless", fuel: "electric", controlPosition: "rear" });
  });

  it("preserves each supplied range variant's front-control or rear-control layout", () => {
    expect(rangeVisualAppearance({ description: '30" Black Gas Range' }).controlPosition).toBe("rear");
    expect(rangeVisualAppearance({ description: '30" Black Stainless Front-Control Range' }).controlPosition).toBe("front");
    expect(rangeVisualAppearance({ description: '30" White Electric Front-Control Range' }).controlPosition).toBe("front");
    expect(rangeVisualAppearance({ description: '30" Stainless Electric Range' }).controlPosition).toBe("rear");
  });

  it("resolves gas and electric range construction profiles without a generic fallback", () => {
    expect(rangeVisualAppearance({ description: '30" Black Gas Range' }))
      .toMatchObject({ fuel: "gas", cooktopStyle: "gas-grate", backPanel: "raised", controlCount: 5, ovenConfiguration: "single" });
    expect(rangeVisualAppearance({ description: '30" White Electric Front-Control Range' }))
      .toMatchObject({ fuel: "electric", cooktopStyle: "electric-glass", backPanel: "none", controlCount: 4, ovenConfiguration: "single" });
  });

  it("uses calibrated appliance elevations while preserving the approved microwave front image", () => {
    expect(applianceElevationPresentation("RANGE-30")).toBe("vector");
    expect(applianceElevationPresentation("RANGE30")).toBe("vector");
    expect(applianceElevationPresentation("HOOD-30")).toBe("vector");
    expect(applianceElevationPresentation("HOOD30")).toBe("vector");
    expect(applianceElevationPresentation("FRIDGE-36")).toBe("vector");
    expect(applianceElevationPresentation("DW-24")).toBe("vector");
    expect(applianceElevationPresentation("MW-30")).toBe("photo");
    expect(applianceAppearanceImage("RANGE-30")).toContain("-silhouette_");
    expect(applianceAppearanceImage("FRIDGE-36")).toContain("lg_french_door_refrigerator_front");
    expect(applianceAppearanceImage("DW-24")).toContain("whirlpool_dishwasher_front");
    expect(applianceAppearanceImage("MW-30")).toContain("zline_over_range_microwave_front");
  });

	  it("keeps the over-range microwave at the confirmed 56-to-72-inch installation height", () => {
	    expect(APPLIANCES.find((item) => item.masterCode === "MW-30"))
	      .toMatchObject({ width: 30, depth: 15, elevBottom: 56, elevHeight: 16 });
	  });
});

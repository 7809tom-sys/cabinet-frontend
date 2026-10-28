import { describe, expect, it } from "vitest";
import { familyTypeMatches } from "./familyCategoryFilters";

describe("family category filters", () => {
  it("groups both moulding spellings with accessories", () => {
    for (const category of [
      "Molding",
      "MOULDING",
      "moulding",
      "Trim and Molding",
      "Trim & Molding",
      "Trim and Moulding",
      "Trim & Moulding",
      "Moldings & Trim",
      "Mouldings & Trim",
    ]) {
      expect(familyTypeMatches("accessory", category)).toBe(true);
      expect(familyTypeMatches("base", category)).toBe(false);
    }
    expect(familyTypeMatches("base", "Base")).toBe(true);
    expect(familyTypeMatches("wall", "Wall")).toBe(true);
    expect(familyTypeMatches("accessory", "Crown Moulding")).toBe(false);
  });

  it("keeps verified wall wine racks on Wall for every supplier category name", () => {
    const racks = [
      { category: "Wall Wine Rack", subCategory: "Wine Rack", masterCode: "WRC3015" },
      { category: "Wall", subCategory: "Wine Rack / Open Display", masterCode: "WRC3018" },
      { category: "Accessories", subCategory: "Wine Storage", masterCode: "LWR3015" },
      { category: "Specialty", subCategory: "Wine Rack", masterCode: "WXR3018" },
      { category: "Accessory", subCategory: "Wine Rack", masterCode: "WWC630" },
    ];
    for (const rack of racks) {
      expect(familyTypeMatches("all", rack.category, rack.subCategory, rack.masterCode)).toBe(true);
      expect(familyTypeMatches("wall", rack.category, rack.subCategory, rack.masterCode)).toBe(true);
      expect(familyTypeMatches("accessory", rack.category, rack.subCategory, rack.masterCode)).toBe(false);
      expect(familyTypeMatches("base", rack.category, rack.subCategory, rack.masterCode)).toBe(false);
    }
    expect(familyTypeMatches("accessory", "Specialty", "Spice Pull-Out")).toBe(true);
    expect(familyTypeMatches("wall", "Specialty", "Spice Pull-Out")).toBe(false);
  });
});

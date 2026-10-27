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
});

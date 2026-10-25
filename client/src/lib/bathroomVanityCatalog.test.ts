import { describe, expect, it } from "vitest";
import { isBathroomVanityCabinet } from "./bathroomVanityCatalog";

const cabinet = (category: string | null, description: string, placement: "base" | "wall" | "accessory", subCategory: string | null = null) => ({
  category, description, placement, subCategory,
});

describe("Bathroom Vanity catalog", () => {
  it("includes source-category vanity bases, sink bases, drawer bases and combos", () => {
    for (const description of ["Vanity Sink Base", "Vanity Drawer Base", "Vanity Combo Base", "ADA Vanity Base"]) {
      expect(isBathroomVanityCabinet(cabinet("Vanity", description, "base"))).toBe(true);
    }
  });

  it("never includes a kitchen base, vanity-described accessory, wall item or decorative valance", () => {
    expect(isBathroomVanityCabinet(cabinet("Base", "Vanity-style kitchen base", "base"))).toBe(false);
    expect(isBathroomVanityCabinet(cabinet("Accessory", "For use with vanity", "accessory"))).toBe(false);
    expect(isBathroomVanityCabinet(cabinet("Vanity", "Wall cabinet", "wall"))).toBe(false);
    expect(isBathroomVanityCabinet(cabinet("Vanity", "Arched valance", "base"))).toBe(false);
  });
});

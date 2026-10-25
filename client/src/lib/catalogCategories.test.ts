import { describe, expect, it } from "vitest";
import { nonEmptyStyleCategories } from "./catalogCategories";

describe("nonEmptyStyleCategories", () => {
  it("only returns labels backed by sellable products in the selected style", () => {
    expect(nonEmptyStyleCategories(
      ["Base", "Wall", "Tall", "Specialty", "Accessory"],
      { Base: 12, Wall: 3, Specialty: 0 },
    )).toEqual(["Base", "Wall"]);
  });

  it("keeps category labels hidden until style availability has loaded", () => {
    expect(nonEmptyStyleCategories(["Base", "Wall"], undefined)).toEqual([]);
  });
});

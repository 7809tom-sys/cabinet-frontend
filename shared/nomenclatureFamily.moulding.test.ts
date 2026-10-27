import { describe, expect, it } from "vitest";
import { nomenclatureFamilyFor, type FamilySource } from "./nomenclatureFamily";

function source(overrides: Partial<FamilySource>): FamilySource {
  return {
    masterCode: "CM8",
    description: "Crown Moulding",
    category: "Moulding",
    subCategory: "Crown Moulding",
    placementType: "accessory",
    width: 96,
    height: 3.25,
    depth: 0.75,
    hingeSide: null,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    isCornerCabinet: false,
    cornerType: null,
    ...overrides,
  };
}

describe("nomenclature family moulding spelling", () => {
  it("keeps the MOLDING family for both catalog spellings", () => {
    expect(nomenclatureFamilyFor(source({})).family).toBe("MOLDING");
    expect(nomenclatureFamilyFor(source({
      category: "Molding",
      subCategory: "Crown Molding",
      description: "Crown Molding",
    })).family).toBe("MOLDING");
    expect(nomenclatureFamilyFor(source({
      category: "Accessory",
      subCategory: "Trim & Moulding",
      description: "Scribe Moulding",
      masterCode: "SM8",
    })).family).toBe("MOLDING");
    expect(nomenclatureFamilyFor(source({
      category: "Accessory",
      subCategory: "Trim & Molding",
      description: "Light Rail Molding",
      masterCode: "LRM8",
    })).family).toBe("MOLDING");
  });

  it("does not treat outside corner moulding as a corner cabinet", () => {
    const tag = nomenclatureFamilyFor(source({
      masterCode: "OCM8",
      category: "Moulding",
      subCategory: "Outside Corner Moulding",
      description: "Outside Corner Moulding",
    }));
    expect(tag.family).toBe("MOLDING");
    expect(tag.cornerSubGroup).toBeNull();
  });
});

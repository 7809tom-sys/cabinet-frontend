import { describe, expect, it } from "vitest";
import { candidatesForMode, type FillCabinet } from "./fillEngine";

function cabinet(overrides: Partial<FillCabinet>): FillCabinet {
  return {
    id: 1,
    masterCode: "B24",
    description: "Base cabinet",
    category: "Base",
    subCategory: "Base",
    width: "24",
    placement: "base",
    ...overrides,
  };
}

describe("fill engine moulding spelling", () => {
  it("excludes moulding and molding rows from straight cabinet runs", () => {
    const picked = candidatesForMode("kitchen", [
      cabinet({ id: 1, masterCode: "CM8", description: "Crown Moulding", category: "Moulding", subCategory: "Crown Moulding", width: "96" }),
      cabinet({ id: 2, masterCode: "CM96", description: "Crown Molding", category: "Molding", subCategory: "Crown Molding", width: "96" }),
      cabinet({ id: 3, masterCode: "OCM", description: "Outside Corner Moulding", category: "Moulding", subCategory: "Outside Corner Moulding", width: "96" }),
      cabinet({ id: 4, masterCode: "B24", description: "Base cabinet", category: "Base", subCategory: "Base", width: "24" }),
    ]);
    expect(picked.map((item) => item.masterCode)).toEqual(["B24"]);
  });
});

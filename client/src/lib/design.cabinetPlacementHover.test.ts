import { describe, expect, it } from "vitest";
import { cabinetPlacementHoverDetail, type DesignCabinet } from "./design";

function cabinet(overrides: Partial<DesignCabinet>): DesignCabinet {
  return {
    id: 1,
    masterCode: "B12",
    description: "Base cabinet",
    category: "Base Cabinets",
    subCategory: null,
    width: "12",
    height: "34.5",
    depth: "24",
    placement: "base",
    numberOfDoors: 1,
    numberOfDrawers: 0,
    isCornerCabinet: false,
    ...overrides,
  };
}

describe("cabinetPlacementHoverDetail", () => {
  it("reports exact DB24 dimensions and zero-clearance edge seating", () => {
    const detail = cabinetPlacementHoverDetail(cabinet({
      masterCode: "3-DB24",
      description: "24 inch three drawer base",
      width: "24",
      height: "34.5",
      depth: "25.4",
    }));

    expect(detail).toMatchObject({
      title: "DB24 drawer base",
      dimensions: { width: 24, height: 34.5, depth: 25.4 },
    });
    expect(detail?.clearance).toContain("0 in.");
    expect(detail?.clearance).toContain("flush edge contact is allowed");
  });

  it("reports the actual dishwasher catalog dimensions and the same physical seam rule", () => {
    const detail = cabinetPlacementHoverDetail(cabinet({
      masterCode: "DW-24",
      description: "Dishwasher 24 inch",
      width: "24",
      height: "34.5",
      depth: "24",
      placement: "appliance",
    }));

    expect(detail).toMatchObject({
      title: "Dishwasher",
      dimensions: { width: 24, height: 34.5, depth: 24 },
    });
    expect(detail?.clearance).toContain("physical overlap is not");
  });

  it("does not advertise an appliance clearance rule for unrelated catalog items", () => {
    expect(cabinetPlacementHoverDetail(cabinet({ masterCode: "B24" }))).toBeNull();
  });
});

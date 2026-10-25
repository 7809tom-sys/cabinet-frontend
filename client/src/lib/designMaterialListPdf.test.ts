import { describe, expect, it } from "vitest";
import { canOpenAdministratorMaterialList, materialListPdfLines } from "./designMaterialListPdf";

describe("administrator material list PDF", () => {
  it("is limited to administrators", () => {
    expect(canOpenAdministratorMaterialList("admin")).toBe(true);
    expect(canOpenAdministratorMaterialList("user")).toBe(false);
    expect(canOpenAdministratorMaterialList(null)).toBe(false);
  });

  it("retains cabinet quantities and specifications without embedding prices", () => {
    const lines = materialListPdfLines([{
      code: "B-24",
      description: "Single Door Base Cabinet",
      widthIn: 24,
      heightIn: 34.5,
      depthIn: 24,
      placement: "base",
      swing: "left",
      color: "Ashford White",
      qty: 2,
      unitPrice: 987.65,
    }]);

    expect(lines).toEqual(["2 × B-24 — Single Door Base Cabinet · Ashford White · 24\"W × 34.5\"H × 24\"D · left hinge"]);
    expect(lines[0]).not.toContain("987.65");
  });
});

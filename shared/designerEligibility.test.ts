import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cabinetCanBeRenderedOrPlacedIn3d,
  designerEligibilityDecision,
} from "./designerEligibility";

const base = {
  masterCode: "B-24",
  description: "24 in single door base cabinet",
  category: "Base",
  subCategory: "Standard Base",
  placementType: "base",
  width: "24",
  height: "34.5",
  depth: "24",
};

describe("3D Designer eligibility", () => {
  it("marks a priced cabinet the Designer can place as eligible", () => {
    expect(cabinetCanBeRenderedOrPlacedIn3d(base)).toBe(true);
    expect(designerEligibilityDecision(base, true)).toEqual({
      eligible: true,
      reason: "published price and the Designer can render or place it",
    });
  });

  it("keeps an unpriced cabinet out even when the Designer could draw it", () => {
    expect(designerEligibilityDecision(base, false)).toMatchObject({
      eligible: false,
      reason: "no published supplier price",
    });
  });

  it("rejects a cabinet the Designer cannot build a box for", () => {
    expect(designerEligibilityDecision({ ...base, depth: null }, true)).toMatchObject({
      eligible: false,
      reason: "missing width, height, or depth",
    });
    expect(designerEligibilityDecision({ ...base, isNotCabinet: true }, true)).toMatchObject({
      eligible: false,
      reason: "marked as not a cabinet",
    });
  });

  it("includes physical accessories the Designer can drop on the plan", () => {
    expect(cabinetCanBeRenderedOrPlacedIn3d({
      masterCode: "F-3",
      description: "3 inch filler",
      category: "Accessory",
      subCategory: "Filler",
      placementType: "accessory",
      width: 3,
      height: 34.5,
      depth: 0.75,
    })).toBe(true);
    expect(cabinetCanBeRenderedOrPlacedIn3d({
      masterCode: "BDEP",
      description: "Base decorative end panel",
      category: "Filler's and Panels",
      subCategory: "Decorative End Panel",
      width: 0.75,
      height: 34.5,
      depth: 24,
    })).toBe(true);
    expect(cabinetCanBeRenderedOrPlacedIn3d({
      masterCode: "FS-30",
      description: "Floating shelf 30 inch",
      category: "Accessory",
      width: 30,
      height: 2.06,
      depth: 12,
    })).toBe(true);
  });

  it("excludes bill-of-materials lines the Designer lists but does not place", () => {
    for (const item of [
      { masterCode: "CM-8", description: "Crown molding 8 ft", category: "Trim and Molding", subCategory: "Crown", width: 96, height: 3, depth: 0.75 },
      { masterCode: "ROT-21", description: "Roll-out tray 21", category: "Accessory", subCategory: "Roll-Out Tray", width: 21, height: 2, depth: 21 },
      { masterCode: "PULL-5", description: "Bar pull hardware", category: "Accessory", width: 5, height: 1, depth: 1 },
      { masterCode: "PGWDC42", description: "Glass door sold separately for WDC42", category: "Accessory", width: 24, height: 30, depth: 0.75 },
      { masterCode: "TEP3096", description: "Tall end panel for refrigerator bridge cabinet", category: "Filler's and Panels", subCategory: "Refrigerator End Panel", width: 0.75, height: 96, depth: 30 },
    ]) {
      expect(designerEligibilityDecision(item, true).eligible, item.masterCode).toBe(false);
    }
  });
});

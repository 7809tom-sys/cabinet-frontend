import { describe, expect, it } from "vitest";
import {
  cabinetCanBeRenderedOrPlacedIn3d,
  designerEligibilityDecision,
  designerPaletteAction,
  isDesignerFlutedFiller,
  isDesignerUtilityOrOvenBox,
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

  it("keeps a priced cabinet in the designer even when a dimension or the not-a-cabinet flag is incomplete", () => {
    expect(designerEligibilityDecision({ ...base, depth: null }, true).eligible).toBe(true);
    expect(designerEligibilityDecision({ ...base, isNotCabinet: true }, true).eligible).toBe(true);
    expect(cabinetCanBeRenderedOrPlacedIn3d({ masterCode: "", description: "" })).toBe(false);
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

  it("offers oven pantries, fluted fillers, moldings, panels, and roll-outs", () => {
    const oven = { masterCode: "UOC3390(O339024)", description: "33\" x 90\" Oven Pantry Cabinet", category: "Tall", subCategory: "Oven Tower", width: 33, height: 90, depth: 24 };
    expect(isDesignerUtilityOrOvenBox(oven)).toBe(true);
    expect(designerPaletteAction(oven)).toEqual({ type: "place" });
    expect(designerEligibilityDecision(oven, true).eligible).toBe(true);
    const fluted = { masterCode: "BFF3", description: "3\" x 34.5\" Fluted Base Filler", category: "Filler", width: 3, height: 34.5, depth: null, isNotCabinet: true };
    expect(isDesignerFlutedFiller(fluted)).toBe(true);
    expect(designerPaletteAction(fluted)).toEqual({ type: "place" });
    expect(designerPaletteAction({ masterCode: "VA48", description: "Arched Valance - 48\"W", category: "Accessory", subCategory: "Valance", width: 48, height: 6, depth: null, isNotCabinet: true })).toEqual({ type: "enable-trim", kind: "valance" });
    expect(designerPaletteAction({ masterCode: "CM8", description: "Crown Molding - 96\"", category: "Molding", width: 96, height: 3, depth: 2 })).toEqual({ type: "enable-trim", kind: "crown" });
    expect(designerPaletteAction({ masterCode: "ROPE", description: "Rope Moulding — 96\" L", category: "Molding", width: 96, height: 0.75, depth: 0.75 })).toEqual({ type: "enable-trim", kind: "rope" });
    expect(designerPaletteAction({ masterCode: "DMTIS", description: "Dentil moulding - 96\"", category: "Molding", width: 96, height: 1, depth: 0.75 })).toEqual({ type: "enable-trim", kind: "dentil" });
    expect(designerPaletteAction({ masterCode: "SM8", description: "Scribe Moulding - 96\"", category: "Molding", width: 96, height: 0.75, depth: 0.75 })).toEqual({ type: "enable-trim", kind: "scribe" });
    expect(designerPaletteAction({ masterCode: "TK8(TKC)", description: "Toe Kick 8' Plywood - 96\"", width: 96, height: 4.5, depth: 0.75 })).toEqual({ type: "enable-trim", kind: "toeKick" });
    expect(designerPaletteAction({ masterCode: "TEP3096", description: "Tall end panel for refrigerator bridge cabinet", category: "Panels", width: 0.75, height: 96, depth: 30 })).toEqual({ type: "place" });
    expect(designerPaletteAction({ masterCode: "UNIV-ROT30", description: "Universal rollout tray for 30-inch cabinet", category: "Accessory", width: 30, height: 2.25, depth: 21 })).toEqual({ type: "attach-rollout", width: 30 });
    expect(designerPaletteAction({ masterCode: "U1884244RS", description: "18\" x 84\" Four Rollout Shelf Utility Cabinet Kit", category: "Accessory", subCategory: "Rollout Tray", width: 18, height: 84, depth: 24 })).toEqual({ type: "place" });
    expect(designerPaletteAction({ masterCode: "SPRAYPAINT", description: "Spray Paint Touch-Up", category: "Accessory", width: 1, height: 8, depth: 1 }).type).toBe("order");
    expect(designerEligibilityDecision({ masterCode: "UNIV-ROT27", description: "Universal rollout tray", width: 27, height: 2.25, depth: 21 }, true).eligible).toBe(true);
  });
});

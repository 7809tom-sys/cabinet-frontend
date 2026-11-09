import { describe, expect, it } from "vitest";
import {
  designerCabinetCodeLabel,
  designerCabinetName,
  hasForbiddenDesignerWording,
  isRangeBaseCabinetCode,
  leadingDimensionBlock,
  rangeBaseDesignerName,
  rangeBaseFamilyForCode,
  rangeBaseNominalWidth,
} from "@/lib/designerCabinetNames";

const RB3DB24 = {
  masterCode: "RB3DB24",
  description: '24" W × 34.75" H × 24" D Three Drawer Range Base with One False Front',
};
const RB2DB30 = {
  masterCode: "RB2DB30",
  description: '30" W × 34.75" H × 24" D Two Drawer Range Base',
};

describe("designer-facing cabinet names (issue #354 item 1)", () => {
  it("identifies the RB drop-in cooktop base family without touching the code", () => {
    expect(rangeBaseFamilyForCode("RB3DB24")).toBe("two-drawer-one-false-front");
    expect(rangeBaseFamilyForCode("RB2DB30")).toBe("two-drawer");
    expect(rangeBaseFamilyForCode("rb-3db-36")).toBe("two-drawer-one-false-front");
    expect(rangeBaseFamilyForCode("B24")).toBeNull();
    expect(rangeBaseFamilyForCode("3DB24")).toBeNull();
    expect(isRangeBaseCabinetCode("RB2DB24")).toBe(true);
    expect(isRangeBaseCabinetCode("B24S")).toBe(false);
    expect(rangeBaseNominalWidth("RB3DB24")).toBe(24);
    expect(rangeBaseNominalWidth("RB2DB36")).toBe(36);
  });

  it("never shows the RB prefix or the words 'range base'", () => {
    for (const row of [RB3DB24, RB2DB30]) {
      const name = designerCabinetName(row);
      expect(name).not.toMatch(/\bRB\b/i);
      expect(name).not.toMatch(/range\s*base/i);
      expect(hasForbiddenDesignerWording(name)).toBe(false);
    }
    expect(designerCabinetName(RB3DB24)).toBe('24" W × 34.75" H × 24" D Two Drawer Base with One False Front for a range top');
    expect(designerCabinetName(RB2DB30)).toBe('30" W × 34.75" H × 24" D Two Drawer Base for a range top');
  });

  it("keeps the book's two-drawer wording for RB3DB (item 6)", () => {
    // The book title is "Two Drawer One False Drawer Front Range Bases"; the
    // false front is not a working drawer, so the name never says three.
    expect(designerCabinetName(RB3DB24)).not.toMatch(/three\s*drawer/i);
    expect(rangeBaseDesignerName("two-drawer-one-false-front")).toContain("One False Front");
  });

  it("leaves every other cabinet description alone", () => {
    expect(designerCabinetName({ masterCode: "B24", description: '24" W × 34.75" H × 24" D Double Door Single Drawer Base' }))
      .toBe('24" W × 34.75" H × 24" D Double Door Single Drawer Base');
    expect(designerCabinetName({ masterCode: "W2430S", description: '24" W × 30.25" H × 13.5" D Single Door Wall Cabinet' }))
      .toBe('24" W × 30.25" H × 13.5" D Single Door Wall Cabinet');
    expect(designerCabinetName({ masterCode: "B24", description: null })).toBe("B24");
  });

  it("strips a supplier-baked RB code and 'range base' wording from any other row", () => {
    expect(designerCabinetName({ masterCode: "X1", description: "RB2DB27 — 27 inch base" })).toBe("27 inch base");
    expect(designerCabinetName({ masterCode: "X1", description: "Cooktop range base box" })).toBe("Cooktop base box");
  });

  it("labels an order code instead of renaming it", () => {
    expect(designerCabinetCodeLabel("RB3DB24")).toBe("Order code RB3DB24");
    expect(designerCabinetCodeLabel("B24")).toBe("B24");
    expect(designerCabinetCodeLabel(null)).toBe("");
  });

  it("reads the dimension block the catalog rows lead with, and nothing else", () => {
    expect(leadingDimensionBlock(RB3DB24.description)).toBe('24" W × 34.75" H × 24" D ');
    expect(leadingDimensionBlock("Two Drawer Base")).toBe("");
    expect(leadingDimensionBlock(null)).toBe("");
  });
});

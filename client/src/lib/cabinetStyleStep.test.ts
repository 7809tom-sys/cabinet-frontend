import { describe, expect, it } from "vitest";
import {
  AUTO_DESIGN_STYLE_STEP_COPY,
  DESIGNER_STYLE_STEP_COPY,
  cabinetStyleStepCopy,
  followUpAfterAutoDesignStyle,
  styleStepVendor,
} from "./cabinetStyleStep";

describe("cabinet style step", () => {
  it("uses neutral wording unless Auto-Design opened the step", () => {
    expect(cabinetStyleStepCopy(null)).toBe(DESIGNER_STYLE_STEP_COPY);
    expect(DESIGNER_STYLE_STEP_COPY.description).toBe(
      "Choose the cabinet vendor, then the door style/color. Your design uses these cabinets.",
    );
    expect(DESIGNER_STYLE_STEP_COPY.description).not.toMatch(/auto-design/i);
    expect(cabinetStyleStepCopy("auto-design").description).toBe(AUTO_DESIGN_STYLE_STEP_COPY.description);
    expect(AUTO_DESIGN_STYLE_STEP_COPY.description).toMatch(/Auto-Design draws your kitchen/);
  });

  it("keeps a chosen vendor, and otherwise uses the first catalog vendor", () => {
    expect(styleStepVendor({
      catalogDistributorId: null,
      lockedDistributorId: null,
      selectedStyleDistributorId: 7,
      catalogVendorIds: [1, 7],
    })).toBe(7);
    expect(styleStepVendor({
      catalogDistributorId: 4,
      lockedDistributorId: 9,
      selectedStyleDistributorId: null,
      catalogVendorIds: [1],
    })).toBe(9);
    expect(styleStepVendor({
      catalogDistributorId: 4,
      lockedDistributorId: null,
      selectedStyleDistributorId: null,
      catalogVendorIds: [1],
    })).toBe(4);
    expect(styleStepVendor({
      catalogDistributorId: null,
      lockedDistributorId: null,
      selectedStyleDistributorId: null,
      catalogVendorIds: [12, 4],
    })).toBe(12);
    expect(styleStepVendor({
      catalogDistributorId: null,
      lockedDistributorId: null,
      selectedStyleDistributorId: null,
      catalogVendorIds: [],
    })).toBeNull();
  });

  it("opens Auto-Design only after that step is confirmed with a vendor and a door", () => {
    const ready = { action: "confirm" as const, purpose: "auto-design" as const, distributorChosen: true, styleChosen: true };
    expect(followUpAfterAutoDesignStyle(ready)).toBe("auto-design");
    expect(followUpAfterAutoDesignStyle({ ...ready, action: "dismiss" })).toBeNull();
    expect(followUpAfterAutoDesignStyle({ ...ready, purpose: null })).toBeNull();
    expect(followUpAfterAutoDesignStyle({ ...ready, distributorChosen: false })).toBeNull();
    expect(followUpAfterAutoDesignStyle({ ...ready, styleChosen: false })).toBeNull();
  });
});

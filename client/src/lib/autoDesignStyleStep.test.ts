import { describe, expect, it } from "vitest";
import { AUTO_DESIGN_STYLE_STEP_COPY, autoDesignStepVendor, followUpAfterAutoDesignStyle } from "./autoDesignStyleStep";

describe("Auto-Design vendor / door-style step", () => {
  it("preselects the vendor behind the plan's door style first", () => {
    expect(autoDesignStepVendor({ catalogDistributorId: 1, lockedDistributorId: 3, selectedStyleDistributorId: 2 })).toBe(2);
    expect(autoDesignStepVendor({ catalogDistributorId: 1, lockedDistributorId: 3, selectedStyleDistributorId: null })).toBe(3);
    expect(autoDesignStepVendor({ catalogDistributorId: 1, lockedDistributorId: null, selectedStyleDistributorId: null })).toBe(1);
    expect(autoDesignStepVendor({ catalogDistributorId: null, lockedDistributorId: null, selectedStyleDistributorId: null })).toBeNull();
  });

  it("opens Auto-Design only after a confirmed vendor and door style", () => {
    const base = { purpose: "auto-design" as const, distributorChosen: true, styleChosen: true };
    expect(followUpAfterAutoDesignStyle({ ...base, action: "confirm" })).toBe("auto-design");
    expect(followUpAfterAutoDesignStyle({ ...base, action: "dismiss" })).toBeNull();
    expect(followUpAfterAutoDesignStyle({ ...base, action: "confirm", distributorChosen: false })).toBeNull();
    expect(followUpAfterAutoDesignStyle({ ...base, action: "confirm", styleChosen: false })).toBeNull();
  });

  it("never opens Auto-Design from the Start-from-scratch or catalog openers", () => {
    expect(followUpAfterAutoDesignStyle({ action: "confirm", purpose: null, distributorChosen: true, styleChosen: true })).toBeNull();
  });

  it("names the next step and a plain Cancel", () => {
    expect(AUTO_DESIGN_STYLE_STEP_COPY.confirmLabel).toBe("Continue to Auto-Design");
    expect(AUTO_DESIGN_STYLE_STEP_COPY.dismissLabel).toBe("Cancel");
    expect(AUTO_DESIGN_STYLE_STEP_COPY.description).not.toMatch(/US Cabinet Depot|USCD/i);
  });
});

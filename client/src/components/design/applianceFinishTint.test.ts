import { describe, expect, it } from "vitest";
import { applianceFinishNeedsTint, refrigeratorBodyMaterialParams, tintApplianceRgb } from "./applianceFinishTint";

describe("appliance finish tint", () => {
  it("leaves stainless and unset finishes as the supplied photo", () => {
    expect(applianceFinishNeedsTint("stainless")).toBe(false);
    expect(applianceFinishNeedsTint(null)).toBe(false);
    expect(applianceFinishNeedsTint(undefined)).toBe(false);
    expect(applianceFinishNeedsTint("white")).toBe(true);
  });

  it("keeps shading order so handles and seams stay readable", () => {
    for (const finish of ["white", "black", "black-stainless"] as const) {
      const dark = tintApplianceRgb(finish, 40, 40, 40)[0];
      const light = tintApplianceRgb(finish, 220, 220, 220)[0];
      expect(light).toBeGreaterThan(dark);
    }
  });

  it("white reads light and black reads dark across the photo's range", () => {
    expect(tintApplianceRgb("white", 30, 30, 30)[0]).toBeGreaterThan(150);
    expect(tintApplianceRgb("black", 230, 230, 230)[0]).toBeLessThan(100);
  });

  it("fridge shell follows the finish", () => {
    expect(refrigeratorBodyMaterialParams("white").color).toBe("#e6e8ea");
    expect(refrigeratorBodyMaterialParams(null).color).toBe("#5f666d");
  });
});

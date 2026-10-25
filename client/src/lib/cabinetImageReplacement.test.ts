import { describe, expect, it } from "vitest";
import { requiresImageReplacementScope } from "./cabinetImageReplacement";

describe("requiresImageReplacementScope", () => {
  it("does not require a scope decision for an initial image assignment", () => {
    expect(requiresImageReplacementScope(null, "/manus-storage/new.png")).toBe(false);
  });

  it("requires a line-versus-all-lines decision when a catalog image changes", () => {
    expect(requiresImageReplacementScope("/manus-storage/old.png", "/manus-storage/new.png")).toBe(true);
  });

  it("does not prompt when the existing image remains selected or is cleared", () => {
    expect(requiresImageReplacementScope("/manus-storage/same.png", "/manus-storage/same.png")).toBe(false);
    expect(requiresImageReplacementScope("/manus-storage/old.png", null)).toBe(false);
  });
});

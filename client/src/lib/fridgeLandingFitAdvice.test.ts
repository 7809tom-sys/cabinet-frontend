import { describe, expect, it } from "vitest";
import { fridgeLandingAdvice, suggestFridgeLandingFixes } from "./fridgeLandingFitAdvice";

describe("refrigerator landing advice", () => {
  it("suggests the smaller sink base when it frees the shortfall", () => {
    const fixes = suggestFridgeLandingFixes({ landingIn: 0, requiredIn: 15, sinkBaseWidthIn: 36, refrigeratorWidthIn: 36 });
    // 15 short: a 30" sink base frees only 6, so nothing smaller than 21 would do.
    expect(fixes.some((fix) => fix.kind === "sink-base")).toBe(false);
  });

  it("suggests the largest smaller size that covers the gap", () => {
    const fixes = suggestFridgeLandingFixes({ landingIn: 9, requiredIn: 15, sinkBaseWidthIn: 30, refrigeratorWidthIn: 36 });
    expect(fixes.map((fix) => `${fix.kind}:${fix.suggestedIn}`)).toEqual(["sink-base:24"]);
    expect(fixes[0]!.freedIn).toBe(6);
  });

  it("offers both swaps when a 6 inch reduction is enough", () => {
    const fixes = suggestFridgeLandingFixes({ landingIn: 9, requiredIn: 15, sinkBaseWidthIn: 36, refrigeratorWidthIn: 36 });
    expect(fixes.map((fix) => fix.kind)).toEqual(["sink-base", "refrigerator"]);
    expect(fixes.every((fix) => fix.suggestedIn === 30)).toBe(true);
  });

  it("says so when no stock size frees enough", () => {
    expect(fridgeLandingAdvice({ landingIn: 0, requiredIn: 15, sinkBaseWidthIn: 24, refrigeratorWidthIn: 30 })).toMatch(/plan change/);
  });

  it("stays silent when the landing already meets the rule", () => {
    expect(suggestFridgeLandingFixes({ landingIn: 15, requiredIn: 15, sinkBaseWidthIn: 36, refrigeratorWidthIn: 36 })).toEqual([]);
  });
});

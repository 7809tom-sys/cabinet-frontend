import { describe, expect, it } from "vitest";
import {
  PLACEHOLDER_CLOSE_BRACKETS,
  ageDaysFromUpdatedAt,
  closeRateForAge,
  validateCloseRateBrackets,
} from "./closeRateBrackets";

describe("close rate brackets", () => {
  it("uses the placeholder bands, including 90+ at day 91", () => {
    expect(closeRateForAge(0, PLACEHOLDER_CLOSE_BRACKETS)).toBe(70);
    expect(closeRateForAge(30, PLACEHOLDER_CLOSE_BRACKETS)).toBe(70);
    expect(closeRateForAge(31, PLACEHOLDER_CLOSE_BRACKETS)).toBe(55);
    expect(closeRateForAge(90, PLACEHOLDER_CLOSE_BRACKETS)).toBe(40);
    expect(closeRateForAge(91, PLACEHOLDER_CLOSE_BRACKETS)).toBe(20);
  });

  it("measures age from updatedAt", () => {
    const updated = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-02-15T00:00:00Z");
    expect(ageDaysFromUpdatedAt(updated, now)).toBe(45);
    expect(closeRateForAge(ageDaysFromUpdatedAt(updated, now), PLACEHOLDER_CLOSE_BRACKETS)).toBe(55);
  });

  it("rejects overlap and percents outside 0–100", () => {
    expect(validateCloseRateBrackets([
      { minDays: 0, maxDays: 30, closePercent: 70 },
      { minDays: 30, maxDays: 60, closePercent: 50 },
    ])).toMatch(/overlap/i);
    expect(validateCloseRateBrackets([{ minDays: 0, maxDays: null, closePercent: 101 }])).toMatch(/0 and 100/);
    expect(validateCloseRateBrackets(PLACEHOLDER_CLOSE_BRACKETS)).toBeNull();
  });
});

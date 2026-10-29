import { describe, expect, it } from "vitest";
import { deltaE2000, deltaE2000Hex, labFromHex } from "./ciede2000";
import { colorGateLabel, nudgeHexToward, runColorGate } from "./colorGate";

describe("CIEDE2000", () => {
  it("is zero for the same color and matches Sharma pair 1", () => {
    const white = labFromHex("#ffffff");
    expect(white && deltaE2000(white, white)).toBe(0);
    const delta = deltaE2000(
      { L: 50, a: 2.6772, b: -79.7751 },
      { L: 50, a: 0, b: -82.7485 },
    );
    expect(delta).toBeCloseTo(2.0425, 3);
    expect(deltaE2000Hex("#000000", "#ffffff")).toBeGreaterThan(50);
  });
});

describe("color gate", () => {
  it("passes a style with renderHex and no swatch when the lit patch is already close", async () => {
    const result = await runColorGate({
      baseHex: "#434341",
      renderHex: "#434341",
      threshold: 3,
      measure: async (hex) => hex,
    });
    expect(result.status).toBe("pass");
    expect(result.deltaE).toBe(0);
    expect(result.attempts).toBe(1);
    expect(result.label).toBe("Pass");
    expect(result.hex).toBe("#434341");
  });

  it("blocks a style with renderHex and no swatch when the lit patch stays far from the approved color", async () => {
    const result = await runColorGate({
      baseHex: "#f4f1ea",
      renderHex: "#434341",
      threshold: 3,
      measure: async () => "#f7f6f3",
    });
    expect(result.status).toBe("color-mismatch");
    expect(result.attempts).toBe(4);
    expect(result.label).toMatch(/^Color mismatch \(dE /);
    expect(result.hex).toBe("#f4f1ea");
    expect(colorGateLabel("color-mismatch", 12.4)).toBe("Color mismatch (dE 12.4)");
  });

  it("does not block a style with no renderHex", async () => {
    let measured = false;
    const result = await runColorGate({
      baseHex: "#8d8f92",
      renderHex: null,
      measure: async () => {
        measured = true;
        return "#000000";
      },
    });
    expect(measured).toBe(false);
    expect(result).toMatchObject({ status: "pass", hex: "#8d8f92", deltaE: null, attempts: 0, label: "Pass" });
  });

  it("does not block when render hex is blank or not a hex color", async () => {
    const blank = await runColorGate({
      baseHex: "#8d8f92",
      renderHex: "   ",
      measure: async () => "#000000",
    });
    const invalid = await runColorGate({
      baseHex: "#8d8f92",
      renderHex: "SW7069",
      measure: async () => "#000000",
    });
    expect(blank.status).toBe("pass");
    expect(invalid.status).toBe("pass");
    expect(invalid.hex).toBe("#8d8f92");
  });

  it("moves a too-light base toward a darker render hex", () => {
    const next = nudgeHexToward("#f4f1ea", "#f4f1ea", "#434341");
    expect(next).not.toBe("#f4f1ea");
    const [r] = [Number.parseInt(next.slice(1, 3), 16)];
    expect(r).toBeLessThan(0xf4);
  });
});

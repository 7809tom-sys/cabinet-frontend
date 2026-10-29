import { describe, expect, it } from "vitest";
import { deltaE2000, deltaE2000Hex, labFromHex } from "./ciede2000";
import { colorGateLabel, nudgeHexToward, runColorGate } from "./colorGate";
import { SHERWIN_WILLIAMS_COLORS, sherwinWilliamsColor } from "./sherwinWilliamsColors";

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
  it("passes when the lit patch is already close to the swatch", async () => {
    const result = await runColorGate({
      baseHex: "#434341",
      swatchHex: "#434341",
      threshold: 3,
      measure: async (hex) => hex,
    });
    expect(result.status).toBe("pass");
    expect(result.deltaE).toBe(0);
    expect(result.label).toBe("Pass");
  });

  it("blocks when the lit patch stays far from the swatch", async () => {
    const result = await runColorGate({
      baseHex: "#f4f1ea",
      swatchHex: "#434341",
      threshold: 3,
      measure: async () => "#f7f6f3",
    });
    expect(result.status).toBe("color-mismatch");
    expect(result.attempts).toBe(4);
    expect(result.label).toMatch(/^Color mismatch \(dE /);
    expect(result.hex).toBe("#f4f1ea");
    expect(colorGateLabel("needs-swatch", null)).toBe("Needs swatch");
  });

  it("blocks as Needs swatch when no reference is stored", async () => {
    const result = await runColorGate({
      baseHex: "#8d8f92",
      swatchHex: null,
      measure: async (hex) => hex,
    });
    expect(result).toMatchObject({ status: "needs-swatch", hex: "#8d8f92", label: "Needs swatch" });
  });

  it("moves a too-light base toward a darker swatch", () => {
    const next = nudgeHexToward("#f4f1ea", "#f4f1ea", "#434341");
    expect(next).not.toBe("#f4f1ea");
    const [r] = [Number.parseInt(next.slice(1, 3), 16)];
    expect(r).toBeLessThan(0xf4);
  });
});

describe("Sherwin-Williams table", () => {
  it("stores the published hex and a Lab computed from it", () => {
    const iron = sherwinWilliamsColor("SW 7069");
    expect(iron?.hex).toBe("#434341");
    expect(iron?.name).toBe("Iron Ore");
    expect(iron?.source).toContain("sherwin-williams.com");
    expect(iron?.lab.L).toBeGreaterThan(0);
    expect(sherwinWilliamsColor("sw7015")?.hex).toBe("#ccc9c0");
    expect(SHERWIN_WILLIAMS_COLORS.length).toBeGreaterThan(0);
  });
});

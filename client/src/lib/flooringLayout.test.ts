import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FLOORING_LAYOUT_PATTERNS } from "./design";
import { flooringOverageRate, flooringPlanPatternStyle, flooringPlanRotationLayerStyle, flooringRotationRadians, isFlooringRotation } from "./flooringLayout";

describe("flooring layout rules", () => {
  it("offers six layouts and does not preselect one in the Designer", () => {
    expect(FLOORING_LAYOUT_PATTERNS.map((pattern) => pattern.id)).toEqual([
      "random-stagger",
      "straight-lay",
      "third-offset",
      "brick-lay",
      "diagonal",
      "herringbone",
    ]);
    const designer = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(designer).toContain("useState<import(\"@/lib/design\").FlooringLayoutPattern | null>(null)");
    expect(designer).not.toContain('setFlooringPattern("random-stagger")');
    expect(designer).toContain("FlooringLayoutPicker");
    const rules = readFileSync(new URL("./flooringLayout.ts", import.meta.url), "utf8");
    expect(rules).toContain("Acclimate for 3 days");
    expect(rules).toContain("three days before installation");
    expect(rules).toContain("Cut and lay out first");
    expect(rules).toContain("Cut the pieces ahead of time");
    const picker = readFileSync(new URL("../components/design/FlooringLayoutPicker.tsx", import.meta.url), "utf8");
    expect(picker).toContain("FLOORING_INSTALLATION_RULES");
    expect(picker).toContain("flooring-herringbone-warning");
    expect(picker).toContain("aria-pressed={selected}");
  });

  it("draws a chosen layout and leaves the floor plain until one is clicked", () => {
    expect(flooringPlanPatternStyle(null, "#000", 20, 10).backgroundImage).toBeUndefined();
    expect(flooringPlanPatternStyle("straight-lay", "#000", 20, 10).backgroundImage).toContain("svg");
    expect(flooringPlanPatternStyle("herringbone", "#abc", 20, 10).backgroundImage).toContain("45deg");
    expect(flooringPlanPatternStyle("brick-lay", "#000", 20, 10).backgroundSize).toBe("20px 20px");
  });

  it("rotates plank direction by 0, 90, or 45 degrees and covers a rectangular plan", () => {
    expect(isFlooringRotation(0)).toBe(true);
    expect(isFlooringRotation(90)).toBe(true);
    expect(isFlooringRotation(45)).toBe(true);
    expect(isFlooringRotation(30)).toBe(false);
    expect(flooringRotationRadians(90)).toBeCloseTo(Math.PI / 2);
    expect(flooringRotationRadians(45)).toBeCloseTo(Math.PI / 4);
    const layer = flooringPlanRotationLayerStyle(90, 120, 80);
    expect(layer.width).toBeGreaterThanOrEqual(Math.hypot(120, 80));
    expect(layer.transform).toContain("rotate(90deg)");
    const designer = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(designer).toContain("flooringRotation");
    expect(designer).toContain("onFlooringRotationChange={setFlooringRotation}");
  });

  it("charges 20% waste for herringbone and 10% for every other layout", () => {
    expect(flooringOverageRate("herringbone")).toBe(0.2);
    expect(flooringOverageRate("straight-lay")).toBe(0.1);
    expect(flooringOverageRate(null)).toBe(0.1);
  });
});

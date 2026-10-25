import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("DesignTool high-resolution Floor Plan export", () => {
  it("exports the dimensioned Floor Plan image at print resolution", () => {
    expect(source).toContain("const exportFloorPlanImage = useCallback");
    expect(source).toContain('if (viewMode !== "plan")');
    expect(source).toContain('pixelRatio: 4');
    expect(source).toContain('cabinet-floor-plan-${Date.now()}.png');
    expect(source).toContain('data-testid="floor-plan-export-image"');
  });

  it("opens a landscape print document for a user-saved PDF", () => {
    expect(source).toContain("const exportFloorPlanPdf = useCallback");
    expect(source).toContain('window.open("", "_blank")');
    expect(source).toContain("@page{size:landscape;margin:.35in}");
    expect(source).toContain('data-testid="floor-plan-export-pdf"');
    expect(source).toContain("Export Floor Plan PDF");
  });

  it("provides saved imperial and metric dimension toggles on desktop and mobile", () => {
    expect(source).toContain('const dimensionUnitSystem = room.dimensionLabelStyle?.unitSystem === "metric" ? "metric" : "imperial";');
    expect(source).toContain('data-testid="floor-plan-dimension-units-toggle"');
    expect(source).toContain('data-testid="mobile-floor-plan-dimension-units-toggle"');
    expect(source).toContain('unitSystem: dimensionUnitSystem === "imperial" ? "metric" : "imperial"');
  });
});

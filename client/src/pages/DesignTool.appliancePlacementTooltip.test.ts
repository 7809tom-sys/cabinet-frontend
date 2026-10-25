import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer DB24 and dishwasher placement tooltips", () => {
  it("uses the shared physical placement detail on cabinet palette cards", () => {
    expect(source).toContain("cabinetPlacementHoverDetail");
    expect(source).toContain("data-testid={placementDetail ? `cabinet-placement-detail-${c.masterCode}` : undefined}");
    expect(source).toContain("Hover for dimensions &amp; flush-seam clearance");
    expect(source).toContain("formatEighthInches(placementDetail.dimensions.depth)");
  });

  it("confirms a continuous-wall appliance only after a true physical flush seam", () => {
    expect(source).toContain("continuousWallApplianceSnapInfo(finalCab, committedRun, room)");
    expect(source).toContain('snapped flush on ${wallLabel}: 0\\" gap, 0\\" overlap');
    expect(source).toContain('next to ${neighbors.join(" + ")}');
  });
});

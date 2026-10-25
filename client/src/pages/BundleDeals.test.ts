import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bundleDealsSource = readFileSync(new URL("./BundleDeals.tsx", import.meta.url), "utf8");

describe("Kitchen Packages card pricing", () => {
  it("does not render a recomputed live current total beside the verified saved package price", () => {
    expect(bundleDealsSource).not.toContain("bundle.homeownerPrice");
    expect(bundleDealsSource).not.toContain("Current pricing needs review");
    expect(bundleDealsSource).not.toMatch(/>Current</);
  });

  it("replaces a broken floor-plan image with a clear non-image state instead of leaving a broken preview", () => {
    expect(bundleDealsSource).toContain("failedFloorPlans");
    expect(bundleDealsSource).toContain("onError={() => markFloorPlanUnavailable(bundle.id)}");
    expect(bundleDealsSource).toContain("Floor-plan preview unavailable");
    expect(bundleDealsSource).toContain("Open this package in the Designer to review its layout.");
  });
});

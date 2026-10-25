import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer alternate-wall placement recommendation", () => {
  it("opens a measured alternate-wall choice instead of rejecting a normal catalog cabinet outright", () => {
    expect(source).toContain("alternateWallPlacementRecommendation(");
    expect(source).toContain("setAlternateWallRecommendation({");
    expect(source).toContain("Clear cabinet opening found");
    expect(source).toContain("The design has not changed.");
  });

  it("places an explicitly accepted recommendation through the existing strict zero-overlap add path", () => {
    expect(source).toContain("const placeOnRecommendedWall = useCallback");
    expect(source).toContain("setActiveWall(recommendation.side);");
    expect(source).toContain("recommendation.spot.rotation,");
    expect(source).toMatch(/recommendation\.spot\.rotation,\s*true,\s*null,\s*null,/);
  });
});

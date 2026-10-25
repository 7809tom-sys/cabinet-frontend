import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/design/IslandElevationView.tsx"), "utf8");

describe("island elevation waterfall ends", () => {
  it("shows selected waterfall sides as full-height countertop panels", () => {
    expect(source).toContain("waterfall-left-${p.uid}");
    expect(source).toContain("waterfall-right-${p.uid}");
    expect(source).toContain("STD.BASE_HEIGHT + THICKNESS_IN");
    expect(source).toContain("p.waterfallLeft || p.waterfallRight");
  });

  it("uses the Island setup choice for left, right, and both-end elevation panels", () => {
    expect(source).toContain("const zoneWaterfallEnd = island.waterfallEnd ?? \"none\"");
    expect(source).toContain('zoneWaterfallEnd === "both"');
    expect(source).toContain("zone-waterfall-${physicalEnd}-${face}");
    expect(source).toContain("zoneWaterfallEnds.includes(face)");
    expect(source).toContain("Legacy per-cabinet flags remain a fallback for older plans");
  });

  it("receives the shared Slim Shaker metric map rather than falling back to an island-only three-inch frame", () => {
    expect(source).toContain("frameMetricsFor?:");
    expect(source).toContain('cabPanelKind === "slim-shaker"');
    expect(source).toContain("frameInsetPx={cabPanelKind === \"slim-shaker\" ? cabFrameInset ?? 4 : undefined}");
    expect(source).toContain("frameStileIn={cabFrameStileIn}");
  });
});

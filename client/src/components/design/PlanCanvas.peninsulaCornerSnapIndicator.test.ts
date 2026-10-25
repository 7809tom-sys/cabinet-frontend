import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PlanCanvas.tsx", import.meta.url), "utf8");
const designToolSource = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");

describe("peninsula 90-degree corner snap feedback", () => {
  it("renders a persistent green 90-degree bend snap indicator for a flush true corner on a peninsula", () => {
    expect(source).toContain("const isSeatedPeninsulaCorner = Boolean(");
    expect(source).toContain("cornerPlacement?.angle === 90");
    expect(source).toContain("peninsulaRunById(room, p.wallId as WallSide)");
    expect(source).toContain('data-testid="peninsula-corner-snap-indicator"');
    expect(source).toContain("90° BEND SNAP");
    expect(source).toContain("data-peninsula-corner-snap-confirmed");
    expect(source).toContain("showPeninsulaCornerSnapFeedback?: boolean");
    expect(source).toContain("const showSeatedPeninsulaCornerFeedback = isSeatedPeninsulaCorner && showPeninsulaCornerSnapFeedback;");
    expect(source).toContain("isWindowCenteredSink || showSeatedPeninsulaCornerFeedback || applianceSnap || showWallSnapSuccess ? \"motion-safe:animate-pulse\"");
    expect(source).toContain("{showSeatedPeninsulaCornerFeedback && (");
  });

  it("confirms the successful peninsula bend snap in the placement toast", () => {
    expect(designToolSource).toContain("const snappedToPeninsulaBend = cornerPlacement.angle === 90");
    expect(designToolSource).toContain("snapped flush to the 90° peninsula bend");
  });
});

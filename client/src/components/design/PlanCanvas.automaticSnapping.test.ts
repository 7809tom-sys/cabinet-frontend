import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/design/PlanCanvas.tsx"), "utf8");

describe("PlanCanvas automatic replacement placement", () => {
  it("uses the explicit toolbar snapping choice rather than an incidental Shift key for catalog drops", () => {
    expect(source).toContain("automaticSnapping = true");
    expect(source).toContain("setCatalogDragFreehand(!automaticSnapping)");
    expect(source).toContain("const peninsulaWall = peninsulaRunHitAtPoint(room, point, Math.max(10, 40 / ppi))?.run.id");
    // One wall-run resolver for standard sides and drawn walls alike.
    expect(source).toContain("const targetWall = (peninsulaWall ?? nearestWallRunAtPoint(room, point)?.frame.id) as WallSide | undefined");
    expect(source).not.toContain("closestWall(");
    expect(source).toContain("onDropNew(e.clientX, e.clientY, rect, ppi, !automaticSnapping, targetWall)");
  });

  it("labels the entire highlighted opening with its clear measured span", () => {
	    expect(source).toContain('data-testid="catalog-drag-clear-span"');
	    expect(source).toContain("Clear span · {formatEighthInches(gap.length)}");
	  });

	  it("recommends the largest compatible exact catalog fit and makes an undersized opening visibly red", () => {
	    expect(source).toContain('data-testid="catalog-drag-best-fit"');
	    expect(source).toContain("Perfect fit · ${suggestedFit.cabinet.masterCode}");
	    expect(source).toContain('data-testid="catalog-drag-too-large"');
	    expect(source).toContain('data-too-large={tooLarge ? "true" : "false"}');
	    expect(source).toContain("needs {formatEighthInches(catalogDragFit.requiredSpan)} · opening {formatEighthInches(catalogDragFit.availableSpan)} · short {formatEighthInches(catalogDragFit.shortage)}");
	  });

	  it("shows a labeled green cabinet ghost over a released opening and distinguishes an exact fit", () => {
	    expect(source).toContain('data-testid="catalog-drag-snap-ghost"');
	    expect(source).toContain('data-testid="catalog-drag-ghost-label"');
	    expect(source).toContain('data-perfect-fit={Math.abs(catalogDragFit.availableSpan - catalogDragFit.requiredSpan) <= 0.01 ? "true" : "false"}');
	    expect(source).toContain('? "Perfect fit" : "Fits here"');
	  });

	  it("marks the active island face with an explicit visible placement label", () => {
	    expect(source).toContain('data-testid="active-island-face-indicator"');
	    expect(source).toContain("ACTIVE PLACEMENT");
	    expect(source).toContain('activeIslandFace === "back"');
	    expect(source).toContain('activeIslandFace === "front"');
	  });

	  it("turns the active island edge red and explains the remaining face capacity before an oversized cabinet is dropped", () => {
	    expect(source).toContain("const activeIslandFaceCapacityWarning = (() => {");
	    expect(source).toContain("islandFaceCapacity(island, activeIslandFace, cabinets)");
	    expect(source).toContain('data-testid="active-island-face-too-small"');
	    expect(source).toContain("cabinet needs");
	    expect(source).toContain("bg-rose-700");
	  });

	  it("shows a reduced-motion-aware Back-face depth expansion cue with before-and-after depth", () => {
	    expect(source).toContain("islandDepthTransition?: { fromDepth: number; toDepth: number; key: number } | null");
	    expect(source).toContain('data-testid="island-depth-expansion-animation"');
	    expect(source).toContain("BACK EXPANDS");
	    expect(source).toContain("island-depth-expansion-cue");
	  });

	  it("renders a primary peninsula attachment as the endpoint of its parent wall instead of retaining a wall behind the open continuation", () => {
	    expect(source).toContain('data-testid={`room-wall-${side}`}');
	    expect(source).toContain("const segment = cabinetWallRunSegment(side, room)");
	    expect(source).toContain("left: segment.start * ppi");
	    expect(source).toContain('border: "none"');
	    expect(source).toContain("const retainedWall = cabinetWallRunSegment(side, room)");
	    expect(source).toContain("const visibleLength = retainedWall.length * ppi");
	  });

	  it("previews the exact wall section that will remain before the Compass split commits", () => {
	    expect(source).toContain("retainedWallSegmentForSplit(side, room, compassStart)");
	    expect(source).toContain('data-testid="compass-retained-wall-preview"');
	    expect(source).toContain("data-retained-length={prospectiveRetainedWall.length}");
	    expect(source).toContain("Retain {formatEighthInches(prospectiveRetainedWall.length)}");
	    expect(source).toContain("onFocus={() => setCompassPreviewVisible(true)}");
	  });

	  it("shows exact installed dimensions for each split filler half on hover and keyboard focus", () => {
	    expect(source).toContain("splitFillerDimensionTooltip(p)");
	    expect(source).toContain('data-testid="split-filler-dimension-tooltip"');
	    expect(source).toContain("group-hover:opacity-100 group-focus:opacity-100");
	    expect(source).toContain("This half:");
	    expect(source).toContain("Adjoining half:");
	  });
});

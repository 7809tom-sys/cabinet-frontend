import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Design Tool vertical wall-cabinet movement", () => {
  it("repairs a pointer-near wall-run seam before validating an up or down move", () => {
    const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
    expect(source).toContain("repairWallCabinetPlanSeamForVerticalMove");
	    const repairCall = "repairWallCabinetPlanSeamForVerticalMove({ ...cabinet, mountBottom: nextBottom, mountBottomAdjusted: true }, room, peers, openings)";
	    const repairIndex = source.indexOf(repairCall);
	    expect(repairIndex).toBeGreaterThan(-1);
	    const verticalMoveCallback = source.slice(repairIndex, repairIndex + 2400);
	    expect(verticalMoveCallback).toContain("shouldBlockPlacementCollision(candidate, peers, customPlacementMode, room)");
	    expect(verticalMoveCallback.indexOf(repairCall)).toBeLessThan(
	      verticalMoveCallback.indexOf("shouldBlockPlacementCollision(candidate, peers, customPlacementMode, room)"),
    );
  });

  it("commits horizontal D-pad movement exactly instead of snapping it back to the original seam", () => {
		    const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
		    const callbackStart = source.indexOf("const moveCabinetFrom3D = useCallback");
		    const callbackEnd = source.indexOf("// Clear the override", callbackStart);
		    expect(callbackStart).toBeGreaterThan(-1);
		    expect(callbackEnd).toBeGreaterThan(callbackStart);
		    const callbackSource = source.slice(callbackStart, callbackEnd);
	    expect(callbackSource).toContain("x: roundToEighth(cabinet.x + delta.x)");
	    expect(callbackSource).not.toContain("snapCabinetSeamOverlap(");
	    expect(callbackSource).toContain("cannot move ${direction}; it would extend beyond the room boundary");
	    expect(callbackSource).toContain("shouldBlockPlacementCollision(candidate, peers, customPlacementMode, room)");
	  });

	  it("computes one synchronous host result, advances the live placement ref before rendering, and does not remount the 3D viewer for placement changes", () => {
		    const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
		    const callbackStart = source.indexOf("const moveCabinetFrom3D = useCallback");
		    const callbackEnd = source.indexOf("// Clear the override", callbackStart);
		    expect(callbackEnd).toBeGreaterThan(callbackStart);
		    const callbackSource = source.slice(callbackStart, callbackEnd);
	    expect(callbackSource).toContain(": ThreeDCabinetMoveResult =>");
	    expect(callbackSource).toContain("const prev = placedRef.current;");
	    expect(callbackSource).toContain("placedRef.current = nextPlaced;");
	    expect(callbackSource.indexOf("placedRef.current = nextPlaced;")).toBeLessThan(callbackSource.indexOf("setPlaced(nextPlaced);"));
	    expect(callbackSource).toContain('status: "moved"');
	    expect(callbackSource).toContain('status: "blocked"');
	    expect(callbackSource).toContain("coordinateChange");
	    expect(callbackSource).toContain("X ${formatEighthInches(cabinet.x)} → ${formatEighthInches(candidate.x)}");
	    expect(callbackSource).toContain("Y ${formatEighthInches(cabinet.y)} → ${formatEighthInches(candidate.y)}");
	    expect(source).not.toContain("key={interactive3dRevision}");
	    expect(source).not.toContain("const interactive3dRevision = useMemo");
	  });
});

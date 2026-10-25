import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Design Tool mandatory blind-corner filler transactions", () => {
  it("commits a new blind-corner cabinet and its real catalog filler as one collision-checked state update", () => {
    const start = source.indexOf("const addCabinet = useCallback");
	    const end = source.indexOf("const addManualFiller", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const add = source.slice(start, end);
	    expect(add).toContain("const required = buildRequiredBlindCornerFiller(");
	    for (const argument of ["finalCab", "room", "catalogFillers", "makeUid"]) {
	      expect(add).toContain(argument);
	    }
	    expect(add).toContain("if (!required.ok)");
	    expect(add).toContain("return;");
	    expect(add).toContain("hasCollision(requiredFiller, committedRun)");
	    expect(add).toContain("appendCollisionFreePlacements(committedRun, [requiredFiller])");
	    expect(add).toContain("placedRef.current = committedRun");
	    expect(add).toContain("setPlaced(() => committedRun)");
	    expect(add).toContain("!isBlindCorner(finalCab.masterCode, finalCab.description)");
	  });

  it("removes the old linked filler before a BBC depth/D-pad collision check and rebuilds one filler at the moved position", () => {
    const start = source.indexOf("const moveCabinetFrom3D = useCallback");
    const end = source.indexOf("// Clear the override", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const movement = source.slice(start, end);
    expect(movement).toContain("const requiredFillerGroupId = requiredBlindCornerFillerGroupId(cabinet)");
    expect(movement).toContain("const placedWithoutLinkedFiller = prev.filter");
    expect(movement).toContain("commitThreeDCabinetCandidate(placedWithoutLinkedFiller, uid, candidate)");
    expect(movement).toContain("buildRequiredBlindCornerFiller(");
    expect(movement).toContain("hasCollision(required.filler, withoutPreviousLinkedFiller)");
    expect(movement).toContain("appendCollisionFreePlacements(withoutPreviousLinkedFiller, [required.filler])");
    expect(movement).toContain("placedRef.current = nextPlaced");
	    expect(movement).toContain("setPlaced(nextPlaced)");
	  });

	  it("rebuilds the linked filler during right-drag and does not open the optional filler prompt", () => {
	    const start = source.indexOf("const moveCabinet = useCallback");
	    const end = source.indexOf("const swingSelected", start);
	    expect(start).toBeGreaterThan(-1);
	    expect(end).toBeGreaterThan(start);
	    const movement = source.slice(start, end);
	    expect(movement).toContain("requiredBlindCornerFillerGroupId(cabinet)");
	    expect(movement).toContain("item.fillerPieceGroupId !== requiredFillerGroupId && !refrigeratorMemberUids.has(item.uid)");
	    expect(movement).toContain("buildRequiredBlindCornerFiller(");
	    expect(movement).toContain("appendCollisionFreePlacements(nextPlaced, [required.filler])");
	    expect(movement).toContain("placedRef.current = nextPlaced");
	    expect(movement).toContain("const opportunity = movingBlindCorner ? null : smallGapFillerOpportunityFromDragPreview(uid, preview)");
	  });

	  it("rebuilds the linked filler during keyboard and on-canvas nudge moves", () => {
	    const start = source.indexOf("const nudgeSelected = useCallback");
	    const end = source.indexOf("// Raise/lower the selected WALL cabinet", start);
	    expect(start).toBeGreaterThan(-1);
	    expect(end).toBeGreaterThan(start);
	    const movement = source.slice(start, end);
	    expect(movement).toContain("requiredBlindCornerFillerGroupId(selected)");
	    expect(movement).toContain("item.fillerPieceGroupId !== requiredFillerGroupId && !refrigeratorMemberUids.has(item.uid)");
	    expect(movement).toContain("buildRequiredBlindCornerFiller(");
	    expect(movement).toContain("appendCollisionFreePlacements(nextPlaced, [required.filler])");
	    expect(movement).toContain("placedRef.current = nextPlaced");
	  });

	  it("routes both single-gap and cabinet-plus-filler BBC suggestions through addCabinet's atomic transaction", () => {
	    const start = source.indexOf("const fillGap = useCallback");
	    const end = source.indexOf("const applySmallGapFiller", start);
	    expect(start).toBeGreaterThan(-1);
	    expect(end).toBeGreaterThan(start);
	    const gapFlows = source.slice(start, end);
	    expect(gapFlows.match(/if \(isBlindCorner\(c\.masterCode, c\.description\)\)/g)).toHaveLength(2);
	    expect(gapFlows.match(/addCabinet\(c, .*\.x, .*\.y, false, .*\.rotation, true\)/g)).toHaveLength(2);
	  });

	  it("uses linked BBC assembly removal for selected, canvas, and grouped deletions", () => {
	    expect(source).toContain("const removeCabinetsAndReleaseVoid = useCallback");
	    expect(source).toContain("removeCabinetsAndReleaseVoid([uid])");
	    expect(source).toContain("uids.reduce(");
	    expect(source).toContain("removePlacedCabinetWithRequiredBlindCornerFiller(current, uid)");
	  });
});

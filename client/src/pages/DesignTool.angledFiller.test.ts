import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Design Tool automatic angled front-miter workflow", () => {
  it("resolves source-backed two-piece front miter fillers before the placement transaction commits for every cabinet run", () => {
    const addStart = source.indexOf("const addCabinet = useCallback");
    const measureStart = source.indexOf("const requiredTransition = measuredAngledWallTransition", addStart);
    const fillerStart = source.indexOf("const angledFiller = automaticAngledWallFiller", measureStart);
    const commitStart = source.indexOf("placedRef.current = committedRun;", fillerStart);

    expect(measureStart).toBeGreaterThan(addStart);
    expect(fillerStart).toBeGreaterThan(measureStart);
    expect(fillerStart).toBeLessThan(commitStart);
    const workflow = source.slice(measureStart, commitStart);
    expect(source.slice(addStart, measureStart)).toContain('finalCab.placement === "wall" || finalCab.placement === "base" || finalCab.placement === "tall"');
    expect(workflow).toContain("catalogFillers");
    expect(workflow).toContain("angledFiller.fillers.map");
	    expect(workflow).toContain("appendCollisionFreePlacements(withoutProvisionalCornerFillers, angledFiller.fillers, room)");
    expect(workflow).toContain("angledFiller.fillers.every");
    expect(workflow).toContain("setFillerInsertionTransition({ uids: angledFiller.fillers.map");
    expect(workflow).toContain("front filler A");
    expect(workflow).toContain("and B");
    expect(workflow).toContain("each cut at 22.5° to form one tight 45° turn");
    expect(workflow).toContain("both cabinets remain independently supported");
  });

	  it("keeps the cabinet transaction active and flags, rather than drops, a filler piece with a missing price", () => {
	    const workflowStart = source.indexOf("const requiredTransition = measuredAngledWallTransition");
	    const workflow = source.slice(workflowStart, workflowStart + 3000);
	    expect(workflow).not.toContain("requiredTransition && !angledFiller");
	    expect(workflow).not.toContain("front 45° filler cuts were not added");
	    expect(workflow).toContain("const sourcePrices = angledFiller.fillers.map");
	    expect(workflow).toContain("sourcePrices.every");
	    expect(workflow).toContain("filler boards were added to close the 45° turn");
	    expect(workflow).toContain("checkout is blocked until the catalog price is supplied");
	    expect(workflow).not.toContain("makeFiller(");
	    expect(workflow).not.toContain('masterCode: "FILL');
	  });

  it("repairs every physical 45-degree turn after filler-catalog hydration without waiting for price data", () => {
	    expect(source).toContain("catalogFillers.filter(isCatalogFiller).forEach");
	    expect(source).toContain("repairMissingAngledWallFillers(");
	    expect(source).toContain("if (catalogFillers.length === 0) return;");
	    expect(source).not.toContain("if (!styleId || !priceRows || catalogFillers.length === 0) return;");
	    expect(source).toContain("placedRef.current = repaired.placed;");
	    expect(source).toContain("setFillerInsertionTransition({ uids: repaired.added.map");
	    expect(source).toContain("Every physical 45-degree cabinet turn must close with its two finished");
	    expect(source).toContain("The open 45° cabinet front was closed with two catalog filler boards joined on one continuous miter.");
	    expect(source).toContain("explicit Part 1 flag and checkout block—not a reason to leave a physical");
	    expect(source).toContain("[catalogFillers, room, styleId, placed]");
  });

  it("keeps both physical miter boards on the invoice with their real per-board cut note", () => {
    expect(source).toContain('const miterCutNote = p.fillerTransitionKind === "front-miter-pair"');
    expect(source).toContain('Mitered ${p.fillerMiterAngle ?? 22.5}° (forms 45° turn)');
	    expect(source).toContain('fillerInstallNote, miterCutNote, attrNote]');
  });
});

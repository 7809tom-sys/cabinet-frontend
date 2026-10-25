import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(__dirname, "DesignTool.tsx"), "utf8");

describe("DesignTool island countertop lifecycle", () => {
	  it("synchronizes the island countertop state inside the shared cabinet-removal helper", () => {
	    const start = source.indexOf("const removeCabinetsAndReleaseVoid = useCallback");
	    const end = source.indexOf("const removeCabinetAndReleaseVoid", start);
	    const handler = source.slice(start, end);

	    expect(handler).toContain("synchronizeIslandCountertopFootprint(island, committed, next)");
	    expect(handler).toContain("if (nextIsland && nextIsland !== island) setIsland(nextIsland);");
	    expect(handler).toContain("placedRef.current = next;");
	  });

	  it("synchronizes countertop coverage as soon as an island cabinet is committed", () => {
	    const start = source.indexOf("// ── Now do all state updates and side effects exactly once");
	    const end = source.indexOf("// Farmhouse bases use", start);
	    const placement = source.slice(start, end);

	    expect(placement).toContain("synchronizeIslandCountertopFootprint(islandBeforePlacement, islandPlacementPrevious, committedRun)");
	    expect(placement).toContain("if (requestedIslandFace && bearsIslandCountertop(finalCab)) setCountertop(true);");
	  });

	  it("keeps the full-run Back continuation direct instead of opening a countertop prompt", () => {
	    const start = source.indexOf("const placeOnRecommendedIslandFace = useCallback");
	    const end = source.indexOf("const replaceUpperWithRangeHood", start);
	    const handler = source.slice(start, end);

	    expect(handler).toContain("setPlacementTarget(\"island\", recommendation.face);");
	    expect(handler).not.toContain("setIslandAttributesOpen(true)");
	  });

  it("uses that same lifecycle helper when Materials & Parts removes island cabinets", () => {
    const materialsStart = source.indexOf("<DesignMaterialsListDialog");
    const materials = source.slice(materialsStart, source.indexOf("{/* Rename design dialog", materialsStart));

    expect(materials).toContain("removeCabinetsAndReleaseVoid(Array.from(sources), true);");
    expect(materials).not.toContain("for (const uid of Array.from(sources)) next = removePlacedCabinetGroup(next, uid);");
  });
});

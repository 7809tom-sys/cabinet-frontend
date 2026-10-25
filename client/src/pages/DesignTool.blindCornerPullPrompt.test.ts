import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Design Tool blind-corner pull prompt", () => {
  it("asks for a valid pull before placing a configured base blind corner rather than silently committing the six-inch default", () => {
    const start = source.indexOf("const addCabinet = useCallback");
    const end = source.indexOf("const addManualFiller", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const add = source.slice(start, end);

    expect(add).toContain("setBlindCornerPullPrompt");
    expect(add).toContain("isBaseBlindCorner(c)");
    expect(add).toContain("blindPullOverride");
    expect(add).toContain("blindCornerPullPlacement");
    expect(add).toContain("newCab.blindPull = requestedPull");
  });

  it("renders an accessible modal with the measured pull request and an explicit no-placement cancel action", () => {
    expect(source).toContain('data-testid="blind-corner-pull-dialog"');
    expect(source).toContain("How far should this blind corner pull from the wall?");
    expect(source).toContain('data-testid="blind-corner-pull-input"');
    expect(source).toContain("Cancel placement");
    expect(source).toContain("Place blind corner");
  });

	  it("does not expose or mutate the BBC pull controls for wall blind cabinets", () => {
	    expect(source).toContain("{isBaseBlindCorner(selectedCab) && (() => {");
	    expect(source).toContain("if (!cabinet || !isBaseBlindCorner(cabinet)) return;");
	    expect(source).toContain("if (!selected || !isBaseBlindCorner(selected)) return;");
	  });

	  it("recovers a base BBC at an adjacent filler seam only after applying the selected pull and only while automatic snapping is enabled", () => {
	    const start = source.indexOf("// Blind corner: auto-position and auto-swing");
	    const end = source.indexOf("const validMountedMicrowavePair", start);
	    expect(start).toBeGreaterThan(-1);
	    expect(end).toBeGreaterThan(start);
	    const add = source.slice(start, end);

	    expect(add).toContain("resolveBaseBlindCornerFillerSnap(finalCab, room, normalizedPrevious, openings)");
	    expect(add).toContain("automaticSnapping && !requestedIslandFace && isBaseBlindCorner(finalCab)");
	    expect(add).toContain("keeping its selected");
	  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");

describe("InteractiveRoom3D manual filler action", () => {
  it("places Add filler beside the selected cabinet actions and delegates to the host workflow", () => {
    expect(source).toContain("onRequestFiller?: (uid: string) => void");
    expect(source).toContain('data-testid="three-d-add-filler"');
    expect(source).toContain("onRequestFiller(selectedCabinet.uid!)");
    expect(source).toContain("Add filler</button>");
  });

	  it("offers the manual action for eligible wall and island cabinets but not fitted filler pieces", () => {
	    expect(source).not.toContain("!selectedPlacedCabinet.islandFace &&");
	    expect(source).toContain("!fittedFillerWidthText");
	    expect(source).toContain('["base", "wall", "tall"].includes(selectedPlacedCabinet.placement)');
	  });

	  it("shows clear edit and removal controls after a filler has been installed", () => {
	    expect(source).toContain('data-testid="three-d-edit-filler"');
	    expect(source).toContain('fittedFillerWidthText ? "Remove filler" : "Remove"');
	  });
});

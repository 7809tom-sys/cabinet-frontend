import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Farm Sink Base Sink Selection Guide", () => {
  it("routes a Farm Sink Base to the selected-base apron-front guide instead of the generic chooser", () => {
    expect(source).toContain("if (isFarmSinkBasePaletteItem(finalCab))");
    expect(source).toContain('setSinkBaseDialog(null);');
    expect(source).toContain("Farm Sink Base added. Choose a verified apron-front sink from the Sink Selection Guide in the side panel.");
    expect(source).toContain("<FarmhouseSinkSelectionGuide");
    expect(source).toContain("openingWidthIn={sinkBaseOpeningWidthIn(selectedCab)}");
  });

  it("keeps the standard Sink / Range Top chooser and standard sink picker for regular sink bases", () => {
    expect(source).toMatch(/if \(isFarmSinkBasePaletteItem\(finalCab\)\) \{[\s\S]*?setSinkBaseDialog\(null\);[\s\S]*?\} else \{[\s\S]*?setSinkBaseDialog\(\{ cabinetUid: finalCab\.uid \}\);/);
    expect(source).toContain("<PelicanSinkPicker");
    expect(source).toContain("{selectedCab && isFarmSinkBasePaletteItem(selectedCab) ? (");
  });
});

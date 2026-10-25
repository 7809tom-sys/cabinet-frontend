import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Design Tool configured wall-blind filler", () => {
  it("carries Cabinet Config's fillerRequired field into the placed WBC record", () => {
    expect(source).toContain("fillerRequired: c.fillerRequired ?? false");
  });

  it("adds a configured WBC’s integrated 3-inch catalog filler on add and on both move paths", () => {
    expect(source).toContain("requiresConfiguredBlindCornerFiller(finalCab)");
    expect(source).toContain("requiresConfiguredBlindCornerFiller(movedCabinet)");
    expect(source).toContain("requiresConfiguredBlindCornerFiller(candidate)");
  });

  it("keeps BBC-only pull behavior separate from the WBC filler requirement", () => {
    expect(source).toContain("isBaseBlindCorner(c)");
    expect(source).toContain("isBaseBlindCorner(selectedCab)");
  });
});

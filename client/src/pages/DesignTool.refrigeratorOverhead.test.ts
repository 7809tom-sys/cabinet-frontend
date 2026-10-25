import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("refrigerator-overhead recommendation route", () => {
  it("opens an approval dialog for an ordinary wall cabinet above a refrigerator and preserves it until Apply", () => {
    expect(source).toContain("unsuitableWallCabinetAboveRefrigerator");
    expect(source).toContain("replaceCabinetUid: finalCab.uid");
    expect(source).toContain("item.uid !== refrigeratorCabinetToReplace?.uid");
    expect(source).toContain("replacementCabinetCode={refrigeratorCabinetToReplace?.masterCode ?? null}");
  });

  it("uses the dedicated 12-inch upper mount helper and leaves refrigerator surround elevation to its dedicated normalizer", () => {
    expect(source).toContain('...(accPlacement === "wall" ? { mountBottom: ordinaryWallMountBottom({ ...c, placement: accPlacement, height }) } : {}),');
    expect(source).toContain("normalizeRefrigeratorBayUppers(previewResult.placed, room)");
    expect(source).toContain("normalizeStandardWallMounts(");
    expect(source).not.toContain("const runMountBottom = adjoiningWallRunMountBottom");
  });
});

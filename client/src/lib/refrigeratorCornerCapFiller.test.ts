import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, fitExplicitRefrigeratorOptionPlacements, refrigeratorBayRunMetrics, wallPlacementAt, wallPlacementAtUnbounded, wallRunOffset, wallRunSpan, type PlacedCabinet, type WallSide } from "@/lib/design";

const room = { ...DEFAULT_ROOM, width: 120, depth: 120 };

/** Builds the refrigerator options the way DesignTool does, with exact or clamped parts. */
function corner(side: WallSide, fridgeAlong: number, exact: boolean) {
  const place = (along: number, width: number, depth: number, unbounded: boolean) =>
    (unbounded ? wallPlacementAtUnbounded : wallPlacementAt)(along, width, depth, side, room);
  const item = (base: Partial<PlacedCabinet>, along: number, width: number, depth: number, unbounded: boolean): PlacedCabinet => {
    const spot = place(along, width, depth, unbounded);
    return { uid: "x", cabinetId: 1, masterCode: "X", description: "", placement: "base", height: 34.5, ...base, ...spot, width, depth } as PlacedCabinet;
  };
  const fridge = item({ uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator", placement: "appliance", height: 70 }, fridgeAlong, 36, 30, false);
  const bay = refrigeratorBayRunMetrics(fridge, room);
  const each = (bay.openingWidth - 36) / 2;
  const assembly = { refrigeratorAssemblyId: "fridge" };
  const additions = [
    item({ ...assembly, uid: "bridge", masterCode: "W362424", description: "Wall", placement: "wall", height: 24, mountBottom: 72, refrigeratorAssemblyRole: "bridge" }, bay.refrigeratorCenter - 18, 36, 24, exact),
    item({ ...assembly, uid: "left-filler", masterCode: "F342", description: "Filler", category: "Filler", placement: "wall", height: 24, mountBottom: 72, refrigeratorAssemblyRole: "bridge-left-filler", fillerForCabinetUid: "bridge" }, bay.openingStart, each, 24, exact),
    item({ ...assembly, uid: "right-filler", masterCode: "F342", description: "Filler", category: "Filler", placement: "wall", height: 24, mountBottom: 72, refrigeratorAssemblyRole: "bridge-right-filler", fillerForCabinetUid: "bridge" }, bay.openingEnd - each, each, 24, exact),
    item({ ...assembly, uid: "left-panel", masterCode: "S2496", description: "Refrigerator End Panel", customProfile: "refrigerator-end-panel", placement: "tall", height: 96, refrigeratorAssemblyRole: "left-panel" }, bay.openingStart - 0.75, 0.75, 24, true),
    item({ ...assembly, uid: "right-panel", masterCode: "S2496", description: "Refrigerator End Panel", customProfile: "refrigerator-end-panel", placement: "tall", height: 96, refrigeratorAssemblyRole: "right-panel" }, bay.openingEnd, 0.75, 24, true),
  ];
  const fitted = fitExplicitRefrigeratorOptionPlacements([fridge], additions, "fridge", room);
  const at = (uid: string) => {
    const part = [...fitted.existing, ...fitted.additions].find((p) => p.uid === uid)!;
    const start = wallRunOffset(part, side, room);
    return [start, start + wallRunSpan(part, side, room)];
  };
  return {
    shiftIn: fitted.shiftIn,
    seams: [
      at("left-filler")[0] - at("left-panel")[1],
      at("bridge")[0] - at("left-filler")[1],
      at("right-filler")[0] - at("bridge")[1],
      at("right-panel")[0] - at("right-filler")[1],
    ],
    leftPanelStart: at("left-panel")[0],
  };
}

describe("refrigerator options in a corner", () => {
  for (const side of ["bottom", "top", "left", "right"] as WallSide[]) {
    it(`closes every seam after shifting a corner refrigerator out of the ${side} wall end`, () => {
      const result = corner(side, 0, true);
      expect(result.shiftIn).toBeCloseTo(1.25, 6);
      expect(result.leftPanelStart).toBeCloseTo(0, 6);
      for (const seam of result.seams) expect(seam).toBeCloseTo(0, 6);
    });
  }

  it("reproduces the old corner-side gap when the cap filler was clamped before the shift", () => {
    const old = corner("bottom", 0, false);
    expect(Math.max(...old.seams.map(Math.abs))).toBeGreaterThan(0.1);
  });

  it("places the wall fridge cabinet and cap fillers unclamped in DesignTool", () => {
    const source = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(source).toContain("const spot = wallPlacementAtUnbounded(along, aWidth, aDepth, side, room);");
    expect(source).toContain("const fillerSpot = wallPlacementAtUnbounded(along, eachFillerWidth, aDepth, side, room);");
  });
});

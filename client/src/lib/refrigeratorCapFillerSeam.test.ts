import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, commitConfiguredRefrigeratorCandidate, refrigeratorBayRunMetrics, wallPlacementAt, wallPlacementAtUnbounded, wallRunOffset, wallRunSpan, type PlacedCabinet, type WallSide } from "@/lib/design";

const room = { ...DEFAULT_ROOM, width: 144, depth: 120 };
const side: WallSide = "top";

function seat(base: Partial<PlacedCabinet>, along: number, width: number, depth: number): PlacedCabinet {
  const spot = wallPlacementAtUnbounded(along, width, depth, side, room);
  return { uid: "x", cabinetId: 1, masterCode: "X", description: "", placement: "base", height: 34.5, ...base, x: spot.x, y: spot.y, rotation: spot.rotation, width, depth } as PlacedCabinet;
}
const run = (item: PlacedCabinet) => {
  const start = wallRunOffset(item, side, room);
  return [start, start + wallRunSpan(item, side, room)];
};

/** A "36-inch" refrigerator whose source width is 35 7/8, under a W362424. */
function bay(fridgeAlong: number) {
  const fridge = seat({ uid: "fridge", masterCode: "FRIDGE-36", description: "Refrigerator", placement: "appliance", height: 70 }, fridgeAlong, 35.875, 30);
  const metrics = refrigeratorBayRunMetrics(fridge, room);
  const cabinetAlong = metrics.refrigeratorCenter - 18;
  const each = (metrics.openingWidth - 36) / 2;
  const assembly = { refrigeratorAssemblyId: "fridge" };
  return {
    fridge,
    metrics,
    each,
    parts: [
      fridge,
      seat({ ...assembly, uid: "bridge", masterCode: "W362424", description: "Wall", placement: "wall", height: 24, mountBottom: 72, refrigeratorAssemblyRole: "bridge" }, cabinetAlong, 36, 24),
      seat({ ...assembly, uid: "left-panel", masterCode: "S2496", description: "Refrigerator End Panel", placement: "tall", height: 96, refrigeratorAssemblyRole: "left-panel" }, metrics.openingStart - 0.75, 0.75, 24),
      seat({ ...assembly, uid: "right-panel", masterCode: "S2496", description: "Refrigerator End Panel", placement: "tall", height: 96, refrigeratorAssemblyRole: "right-panel" }, metrics.openingEnd, 0.75, 24),
      seat({ ...assembly, uid: "left-filler", masterCode: "F342", description: "Filler", category: "Filler", placement: "wall", height: 24, mountBottom: 72, refrigeratorAssemblyRole: "bridge-left-filler", fillerForCabinetUid: "bridge" }, metrics.openingStart, each, 24),
      // Same rule as DesignTool: the right cap filler ends at the opening edge.
      seat({ ...assembly, uid: "right-filler", masterCode: "F342", description: "Filler", category: "Filler", placement: "wall", height: 24, mountBottom: 72, refrigeratorAssemblyRole: "bridge-right-filler", fillerForCabinetUid: "bridge" }, metrics.openingEnd - each, each, 24),
    ],
  };
}

function expectClosedSeams(parts: PlacedCabinet[]) {
  const at = (uid: string) => run(parts.find((item) => item.uid === uid)!);
  expect(at("left-filler")[0]).toBeCloseTo(at("left-panel")[1], 6);
  expect(at("bridge")[0]).toBeCloseTo(at("left-filler")[1], 6);
  expect(at("right-filler")[0]).toBeCloseTo(at("bridge")[1], 6);
  expect(at("right-panel")[0]).toBeCloseTo(at("right-filler")[1], 6);
}

describe("refrigerator cap fillers with a refrigerator narrower than its cabinet", () => {
  it("closes both seams when the cabinet overhangs a 35 7/8-inch refrigerator", () => {
    const { parts, each } = bay(40);
    expect(each).toBeCloseTo(0.4375, 6);
    expectClosedSeams(parts);
  });

  it("keeps both seams closed after the refrigerator is moved", () => {
    const { parts } = bay(40);
    const fridge = parts[0];
    const moved = { ...fridge, ...wallPlacementAt(60, 35.875, 30, side, room) };
    const result = commitConfiguredRefrigeratorCandidate(parts, fridge.uid, moved, room);
    expect(result).not.toBeNull();
    expectClosedSeams(result!);
  });

  it("anchors the new right cap filler to the opening edge in DesignTool", () => {
    const source = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(source).toContain('addCapFiller("bridge-right-filler", bay.openingEnd - eachFillerWidth);');
    expect(source).not.toContain('addCapFiller("bridge-right-filler", bay.refrigeratorEnd);');
  });
});

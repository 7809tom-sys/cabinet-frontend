/**
 * Guard for the vendored `main` snapshot used by the before/after screenshots.
 *
 * `client/src/lib/legacyMain/` is a verbatim copy of `design.ts` and
 * `freestandingRun.ts` as they stand on `main` (commit 2188466), with only their
 * relative imports rewritten. It exists so the BEFORE half of
 * `e2e/issue353-before-after.spec.ts` runs REAL main code instead of a
 * hand-written stand-in.
 *
 * This test is what keeps that honest: it feeds Tom's exact layout to both the
 * snapshot and the branch, and asserts the snapshot still reproduces the bug the
 * reviewer measured — two slabs across the L, a real gap, and no mitre.
 */
import { describe, expect, it } from "vitest";
import { countertopSurfaces as branchCountertops } from "./design";
import {
  countertopSurfaces as mainCountertops,
  countertopSurfacePlanPolygon as mainPolygon,
  wallPlacementAt as mainWallPlacementAt,
  type PlacedCabinet as MainPlacedCabinet,
  type RoomData as MainRoomData,
} from "./legacyMain/design";
import { DEFAULT_ROOM } from "./design";

const ROOM = { ...DEFAULT_ROOM, width: 204, depth: 168, ceilingHeight: 96 } as MainRoomData;

function mainBase(uid: string, offset: number, width: number): MainPlacedCabinet {
  const spot = mainWallPlacementAt(offset, width, 24, "top", ROOM);
  return {
    uid, cabinetId: 1, masterCode: `B${width}`, description: `B${width}`, category: "Base",
    subCategory: "Standard Base", placement: "base", ...spot,
    width, depth: 24, height: 34.5, rotation: spot.rotation, wallId: "top", wallOffset: offset,
    numberOfDoors: 2, numberOfDrawers: 0,
  } as MainPlacedCabinet;
}

function mainAngled(uid: string, vertex: { x: number; y: number }, width: number): MainPlacedCabinet {
  const radians = Math.PI / 4;
  const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
  const forward = { x: -Math.sin(radians), y: Math.cos(radians) };
  const backLeft = { x: vertex.x + tangent.x * 11, y: vertex.y + tangent.y * 11 };
  const center = {
    x: backLeft.x + tangent.x * (width / 2) + forward.x * 12,
    y: backLeft.y + tangent.y * (width / 2) + forward.y * 12,
  };
  const bound = Math.abs(width * Math.cos(radians)) + Math.abs(24 * Math.sin(radians));
  return {
    uid, cabinetId: 2, masterCode: `B${width}`, description: `B${width}`, category: "Base",
    subCategory: "Standard Base", placement: "base",
    x: center.x - bound / 2, y: center.y - bound / 2,
    width, depth: 24, height: 34.5, rotation: 45,
    numberOfDoors: 2, numberOfDrawers: 0,
  } as MainPlacedCabinet;
}

const layout = () => [
  mainBase("w0", 0, 24),
  mainBase("w1", 24, 30),
  mainBase("w2", 54, 36),
  mainBase("w3", 90, 30),
  mainAngled("a0", { x: 131, y: 0 }, 36),
];

describe("the vendored main snapshot still reproduces issue 353 on main", () => {
  it("gives the angled leg its own slab, with a gap and no mitre", () => {
    const surfaces = mainCountertops(layout() as never, ROOM as never);
    expect(surfaces).toHaveLength(2);
    expect(surfaces.every((surface) => !surface.miteredStart && !surface.miteredEnd)).toBe(true);

    // The two pieces are separate outlines that share no edge: that is what
    // "two slabs with a gap" means, and it is the bug the branch fixes.
    const polygons = surfaces.map((surface) => mainPolygon(surface));
    const shareEdge = polygons[0]!.some((start, index) => {
      const end = polygons[0]![(index + 1) % polygons[0]!.length]!;
      return polygons[1]!.some((otherStart, otherIndex) => {
        const otherEnd = polygons[1]![(otherIndex + 1) % polygons[1]!.length]!;
        return Math.hypot(start.x - otherEnd.x, start.y - otherEnd.y) < 1e-6
          && Math.hypot(end.x - otherStart.x, end.y - otherStart.y) < 1e-6;
      });
    });
    expect(shareEdge).toBe(false);
    // The angled slab is the axis-aligned box of the rotated body plus the
    // finished front edge, so it is wider than the body's own 33.94-inch AABB.
    const angled = polygons[1]!;
    const width = Math.max(...angled.map((point) => point.x)) - Math.min(...angled.map((point) => point.x));
    expect(width).toBeGreaterThan(24 * Math.SQRT2);
  });

  it("is a genuinely different code path from the branch", () => {
    const main = mainCountertops(layout() as never, ROOM as never);
    const branch = branchCountertops(layout() as never, ROOM as never);
    expect(main).toHaveLength(2);
    // The branch builds the whole L as one mitered chain.
    expect(branch.length).toBeGreaterThan(0);
    expect(branch.every((surface) => surface.freestandingMemberUids?.length)).toBe(true);
  });
});

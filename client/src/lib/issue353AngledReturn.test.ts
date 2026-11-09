/**
 * Issue 353, reviewer round 2 (Tom, Nov 9 2026).
 *
 * The reviewer's mixed case: the regular designer seats its straight bases on
 * the back wall and then drops the angled 45-degree return beside them. Before
 * this fix that produced two independent tops with a gap and no miter, and the
 * two-piece 45-degree front filler was never measured, because:
 *   - `snapFreestandingFortyFive` only snaps onto other FREE-STANDING bases, and
 *   - `measuredAngledWallTransition` needs two cabinets that share a drawn wall
 *     vertex, which a cardinal wall and a loose body never do.
 *
 * Every case here is built from the real designer functions, not a mock.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM,
  countertopSurfaces,
  countertopSurfacePlanPolygon,
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { isAngledReturnCabinet, participatesInFreestandingChain } from "./freestandingRun";
import { measuredAngledWallTransition, repairMissingAngledWallFillers } from "./angledWallFiller";

const ROOM: RoomData = { ...DEFAULT_ROOM, width: 192, depth: 168, ceilingHeight: 96 };

function wallBase(uid: string, offset: number, width = 24): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", ROOM);
  return {
    uid,
    cabinetId: 1,
    masterCode: `B${width}`,
    description: "Base",
    category: "Base",
    subCategory: "Standard Base",
    placement: "base",
    ...spot,
    width,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    wallId: "top",
    wallOffset: offset,
    numberOfDoors: 2,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}

/** A loose 45-degree cabinet whose AABB is the rotated body's own envelope. */
function angledCabinet(uid: string, center: { x: number; y: number }, rotation = 45, width = 24): PlacedCabinet {
  const radians = (rotation * Math.PI) / 180;
  const boundWidth = Math.abs(width * Math.cos(radians)) + Math.abs(24 * Math.sin(radians));
  const boundDepth = Math.abs(width * Math.sin(radians)) + Math.abs(24 * Math.cos(radians));
  return {
    uid,
    cabinetId: 2,
    masterCode: `B${width}`,
    description: "Base",
    category: "Base",
    subCategory: "Standard Base",
    placement: "base",
    x: center.x - boundWidth / 2,
    y: center.y - boundDepth / 2,
    width,
    depth: 24,
    height: 34.5,
    rotation,
  } as PlacedCabinet;
}

/**
 * Tom's layout: a back-wall run whose last cabinet ends at 72 inches, then the
 * angled leg seated at the Wall Builder's 11-inch inside-corner hold from the
 * shared corner.
 */
function tomLayout() {
  const run = [wallBase("w0", 0), wallBase("w1", 24), wallBase("w2", 48)];
  const vertex = { x: 72 + 11, y: 0 };
  const tangent = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  const forward = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
  const backLeft = { x: vertex.x + tangent.x * 11, y: vertex.y + tangent.y * 11 };
  const center = {
    x: backLeft.x + tangent.x * 12 + forward.x * 12,
    y: backLeft.y + tangent.y * 12 + forward.y * 12,
  };
  return { run, angled: angledCabinet("a0", center), vertex };
}

const fillerStock = [
  { id: 601, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: "3", depth: "24", height: "34.5", placement: "base" },
] as never[];

const roundAll = (points: { x: number; y: number }[]) =>
  points.map((point) => [Math.round(point.x * 100) / 100, Math.round(point.y * 100) / 100] as const);

function polygonArea(points: { x: number; y: number }[]) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

describe("outcome 3: a wall-attached run plus its 45-degree return is ONE top", () => {
  it("recognises the angled leg of a wall run as a chain participant", () => {
    const { angled } = tomLayout();
    expect(isAngledReturnCabinet(angled)).toBe(true);
    expect(participatesInFreestandingChain(angled, ROOM, null)).toBe(true);
    // A square box is never promoted.
    expect(isAngledReturnCabinet(wallBase("sq", 0))).toBe(false);
  });

  it("builds one continuous mitered top instead of two slabs with a gap", () => {
    const { run, angled } = tomLayout();
    const surfaces = countertopSurfaces([...run, angled], ROOM)
      .filter((surface) => !surface.raisedBar && !surface.peninsulaRunId);

    // No square slab of its own for the angled cabinet, and no stray duplicates.
    const polygons = surfaces.map((surface) => countertopSurfacePlanPolygon(surface));
    expect(surfaces.length).toBeGreaterThan(0);
    for (const surface of surfaces) {
      expect(surface.freestandingMemberUids?.slice().sort()).toEqual(["a0", "w0", "w1", "w2"]);
    }

    // The run's leg and the angled leg share one mitered seam: two polygons share
    // an exact edge, which is what "continuous, not two slabs" means.
    const shared = polygons.some((first, firstIndex) => {
      const rest = polygons.filter((_, index) => index !== firstIndex);
      return first.some((start, index) => {
        const end = first[(index + 1) % first.length]!;
        return rest.some((other) => other.some((otherStart, otherIndex) => {
          const otherEnd = other[(otherIndex + 1) % other.length]!;
          return Math.hypot(start.x - otherEnd.x, start.y - otherEnd.y) < 1e-6
            && Math.hypot(end.x - otherStart.x, end.y - otherStart.y) < 1e-6;
        }));
      });
    });
    expect(shared).toBe(true);

    // Nothing in the old 6.9-inch gap between the run end (72) and the angled
    // slab's near edge (78.9) is left uncovered.
    const covered = (point: { x: number; y: number }) => polygons.some((polygon) => {
      let inside = false;
      for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
        const a = polygon[index]!;
        const b = polygon[previous]!;
        if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
      }
      return inside;
    });
    for (const x of [73, 74.5, 76, 77.5]) {
      expect(covered({ x, y: 8 }), `gap at x=${x}`).toBe(true);
    }
  });

  it("places the two-piece 45-degree front filler at that corner", () => {
    const { run, angled } = tomLayout();
    // The measured-wall path genuinely cannot see this joint.
    expect(measuredAngledWallTransition(run[2]!, ROOM, [...run, angled])).toBeNull();

    let uid = 0;
    const repaired = repairMissingAngledWallFillers([...run, angled], ROOM, fillerStock, () => `f${++uid}`, null);
    expect(repaired.added).toHaveLength(2);
    const [first, second] = repaired.added;
    for (const filler of [first!, second!]) {
      expect(filler.fillerTransitionKind).toBe("front-miter-pair");
      expect(filler.fillerMiterAngle).toBe(22.5);
      expect(filler.fillerTransitionPlanFootprint?.length).toBeGreaterThanOrEqual(3);
      // A real, priced board from the line's own stock.
      expect(filler.cabinetId).toBe(601);
      expect(filler.masterCode).toBe("BF3");
    }
    // The pair is one physical assembly: two pieces of one group, meeting at the
    // 45-degree miter, each owned by one of the two cabinets.
    expect(first!.fillerPieceGroupId).toBe(second!.fillerPieceGroupId);
    expect(new Set([first!.fillerForCabinetUid, second!.fillerForCabinetUid])).toEqual(new Set(["w2", "a0"]));
    expect(first!.fillerMiteredEnd).not.toBe(second!.fillerMiteredEnd);

    // The boards are inside the corner, joining the two fronts.
    const vertex = { x: 83, y: 0 };
    for (const filler of repaired.added) {
      const near = Math.min(...(filler.fillerTransitionPlanFootprint ?? []).map((point) => Math.hypot(point.x - vertex.x, point.y - vertex.y)));
      expect(near).toBeLessThan(30);
    }
    expect(polygonArea(first!.fillerTransitionPlanFootprint ?? [])).toBeGreaterThan(0);
    expect(roundAll(first!.fillerTransitionPlanFootprint ?? []).length).toBeGreaterThan(0);
  });

  it("is idempotent: a repaired plan gets no second pair", () => {
    const { run, angled } = tomLayout();
    let uid = 0;
    const first = repairMissingAngledWallFillers([...run, angled], ROOM, fillerStock, () => `f${++uid}`, null);
    const again = repairMissingAngledWallFillers(first.placed, ROOM, fillerStock, () => `g${++uid}`, null);
    expect(again.added).toEqual([]);
    expect(again.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair")).toHaveLength(2);
  });
});

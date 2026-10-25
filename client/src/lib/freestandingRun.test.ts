import { describe, expect, it } from "vitest";
import { cabinetPlanBodiesIntersect, countertopSurfaces, countertopSurfacePlanPolygon, removeOverlappingPlacements, wallPlacementAt, type PlacedCabinet, type RoomData } from "@/lib/design";
import { appendWallBuilderSegment, wallBuilderRoomGeometry } from "@/lib/polygonRoom";
import {
  freestandingChains,
  freestandingBody,
  freestandingBodyCorners,
  snapFreestandingFortyFive,
} from "@/lib/freestandingRun";

const room: RoomData = { width: 192, depth: 144, ceilingHeight: 96 };

function base(uid: string, x: number, y: number, rotation = 0): PlacedCabinet {
  return {
    uid,
    cabinetId: 1,
    masterCode: "B24",
    description: "24\" Base",
    placement: "base",
    x,
    y,
    width: 24,
    depth: 24,
    height: 34.5,
    rotation,
  } as PlacedCabinet;
}

function pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const intersects = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

describe("free-standing run countertop (Continuous Wall Builder rule)", () => {
  it("three touching bases in the open room share ONE slab and nothing lands on the wall", () => {
    const placed = [base("a", 40, 70), base("b", 64, 70), base("c", 88, 70)];
    const surfaces = countertopSurfaces(placed, room, null);
    expect(surfaces).toHaveLength(1);
    const slab = surfaces[0]!;
    expect(slab.freestandingMemberUids?.sort()).toEqual(["a", "b", "c"]);
    // Covers the whole run, 25.5 deep (24 + 1.5 front overhang), starting at the back of the cabinets.
    expect(slab.x).toBeCloseTo(40, 3);
    expect(slab.width).toBeCloseTo(72, 3);
    expect(slab.y).toBeCloseTo(70, 3);
    expect(slab.depth).toBeCloseTo(25.5, 3);
    expect(slab.linearInches).toBeCloseTo(72, 3);
  });

  it("a 45° cabinet dropped at the end of the run is seated and topped by the Continuous Wall Builder's code (parity)", () => {
    const straight = [base("a", 40, 70), base("b", 64, 70), base("c", 88, 70)];
    // Drop the angled cabinet roughly past the end; the Wall Builder seat (11" inside-corner hold) takes over.
    const loose = base("d", 118, 76, 45);
    const snap = snapFreestandingFortyFive(loose, straight, room, null, 12);
    expect(snap).not.toBeNull();
    const angled = { ...loose, x: snap!.x, y: snap!.y };
    const placed = [...straight, angled];

    // Survives the load-time collision sweep.
    const restored = removeOverlappingPlacements(placed, room);
    expect(restored.rejected).toEqual([]);

    // One chain of four.
    const chains = freestandingChains(placed, room, null);
    expect(chains).toHaveLength(1);
    expect(chains[0]!.map((body) => body.cabinet.uid)).toEqual(["a", "b", "c", "d"]);

    // --- Reference: the SAME run on a real Continuous Wall Builder room -----------------
    // Wall 1: 83" straight (72" of cabinets + 11" hold), then a right 45° turn of 35" (11" hold + 24").
    const reference = wallBuilderRoomGeometry(
      appendWallBuilderSegment(appendWallBuilderSegment([], 83, "start"), 35, "right45"),
      96,
    ).room!;
    const [w0, w1] = reference.customWalls;
    const refRoom: RoomData = { ...room, vertices: reference.vertices, customWalls: reference.customWalls, openWallPath: reference.openWallPath };
    const seat = (uid: string, wallId: string, along: number) => {
      const spot = wallPlacementAt(along, 24, 24, wallId as never, refRoom, null, false);
      return { ...base(uid, 0, 0), x: spot.x, y: spot.y, rotation: spot.rotation, wallId: spot.wallId, wallOffset: spot.wallOffset };
    };
    const refPlaced = [seat("a", w0!.id, 0), seat("b", w0!.id, 24), seat("c", w0!.id, 48), seat("d", w1!.id, 11)];
    const refSurfaces = countertopSurfaces(refPlaced, refRoom, null);

    // --- Designer: free-standing chain ------------------------------------------------
    const surfaces = countertopSurfaces(placed, room, null);
    expect(surfaces.length).toBe(refSurfaces.length);
    expect(surfaces.length).toBeGreaterThan(0);

    // Translate the reference (its origin is the first wall start) onto the Designer chain and compare polygons.
    const refOrigin = { x: reference.vertices[0]!.x, y: reference.vertices[0]!.y };
    const norm = (polys: { x: number; y: number }[][], origin: { x: number; y: number }) => polys
      .map((poly) => poly.map((p) => [Math.round((p.x - origin.x) * 8) / 8, Math.round((p.y - origin.y) * 8) / 8]))
      .map((poly) => JSON.stringify([...poly].sort((l, r) => l[0]! - r[0]! || l[1]! - r[1]!)))
      .sort();
    const refPolys = norm(refSurfaces.map((s) => countertopSurfacePlanPolygon(s)), refOrigin);
    const ourPolys = norm(surfaces.map((s) => countertopSurfacePlanPolygon(s)), { x: 40, y: 70 });
    expect(ourPolys).toEqual(refPolys);

    // The two legs are mitered at one shared point; every slab is tagged to the chain.
    expect(surfaces.some((s) => s.miteredStart || s.miteredEnd)).toBe(true);
    for (const surface of surfaces) expect(surface.freestandingMemberUids?.slice().sort()).toEqual(["a", "b", "c", "d"]);

    // Every cabinet's centre is under a slab; nothing lands near the room walls.
    for (const cabinet of placed) {
      const body = freestandingBody(cabinet);
      expect(surfaces.some((s) => pointInPolygon(body.center, countertopSurfacePlanPolygon(s)))).toBe(true);
    }
    const allPoints = surfaces.flatMap((s) => countertopSurfacePlanPolygon(s));
    expect(Math.min(...allPoints.map((p) => p.y))).toBeGreaterThan(5);
    expect(Math.max(...allPoints.map((p) => p.x))).toBeLessThan(room.width - 5);

    // The angled cabinet sits at the Wall Builder's 11" hold from its neighbour and the bodies do not overlap.
    const [, cBackRight] = freestandingBodyCorners(freestandingBody(straight[2]!));
    const [dBackLeft] = freestandingBodyCorners(freestandingBody(angled));
    // back corners: 11" along the first wall + 11" along the 45° wall = 2 legs of the hold triangle
    expect(Math.hypot(dBackLeft.x - cBackRight.x, dBackLeft.y - cBackRight.y)).toBeCloseTo(Math.hypot(11 + 11 * Math.SQRT1_2, 11 * Math.SQRT1_2), 1);
    expect(cabinetPlanBodiesIntersect(angled, straight[2]!)).toBe(false);
  });

  it("a base against a wall still uses the wall run slab, not a free-standing chain", () => {
    const placed = [base("w", 40, 0)];
    const surfaces = countertopSurfaces(placed, room, null);
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]!.freestandingMemberUids).toBeUndefined();
  });
});

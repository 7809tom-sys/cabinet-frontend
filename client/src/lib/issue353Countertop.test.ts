/**
 * Issue 353, outcomes 1-5 and 7 (Tom, Nov 9 2026).
 *
 * One continuous countertop across adjoining base cabinets, no stone past the
 * left end of the run, one continuous top through a 45-degree angled corner with
 * the same angled filler a continuous corner gets, a real bar top over the
 * raised bar wall, and a cooktop allowed on a sink base with no range or hood.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  DEFAULT_ROOM,
  bearsCountertop,
  convertLegacyCooktopPlacements,
  countertopArea,
  countertopSurfaces,
  countertopSurfacePlanPolygon,
  isRangeOrOven,
  wallPlacementAt,
  type PlacedCabinet,
  type PonyWall,
  type RoomData,
} from "./design";
import { addThreeDStandardCountertops } from "@/components/design/InteractiveRoom3D";
import { rangesInPlan } from "./overRangeFill";
import { applyDesignerLayoutRules } from "./designerLayoutRules";
import { buildCountertopFabricationSheet } from "./countertopFabricationSheet";

const ROOM: RoomData = { ...DEFAULT_ROOM, width: 192, depth: 156, ceilingHeight: 96 };

function base(uid: string, offset: number, width: number, extra: Partial<PlacedCabinet> = {}, room: RoomData = ROOM): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", room);
  return {
    uid,
    cabinetId: 1,
    masterCode: `B${width}`,
    description: `${width}" Base Cabinet`,
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
    ...extra,
  } as PlacedCabinet;
}

const round = (value: number) => Math.round(value * 100) / 100;
const baseTops = (placed: PlacedCabinet[], room: RoomData = ROOM) =>
  countertopSurfaces(placed, room).filter((surface) => surface.kind === "base" && !surface.raisedBar);

/** Along-wall span of each slab, for run continuity. */
const spans = (placed: PlacedCabinet[], room: RoomData = ROOM) => baseTops(placed, room)
  .map((surface) => ({ start: round(surface.x), end: round(surface.x + surface.width) }))
  .sort((left, right) => left.start - right.start);

describe("outcome 1: adjoining base cabinets get one continuous countertop", () => {
  it("touching cabinets share one slab", () => {
    expect(spans([base("a", 0, 30), base("b", 30, 30), base("c", 60, 30)]))
      .toEqual([{ start: 0, end: 90 }]);
  });

  it("a 1/8-inch seam still shares one slab", () => {
    const result = spans([base("a", 10, 24), base("b", 34.125, 24)]);
    expect(result).toHaveLength(1);
    expect(result[0]!.start).toBeCloseTo(10, 2);
    expect(result[0]!.end).toBeCloseTo(58.13, 1);
  });

  it("the slab never cuts off at a cabinet-to-cabinet seam", () => {
    // Eight cabinets with 1/16-inch build tolerances: one piece, not eight.
    const room: RoomData = { ...ROOM, width: 240 };
    const run = Array.from({ length: 8 }, (_, index) => base(`c${index}`, index * 24 + index * 0.0625, 24, {}, room));
    const slabs = baseTops(run, room);
    expect(slabs).toHaveLength(1);
    expect(round(slabs[0]!.x)).toBeCloseTo(0, 1);
    // It runs to the far end of the last cabinet, across every seam.
    const lastEnd = 7 * 24 + 7 * 0.0625 + 24;
    const polygon = countertopSurfacePlanPolygon(slabs[0]!);
    expect(Math.max(...polygon.map((point) => point.x))).toBeCloseTo(lastEnd, 2);
  });
});

describe("outcome 2: the countertop stops at the end of the cabinet run", () => {
  it("no stone past the far end of an end-of-run cabinet over open floor", () => {
    const tops = baseTops([base("a", 24, 30)]);
    expect(tops).toHaveLength(1);
    const polygon = countertopSurfacePlanPolygon(tops[0]!);
    expect(Math.max(...polygon.map((point) => point.x))).toBeCloseTo(54, 6);
    expect(Math.min(...polygon.map((point) => point.x))).toBeCloseTo(24, 6);
  });

  it("stops flush at a run that begins at the room wall", () => {
    const tops = baseTops([base("a", 0, 30), base("b", 30, 30)]);
    const polygon = countertopSurfacePlanPolygon(tops[0]!);
    expect(Math.min(...polygon.map((point) => point.x))).toBeCloseTo(0, 6);
    expect(Math.max(...polygon.map((point) => point.x))).toBeCloseTo(60, 6);
  });

  it("stops at both ends of a run that stands clear of the walls", () => {
    expect(spans([base("a", 40, 24), base("b", 64, 24)])).toEqual([{ start: 40, end: 88 }]);
  });

  it("still covers a blind corner's own dead-corner pull", () => {
    const blind = base("bbc", 0, 36, { masterCode: "BBC36", description: "36\" Blind Corner Base" });
    const tops = baseTops([blind, base("b", 36, 24)]);
    const polygon = countertopSurfacePlanPolygon(tops[0]!);
    expect(Math.min(...polygon.map((point) => point.x))).toBeCloseTo(0, 6);
    expect(Math.max(...polygon.map((point) => point.x))).toBeCloseTo(60, 0);
  });
});

describe("outcome 3 + 4: the 45-degree angled corner is one continuous top with the angled filler", () => {
  const angledRoom: RoomData = {
    ...DEFAULT_ROOM,
    width: 180,
    depth: 180,
    vertices: [
      { id: "v1", x: 0, y: 0 },
      { id: "v2", x: 60, y: 60 },
      { id: "v3", x: 60, y: 180 },
      { id: "v4", x: 0, y: 180 },
    ],
    customWalls: [
      { id: "diagonal", startVertexId: "v1", endVertexId: "v2", lockedAngle: 45 as const },
      { id: "straight", startVertexId: "v2", endVertexId: "v3" },
      { id: "return", startVertexId: "v3", endVertexId: "v4" },
      { id: "close", startVertexId: "v4", endVertexId: "v1" },
    ],
  };
  const diagonalLength = Math.hypot(60, 60);

  function onWall(uid: string, wallId: string, offset: number, width: number): PlacedCabinet {
    const spot = wallPlacementAt(offset, width, 24, wallId as never, angledRoom);
    return {
      uid, cabinetId: 1, masterCode: `B${width}`, description: `${width}" Base`, category: "Base",
      placement: "base", ...spot, width, depth: 24, height: 34.5, wallId, wallOffset: spot.wallOffset,
    } as PlacedCabinet;
  }

  it("meets the angled slab and the return at one shared mitered edge, with no void", () => {
    const placed = [
      onWall("angled", "diagonal", diagonalLength - 24, 24),
      onWall("back", "straight", 0, 24),
    ];
    const surfaces = countertopSurfaces(placed, angledRoom);
    const angled = surfaces.find((surface) => surface.customWallId === "diagonal")!;
    const back = surfaces.find((surface) => surface.customWallId === "straight")!;
    expect(angled.miteredEnd).toBe(true);
    expect(back.miteredStart).toBe(true);
    expect(angled.customWallMiterVertexId).toBe("v2");
    expect(back.customWallMiterVertexId).toBe("v2");

    const angledPolygon = countertopSurfacePlanPolygon(angled);
    const backPolygon = countertopSurfacePlanPolygon(back);
    const sharedEdge = angledPolygon.some((start, index) => {
      const end = angledPolygon[(index + 1) % angledPolygon.length]!;
      return backPolygon.some((otherStart, otherIndex) => {
        const otherEnd = backPolygon[(otherIndex + 1) % backPolygon.length]!;
        return Math.hypot(start.x - otherEnd.x, start.y - otherEnd.y) < 1e-6
          && Math.hypot(end.x - otherStart.x, end.y - otherStart.y) < 1e-6;
      });
    });
    expect(sharedEdge).toBe(true);
  });

  it("places the 45-degree corner infill where the run meets the return, after the cabinet holds", () => {
    // Each leg holds 11 inches back from the shared vertex, exactly what the
    // continuous-corner case gets, so the wall-side pocket is real and must be
    // filled with the one measured angled filler rather than left as a void.
    const placed = [
      onWall("d", "diagonal", diagonalLength - 24 - 11, 24),
      onWall("s", "straight", 11, 24),
    ];
    const surfaces = countertopSurfaces(placed, angledRoom);
    const infill = surfaces.find((surface) => surface.customWallCornerInfill);
    expect(infill).toBeTruthy();
    expect(infill!.customWallMiterVertexId).toBe("v2");
    const polygon = countertopSurfacePlanPolygon(infill!);
    expect(polygon.some((point) => Math.hypot(point.x - 60, point.y - 60) < 1e-6)).toBe(true);
    expect(infill!.areaInches ?? 0).toBeGreaterThan(0);
  });
});

describe("outcome 5: the bar area gets a real bar countertop", () => {
  const barWall: PonyWall = {
    uid: "bar-wall",
    x: 24,
    y: 30,
    width: 90,
    depth: 4.5,
    height: 40.5,
    rotation: 0,
    finish: "drywall",
  };

  it("generates a 42-inch bar top over the raised wall and keeps the lower worktop", () => {
    const placed = [base("a", 24, 30), base("b", 54, 30), base("c", 84, 30)];
    const withWall = countertopSurfaces(placed, ROOM, null, [barWall]);
    const bar = withWall.filter((surface) => surface.raisedBar);
    expect(bar).toHaveLength(1);
    expect(bar[0]!.countertopHeightIn).toBe(42);
    expect(bar[0]!.cabinetRunId).toBe("bar-wall:bar-wall");
    expect(withWall.filter((surface) => !surface.raisedBar)).toHaveLength(1);
  });

  it("draws that bar top in 3D at the 42-inch level", () => {
    const placed = [base("a", 24, 30), base("b", 54, 30)];
    const root = new THREE.Group();
    addThreeDStandardCountertops(root, ROOM, placed, "#f4f1ea", null, null, [barWall]);
    const barMeshes: THREE.Mesh[] = [];
    root.traverse((node) => {
      if ((node as THREE.Mesh).isMesh && node.userData.barWallCountertop === true) barMeshes.push(node as THREE.Mesh);
    });
    expect(barMeshes).toHaveLength(1);
    expect(barMeshes[0]!.userData.raisedBar).toBe(true);
    expect(barMeshes[0]!.userData.countertopHeightIn).toBe(42);
    const bounds = new THREE.Box3().setFromObject(barMeshes[0]!);
    expect(bounds.max.y * 12).toBeCloseTo(42, 5);
  });

  it("is measured for the quote, cart and build sheet", () => {
    const placed = [base("a", 24, 30), base("b", 54, 30), base("c", 84, 30)];
    const withoutBar = countertopArea(placed, null, null, ROOM, []);
    const withBar = countertopArea(placed, null, null, ROOM, [barWall]);
    expect(withBar.squareFeet).toBeGreaterThan(withoutBar.squareFeet);
    expect(withBar.runInches).toBeGreaterThan(withoutBar.runInches);
    expect(withBar.perimeterSquareFeet).toBeGreaterThan(withoutBar.perimeterSquareFeet);

    const sheet = buildCountertopFabricationSheet({ room: ROOM, placed, ponyWalls: [barWall], now: new Date("2026-11-09T00:00:00Z") });
    const barRun = sheet.runs.find((run) => run.kind === "raised-bar");
    expect(barRun).toBeTruthy();
    expect(barRun!.label).toContain("bar");
    expect(barRun!.topHeightIn).toBe(42);
    expect(barRun!.areaSqFt).toBeGreaterThan(0);
  });

  it("adds nothing when the wall is only counter-height (a plain partition)", () => {
    const lowWall: PonyWall = { ...barWall, uid: "low", height: 34.5 };
    expect(countertopSurfaces([base("a", 24, 30)], ROOM, null, [lowWall]).some((surface) => surface.raisedBar)).toBe(false);
  });
});

describe("outcome 7: a cooktop may sit on a sink base with no range or hood", () => {
  it("a countertop-opening cooktop is not a range, so it never forces ventilation", () => {
    const sinkBase = base("sb", 24, 36, {
      masterCode: "SB36",
      description: '36" Sink Base Cabinet',
      subCategory: "Sink Base",
      sinkTopType: "gas",
      sinkTopProductId: 30001,
    });
    const converted = convertLegacyCooktopPlacements([base("a", 0, 24), sinkBase, base("c", 60, 24)], []);
    const cooktop = converted.placed.find((item) => item.applianceRole === "countertop-opening");
    expect(cooktop).toBeTruthy();
    expect(isRangeOrOven(cooktop!.masterCode, cooktop!.description)).toBe(true);
    // ...but it is not a freestanding range for the bridge/hood question.
    expect(rangesInPlan(converted.placed)).toEqual([]);
    expect(converted.placed.some((item) => bearsCountertop(item) && item.uid === "sb")).toBe(true);
  });

  it("the layout rules accept the plan and add no range or hood", () => {
    const sinkBase = base("sb", 24, 36, {
      masterCode: "SB36",
      description: '36" Sink Base Cabinet',
      subCategory: "Sink Base",
      sinkTopType: "induction",
    });
    const converted = convertLegacyCooktopPlacements([base("a", 0, 24), sinkBase, base("c", 60, 24)], []);
    let uid = 0;
    const result = applyDesignerLayoutRules({
      placed: converted.placed,
      room: ROOM,
      openings: [],
      fillers: [],
      makeUid: () => `o7-${++uid}`,
      styleId: 11,
    });
    const hoods = result.placed.filter((item) => /^HOOD/i.test(item.masterCode ?? ""));
    const ranges = result.placed.filter((item) => item.placement === "appliance"
      && isRangeOrOven(item.masterCode, item.description)
      && item.applianceRole !== "countertop-opening");
    expect(hoods).toEqual([]);
    expect(ranges).toEqual([]);
    expect(result.placed.some((item) => item.uid === "sb")).toBe(true);
    expect(result.placed.some((item) => item.applianceRole === "countertop-opening")).toBe(true);
  });

  it("still recognizes a real freestanding range", () => {
    const range = base("r", 24, 30, {
      masterCode: "RANGE-30",
      description: '30" Range',
      category: "Appliance",
      subCategory: "Appliance",
      placement: "appliance",
      depth: 25,
      applianceRole: "freestanding",
    });
    expect(rangesInPlan([range])).toHaveLength(1);
  });
});

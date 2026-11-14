import { describe, expect, it } from "vitest";
import {
  applyApronFrontCountertopNotches,
  apronFrontNotchRect,
  apronFrontRemovedArea,
  isApronFrontSink,
  subtractRectFromPolygon,
  subtractRunIntervals,
  type ApronNotchSurface,
} from "./farmSinkCountertopNotch";
import { countertopArea, countertopSurfaces, makeSinkForCabinet, type PlacedCabinet, type RoomData } from "./design";

const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function base(overrides: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return {
    uid: "fsb",
    cabinetId: 1,
    masterCode: "FSB36",
    description: "36 inch farmhouse sink base",
    category: "Base",
    subCategory: "Sink Base",
    placement: "base",
    x: 24,
    y: 0,
    width: 36,
    depth: 24,
    height: 34.5,
    rotation: 0,
    wallId: "top",
    ...overrides,
  } as PlacedCabinet;
}

function pointInside(points: { x: number; y: number }[], point: { x: number; y: number }) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const a = points[index]!;
    const b = points[previous]!;
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

describe("apron-front countertop notch", () => {
  const cabinet = base();
  const farm = {
    ...makeSinkForCabinet("farmhouse", cabinet, room, { width: 33, depth: 21 }),
    apronFront: true,
  };
  const slab: ApronNotchSurface = { x: 0, y: 0, width: 90, depth: 25.5, kind: "base" };

  it("notches only apron-front sinks", () => {
    expect(isApronFrontSink({ type: "farmhouse", x: 0, y: 0, width: 30, depth: 20 })).toBe(true);
    expect(isApronFrontSink({ type: "single", apronFront: false, x: 0, y: 0, width: 30, depth: 18 })).toBe(false);
    expect(apronFrontNotchRect({ type: "single", apronFront: false, x: 1, y: 2, width: 30, depth: 18, wallSide: "top" })).toBeNull();
  });

  it("removes the counter in front of a top-wall farm sink and keeps the deck behind it", () => {
    const [notched] = applyApronFrontCountertopNotches([slab], [farm]);
    expect(notched?.polygon?.length).toBeGreaterThanOrEqual(6);
    const full = slab.width * slab.depth;
    const removed = apronFrontRemovedArea([slab], [farm]).straight;
    expect(full - (notched?.areaInches ?? 0)).toBeCloseTo(removed, 4);
    expect(removed).toBeGreaterThan(33 * 20);
    const outline = (notched?.polygon ?? []).map((point) => ({ x: slab.x + point.x, y: slab.y + point.y }));
    expect(pointInside(outline, { x: farm.x + farm.width / 2, y: 25.4 })).toBe(false);
    expect(pointInside(outline, { x: farm.x + farm.width / 2, y: 1 })).toBe(true);
    expect(pointInside(outline, { x: 2, y: 20 })).toBe(true);
    expect(pointInside(outline, { x: 88, y: 20 })).toBe(true);
  });

  it("leaves an undermount sink's slab whole", () => {
    const undermount = {
      ...makeSinkForCabinet("single", { ...cabinet, masterCode: "SB36", description: "Sink Base 36" }, room, { width: 30, depth: 18 }),
      apronFront: false,
      type: "single" as const,
    };
    const [only] = applyApronFrontCountertopNotches([slab], [undermount]);
    expect(only).toEqual(slab);
    expect(apronFrontRemovedArea([slab], [undermount]).straight).toBe(0);
  });

  it("reduces the quoted countertop area by the notch and not by an undermount bowl", () => {
    const neighbor = base({ uid: "left", masterCode: "B18", description: "18 inch base", x: 0, width: 24, subCategory: "Base" });
    const right = base({ uid: "right", masterCode: "B18", description: "18 inch base", x: 60, width: 24, subCategory: "Base" });
    const placed = [neighbor, cabinet, right];
    const full = countertopArea(placed, null, null, room);
    const notched = countertopArea(placed, null, null, room, [farm]);
    expect(notched.squareFeet).toBeLessThan(full.squareFeet);
    expect(full.squareFeet - notched.squareFeet).toBeGreaterThan(4);
    const undermount = {
      ...makeSinkForCabinet("double", { ...cabinet, masterCode: "SB36", description: "Sink base" }, room, { width: 33, depth: 18 }),
      apronFront: false,
    };
    expect(countertopArea(placed, null, null, room, [undermount]).squareFeet).toBe(full.squareFeet);
  });

  it("notches the shared countertop surface used by the plan and the 3D view", () => {
    const surfaces = applyApronFrontCountertopNotches(countertopSurfaces([cabinet], room), [farm]);
    const frontCenter = { x: farm.x + farm.width / 2, y: 25.4 };
    const onStone = surfaces.some((surface) => {
      const polygon = [
        { x: surface.x, y: surface.y },
        { x: surface.x + surface.width, y: surface.y },
        { x: surface.x + surface.width, y: surface.y + surface.depth },
        { x: surface.x, y: surface.y + surface.depth },
      ];
      return pointInside(surface.polygon?.length ? surface.polygon.map((point) => ({
        x: surface.x + point.x,
        y: surface.y + point.y,
      })) : polygon, frontCenter);
    });
    expect(onStone).toBe(false);
    const behind = { x: farm.x + farm.width / 2, y: 1 };
    const deckRemains = surfaces.some((surface) => (
      behind.x >= surface.x && behind.x <= surface.x + surface.width
      && behind.y >= surface.y && behind.y <= surface.y + surface.depth
    ));
    expect(deckRemains).toBe(true);
  });

  it("cuts a shaped slab into one outline that keeps the rear deck and drops the front", () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 90, y: 0 },
      { x: 90, y: 25.5 },
      { x: 0, y: 25.5 },
    ];
    const notch = apronFrontNotchRect(farm)!;
    const cut = subtractRectFromPolygon(polygon, notch);
    expect(cut.length).toBeGreaterThanOrEqual(6);
    const signed = cut.reduce((sum, point, index) => {
      const next = cut[(index + 1) % cut.length]!;
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2;
    const area = Math.abs(signed);
    expect(signed).toBeGreaterThan(0);
    const removed = apronFrontRemovedArea([slab], [farm]).straight;
    expect(90 * 25.5 - area).toBeCloseTo(removed, 2);
    expect(pointInside(cut, { x: farm.x + farm.width / 2, y: 25.4 })).toBe(false);
    expect(pointInside(cut, { x: farm.x + farm.width / 2, y: 1 })).toBe(true);
  });

  it("notches a bottom-wall and a left-wall farm sink from the room-facing edge", () => {
    const bottomCabinet = base({ y: room.depth - 24, wallId: "bottom" });
    const bottomSink = {
      ...makeSinkForCabinet("farmhouse", bottomCabinet, room, { width: 33, depth: 21 }),
      apronFront: true,
    };
    const bottomSlab: ApronNotchSurface = { x: 0, y: room.depth - 25.5, width: 90, depth: 25.5, kind: "base" };
    const [bottom] = applyApronFrontCountertopNotches([bottomSlab], [bottomSink]);
    const bottomOutline = (bottom?.polygon ?? []).map((point) => ({ x: bottomSlab.x + point.x, y: bottomSlab.y + point.y }));
    expect(pointInside(bottomOutline, { x: bottomSink.x + 10, y: bottomSlab.y + 0.2 })).toBe(false);
    expect(pointInside(bottomOutline, { x: bottomSink.x + 10, y: room.depth - 1 })).toBe(true);

    const leftCabinet = base({ x: 0, y: 20, wallId: "left" });
    const leftSink = {
      ...makeSinkForCabinet("farmhouse", leftCabinet, room, { width: 33, depth: 21 }),
      apronFront: true,
    };
    const leftSlab: ApronNotchSurface = { x: 0, y: 0, width: 25.5, depth: 90, kind: "base" };
    const [left] = applyApronFrontCountertopNotches([leftSlab], [leftSink]);
    const leftOutline = (left?.polygon ?? []).map((point) => ({ x: leftSlab.x + point.x, y: leftSlab.y + point.y }));
    expect(pointInside(leftOutline, { x: 25.3, y: leftSink.y + 8 })).toBe(false);
    expect(pointInside(leftOutline, { x: 1, y: leftSink.y + 8 })).toBe(true);
  });

  it("opens an elevation run across the apron and keeps the ends", () => {
    expect(subtractRunIntervals([{ start: 0, end: 90 }], [{ start: 27, end: 60 }])).toEqual([
      { start: 0, end: 27 },
      { start: 60, end: 90 },
    ]);
  });
});

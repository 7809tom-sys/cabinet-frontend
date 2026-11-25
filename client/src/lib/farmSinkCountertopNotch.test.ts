import { describe, expect, it } from "vitest";
import {
  applyApronFrontCountertopNotches,
  apronFrontNotchRect,
  apronFrontRemovedArea,
  apronFrontRimDepthIn,
  isApronFrontSink,
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

function worldOutline(surface: ApronNotchSurface) {
  const local = surface.polygon?.length
    ? surface.polygon
    : [
      { x: 0, y: 0 },
      { x: surface.width, y: 0 },
      { x: surface.width, y: surface.depth },
      { x: 0, y: surface.depth },
    ];
  return local.map((point) => ({ x: surface.x + point.x, y: surface.y + point.y }));
}

describe("apron-front countertop notch", () => {
  const cabinet = base();
  const farm = {
    ...makeSinkForCabinet("farmhouse", cabinet, room, { width: 33, depth: 21 }),
    apronFront: true,
    bowlDepth: 18,
    sourceDepth: 21,
  };
  const slab: ApronNotchSurface = { x: 0, y: 0, width: 90, depth: 25.5, kind: "base" };
  const rim = apronFrontRimDepthIn(farm);

  it("notches only apron-front sinks, exactly the sink width and the front rim", () => {
    expect(isApronFrontSink({ type: "farmhouse", x: 0, y: 0, width: 30, depth: 20 })).toBe(true);
    const seeded = { type: "farmhouse" as const, apronFront: undefined, x: 0, y: 0, width: 36, depth: 20, wallSide: "top" as const };
    expect(apronFrontNotchRect(seeded)?.width).toBe(36);
    expect(isApronFrontSink({ type: "single", apronFront: false, x: 0, y: 0, width: 30, depth: 18 })).toBe(false);
    expect(rim).toBeCloseTo((21 - 18) / 2, 5);
    const notch = apronFrontNotchRect(farm);
    expect(notch).toMatchObject({ x: farm.x, width: farm.width });
    expect(notch!.y).toBeCloseTo(farm.y + farm.depth - rim, 5);
    expect(notch!.y + rim).toBeCloseTo(farm.y + farm.depth, 5);
    expect(apronFrontNotchRect({ type: "single", apronFront: false, x: 1, y: 2, width: 30, depth: 18, wallSide: "top" })).toBeNull();
    expect(apronFrontNotchRect({ type: "double", apronFront: false, x: 1, y: 2, width: 33, depth: 20, wallSide: "top", bathroomVanity: true } as never)).toBeNull();
  });

  it("removes the counter from the bowl front through the slab front and keeps the side and back rims", () => {
    const [notched] = applyApronFrontCountertopNotches([slab], [farm]);
    const outline = worldOutline(notched!);
    const bowlFront = farm.y + farm.depth - rim;
    const centerX = farm.x + farm.width / 2;
    expect(pointInside(outline, { x: centerX, y: 25.4 })).toBe(false);
    expect(pointInside(outline, { x: centerX, y: bowlFront + 0.05 })).toBe(false);
    expect(pointInside(outline, { x: centerX, y: bowlFront - 0.2 })).toBe(true);
    expect(pointInside(outline, { x: centerX, y: farm.y + rim / 2 })).toBe(true);
    expect(pointInside(outline, { x: farm.x + 0.4, y: farm.y + farm.depth / 2 })).toBe(true);
    expect(pointInside(outline, { x: farm.x - 1, y: 25 })).toBe(true);
    expect(pointInside(outline, { x: farm.x + farm.width + 1, y: 25 })).toBe(true);
    const removed = apronFrontRemovedArea([slab], [farm]).straight;
    expect(removed).toBeCloseTo(farm.width * (25.5 - bowlFront), 1);
    expect(removed).toBeLessThan(farm.width * farm.depth);
  });

  it("gives an undermount, drop-in, or vanity sink no front notch", () => {
    const undermount = {
      ...makeSinkForCabinet("single", { ...cabinet, masterCode: "SB36", description: "Sink Base 36" }, room, { width: 30, depth: 18 }),
      apronFront: false,
      type: "single" as const,
    };
    const dropIn = { ...undermount, type: "double" as const, apronFront: false };
    const vanity = { ...undermount, type: "single" as const, apronFront: false, wallSide: "top" as const };
    for (const sink of [undermount, dropIn, vanity]) {
      expect(apronFrontNotchRect(sink)).toBeNull();
      const [only] = applyApronFrontCountertopNotches([slab], [sink]);
      expect(only).toEqual(slab);
      expect(apronFrontRemovedArea([slab], [sink]).straight).toBe(0);
      const front = { x: sink.x + sink.width / 2, y: sink.y + sink.depth - 0.1 };
      expect(front.x).toBeGreaterThanOrEqual(slab.x);
      expect(front.y).toBeLessThanOrEqual(slab.y + slab.depth);
    }
  });

  it("reduces the quoted countertop area by the front notch only", () => {
    const neighbor = base({ uid: "left", masterCode: "B18", description: "18 inch base", x: 0, width: 24, subCategory: "Base" });
    const right = base({ uid: "right", masterCode: "B18", description: "18 inch base", x: 60, width: 24, subCategory: "Base" });
    const placed = [neighbor, cabinet, right];
    const full = countertopArea(placed, null, null, room);
    const notched = countertopArea(placed, null, null, room, [farm]);
    expect(notched.squareFeet).toBeLessThanOrEqual(full.squareFeet);
    const removed = apronFrontRemovedArea(countertopSurfaces(placed, room), [farm]);
    expect(removed.straight).toBeGreaterThan(farm.width * rim);
    expect(removed.straight).toBeLessThan(farm.width * (rim + 2));
    const undermount = {
      ...makeSinkForCabinet("double", { ...cabinet, masterCode: "SB36", description: "Sink base" }, room, { width: 33, depth: 18 }),
      apronFront: false,
    };
    expect(countertopArea(placed, null, null, room, [undermount]).squareFeet).toBe(full.squareFeet);
  });

  it("notches the shared countertop surface used by the plan and the 3D view", () => {
    const surfaces = applyApronFrontCountertopNotches(countertopSurfaces([cabinet], room), [farm]);
    const covered = (point: { x: number; y: number }) => surfaces.some((surface) => pointInside(worldOutline(surface), point));
    const centerX = farm.x + farm.width / 2;
    const bowlFront = farm.y + farm.depth - rim;
    expect(surfaces.some((surface) => (surface.polygon?.length ?? 0) >= 6)).toBe(true);
    expect(covered({ x: centerX, y: 25.4 })).toBe(false);
    expect(covered({ x: centerX, y: 1 })).toBe(true);
    expect(covered({ x: farm.x + 0.4, y: (farm.y + bowlFront) / 2 })).toBe(true);
  });

  it("notches a bottom-wall and a left-wall farm sink from the room-facing edge only", () => {
    const bottomCabinet = base({ y: room.depth - 24, wallId: "bottom" });
    const bottomSink = {
      ...makeSinkForCabinet("farmhouse", bottomCabinet, room, { width: 33, depth: 21 }),
      apronFront: true,
      bowlDepth: 18,
      sourceDepth: 21,
    };
    const bottomSlab: ApronNotchSurface = { x: 0, y: room.depth - 25.5, width: 90, depth: 25.5, kind: "base" };
    const [bottom] = applyApronFrontCountertopNotches([bottomSlab], [bottomSink]);
    const bottomOutline = worldOutline(bottom!);
    const bottomRim = apronFrontRimDepthIn(bottomSink);
    expect(pointInside(bottomOutline, { x: bottomSink.x + 10, y: bottomSlab.y + 0.2 })).toBe(false);
    expect(pointInside(bottomOutline, { x: bottomSink.x + 10, y: bottomSink.y + bottomRim + 0.4 })).toBe(true);

    const leftCabinet = base({ x: 0, y: 20, wallId: "left" });
    const leftSink = {
      ...makeSinkForCabinet("farmhouse", leftCabinet, room, { width: 33, depth: 21 }),
      apronFront: true,
      bowlDepth: 18,
      sourceDepth: 21,
    };
    const leftSlab: ApronNotchSurface = {
      x: leftSink.x,
      y: leftSink.y,
      width: leftSink.width + 0.4,
      depth: leftSink.depth,
      kind: "base",
    };
    const [left] = applyApronFrontCountertopNotches([leftSlab], [leftSink]);
    const leftOutline = worldOutline(left!);
    const leftRim = apronFrontRimDepthIn(leftSink);
    const leftMidY = leftSink.y + leftSink.depth / 2;
    expect(leftRim).toBeCloseTo(1.5, 5);
    expect(apronFrontNotchRect(leftSink)?.width).toBeGreaterThan(leftRim);
    expect(apronFrontNotchRect(leftSink)?.depth).toBeCloseTo(leftSink.depth, 5);
    expect(pointInside(leftOutline, { x: leftSink.x + leftSink.width - leftRim / 2, y: leftMidY })).toBe(false);
    expect(pointInside(leftOutline, { x: leftSink.x + leftRim / 2, y: leftMidY })).toBe(true);

    const rightSink = {
      ...leftSink,
      wallSide: "right" as const,
      x: 120,
      y: leftSink.y,
    };
    const rightSlab: ApronNotchSurface = {
      x: rightSink.x - 0.4,
      y: rightSink.y,
      width: rightSink.width + 0.4,
      depth: rightSink.depth,
      kind: "base",
    };
    const [right] = applyApronFrontCountertopNotches([rightSlab], [rightSink]);
    const rightOutline = worldOutline(right!);
    const rightMidY = rightSink.y + rightSink.depth / 2;
    expect(pointInside(rightOutline, { x: rightSink.x + leftRim / 2, y: rightMidY })).toBe(false);
    expect(pointInside(rightOutline, { x: rightSink.x + rightSink.width - leftRim / 2, y: rightMidY })).toBe(true);
  });

  it("opens an elevation run across the apron and keeps the ends", () => {
    expect(subtractRunIntervals([{ start: 0, end: 90 }], [{ start: 27, end: 60 }])).toEqual([
      { start: 0, end: 27 },
      { start: 60, end: 90 },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  applyApronFrontCountertopNotches,
  apronFrontNotchRect,
  apronFrontRemovedArea,
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

describe("farm sink counter stays over the rim", () => {
  const cabinet = base();
  const farm = {
    ...makeSinkForCabinet("farmhouse", cabinet, room, { width: 33, depth: 21 }),
    apronFront: true,
  };
  const slab: ApronNotchSurface = { x: 0, y: 0, width: 90, depth: 25.5, kind: "base" };

  it("does not bite the counter in front of a farm sink", () => {
    expect(isApronFrontSink({ type: "farmhouse", x: 0, y: 0, width: 30, depth: 20 })).toBe(true);
    expect(isApronFrontSink({ type: "single", apronFront: false, x: 0, y: 0, width: 30, depth: 18 })).toBe(false);
    expect(apronFrontNotchRect(farm)).toBeNull();
    expect(apronFrontNotchRect({ type: "single", apronFront: false, x: 1, y: 2, width: 30, depth: 18, wallSide: "top" })).toBeNull();
    const [whole] = applyApronFrontCountertopNotches([slab], [farm]);
    expect(whole).toEqual(slab);
    expect(apronFrontRemovedArea([slab], [farm]).straight).toBe(0);
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

  it("keeps the quoted countertop area when a farm sink is undermounted", () => {
    const neighbor = base({ uid: "left", masterCode: "B18", description: "18 inch base", x: 0, width: 24, subCategory: "Base" });
    const right = base({ uid: "right", masterCode: "B18", description: "18 inch base", x: 60, width: 24, subCategory: "Base" });
    const placed = [neighbor, cabinet, right];
    const full = countertopArea(placed, null, null, room);
    expect(countertopArea(placed, null, null, room, [farm]).squareFeet).toBe(full.squareFeet);
  });

  it("keeps stone over the farm sink front on the shared plan and 3D surface", () => {
    const surfaces = applyApronFrontCountertopNotches(countertopSurfaces([cabinet], room), [farm]);
    expect(surfaces.every((surface) => !surface.polygon?.length)).toBe(true);
    const front = { x: farm.x + farm.width / 2, y: 25.4 };
    const covered = surfaces.some((surface) => (
      front.x >= surface.x && front.x <= surface.x + surface.width
      && front.y >= surface.y && front.y <= surface.y + surface.depth
    ));
    expect(covered).toBe(true);
  });

  it("opens an elevation run across the apron and keeps the ends", () => {
    expect(subtractRunIntervals([{ start: 0, end: 90 }], [{ start: 27, end: 60 }])).toEqual([
      { start: 0, end: 27 },
      { start: 60, end: 90 },
    ]);
  });
});

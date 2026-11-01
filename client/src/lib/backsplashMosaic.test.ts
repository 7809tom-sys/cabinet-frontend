import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet, type WallOpening } from "./design";
import {
  MOSAIC_GROUT_MAX_IN, MOSAIC_GROUT_MIN_IN, MOSAIC_INTERLOCK_SPECS, baseboardSpans, clampMosaicGroutIn,
  mosaicAlongForTile, mosaicInterlockSpecForKey, mosaicInterlockSpecForName, mosaicInterlockUnitPlan, mosaicPhaseAnchorEdge,
  mosaicFinishedEdges, mosaicPitchIn, mosaicPlanGroutIn, mosaicSheetShade, mosaicUvForPoint,
} from "./backsplashMosaic";

const room = DEFAULT_ROOM;

describe("interlocking mosaics repeat at their interlock spacing", () => {
  it("covers every curated interlocking sheet, keyed the same way the 3D sources are", () => {
    for (const key of ["desert-clay-11.81in-interlocking-mosaic", "arctic-vail-10.71in-interlocking-hex-mosaic", "carbon-hex-12.80in-marble-hex-mosaic", "concord-square-11.81in-glass-marble-mosaic", "golden-trace-11.81in-marble-aluminum-mosaic"]) {
      expect(mosaicInterlockSpecForKey(key), key).not.toBeNull();
    }
    expect(mosaicInterlockSpecForName("Golden Trace Mosaic 11.81")?.key).toBe("golden-trace-11.81in-marble-aluminum-mosaic");
  });
  it("the repeat spacing is smaller than the photo's outer size, so the fingers overlap into the next sheet", () => {
    for (const item of MOSAIC_INTERLOCK_SPECS) {
      const pitch = mosaicPitchIn(item);
      expect(pitch.x).toBeLessThan(item.outerWidthIn);
      expect(pitch.y).toBeLessThan(item.outerHeightIn);
      expect(pitch.x).toBeGreaterThan(item.outerWidthIn * 0.8);
    }
  });
  it("UVs advance exactly one texture repeat per interlock pitch, not per outer size", () => {
    const item = mosaicInterlockSpecForKey("desert-clay-11.81in-interlocking-mosaic")!;
    const pitch = mosaicPitchIn(item);
    const a = mosaicUvForPoint(20, 40, pitch.x, pitch.y, 144, "start");
    const b = mosaicUvForPoint(20 + pitch.x, 40, pitch.x, pitch.y, 144, "start");
    const c = mosaicUvForPoint(20, 40 + pitch.y, pitch.x, pitch.y, 144, "start");
    expect(b.u - a.u).toBeCloseTo(1, 9);
    expect(c.v - a.v).toBeCloseTo(1, 9);
    // the old behaviour (outer size) would have advanced less than a whole repeat per pitch
    expect(pitch.x / item.outerWidthIn).toBeLessThan(1);
  });
  it("the unit crop is one pitch wide and tall, centered inside the photo", () => {
    const item = mosaicInterlockSpecForKey("carbon-hex-12.80in-marble-hex-mosaic")!;
    const plan = mosaicInterlockUnitPlan(item, 1280, 1110, 4096);
    const pitch = mosaicPitchIn(item);
    expect(plan.source.width / (1280 / item.outerWidthIn)).toBeCloseTo(pitch.x, 5);
    expect(plan.source.height / (1110 / item.outerHeightIn)).toBeCloseTo(pitch.y, 5);
    expect(plan.source.x * 2 + plan.source.width).toBeCloseTo(1280, 5);
    expect(plan.source.y * 2 + plan.source.height).toBeCloseTo(1110, 5);
  });
});

describe("grout is an even 1/16 to 1/8 inch at every joint", () => {
  it("clamps any requested width into the range", () => {
    expect(clampMosaicGroutIn(0.01)).toBe(MOSAIC_GROUT_MIN_IN);
    expect(clampMosaicGroutIn(0.5)).toBe(MOSAIC_GROUT_MAX_IN);
    expect(clampMosaicGroutIn(undefined)).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN);
  });
  it("the painted grout line measures 1/16 to 1/8 inch in real inches for every sheet, both directions", () => {
    for (const item of MOSAIC_INTERLOCK_SPECS) {
      const plan = mosaicInterlockUnitPlan(item, 2048, 2048, 2048);
      const grout = mosaicPlanGroutIn(plan);
      // one pixel of rounding either way
      const slackX = (1 / plan.width) * plan.pitchXIn;
      const slackY = (1 / plan.height) * plan.pitchYIn;
      expect(grout.x).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN - slackX);
      expect(grout.x).toBeLessThanOrEqual(MOSAIC_GROUT_MAX_IN + slackX);
      expect(grout.y).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN - slackY);
      expect(grout.y).toBeLessThanOrEqual(MOSAIC_GROUT_MAX_IN + slackY);
      expect(Math.abs(grout.x - grout.y)).toBeLessThan(0.02); // same line width both ways
    }
  });
});

describe("the pattern lines up at an inside corner", () => {
  it("a run whose only corner is at its end is measured from that corner", () => {
    expect(mosaicPhaseAnchorEdge(false, true)).toBe("end");
    expect(mosaicPhaseAnchorEdge(true, false)).toBe("start");
    expect(mosaicPhaseAnchorEdge(true, true)).toBe("start");
    expect(mosaicPhaseAnchorEdge(false, false)).toBe("start");
  });
  it("tile distance from the corner is identical on both walls", () => {
    const pitch = 11.5;
    const topLength = 144;
    // top wall's corner is at x = 144; right wall's corner is at y = 0
    for (const away of [0, 3, 11.5, 20, 60]) {
      const onTop = mosaicAlongForTile(topLength - away, topLength, "end");
      const onRight = mosaicAlongForTile(away, 120, "start");
      expect(onTop / pitch).toBeCloseTo(onRight / pitch, 9);
    }
  });
});

describe("sheet shade variation", () => {
  it("is deterministic and brightness-only within +/-2.5%", () => {
    expect(mosaicSheetShade(3, 4, 1)).toBe(mosaicSheetShade(3, 4, 1));
    const shades = Array.from({ length: 200 }, (_, i) => mosaicSheetShade(i, i % 7, 1));
    expect(Math.min(...shades)).toBeGreaterThanOrEqual(0.974);
    expect(Math.max(...shades)).toBeLessThanOrEqual(1.026);
    expect(new Set(shades.map((s) => s.toFixed(3))).size).toBeGreaterThan(5);
  });
});

describe("baseboards only along exposed walls", () => {
  const cab = (along: number, width: number, code = "B24"): PlacedCabinet => {
    const spot = wallPlacementAt(along, width, 24, "top", room)!;
    return {
      uid: `${code}-${along}`, cabinetId: 1, masterCode: code, description: code, category: "Base", placement: "base",
      x: spot.x, y: spot.y, width, depth: 24, height: 34.5, rotation: spot.rotation, wallId: spot.wallId, wallOffset: spot.wallOffset,
      numberOfDoors: 2, numberOfDrawers: 0,
    } as PlacedCabinet;
  };
  const length = room.width;
  it("a bare wall gets baseboard along its whole length", () => {
    expect(baseboardSpans([], [], room, "top")).toEqual([{ start: 0, end: length }]);
  });
  it("none is run behind base cabinets standing on the floor against the wall", () => {
    const spans = baseboardSpans([cab(0, 60)], [], room, "top");
    expect(spans).toEqual([{ start: 60, end: length }]);
  });
  it("a wall cabinet leaves the wall exposed, and a door opening interrupts the run", () => {
    const wall = { ...cab(10, 30, "W3030"), placement: "wall", category: "Wall", y: cab(10, 30).y, elevation: 54 } as unknown as PlacedCabinet;
    const door: WallOpening = { uid: "d", kind: "door", label: "Door", side: "top", offset: 80, width: 36, height: 80, sill: 0 };
    const spans = baseboardSpans([wall], [door], room, "top");
    expect(spans.some((s) => s.start <= 10 && s.end >= 40)).toBe(true);
    expect(spans.every((s) => s.end <= 80 + 0.01 || s.start >= 116 - 0.01)).toBe(true);
  });
  it("a wall with no cabinets on it is unaffected by cabinets on another wall", () => {
    expect(baseboardSpans([cab(0, 60)], [], room, "bottom")).toEqual([{ start: 0, end: length }]);
  });
});

describe("clean finished edges on cut tile", () => {
  const wall = (over: Partial<{ start: number; end: number; bottom: number; top: number }>) => ({ side: "top", start: 0, end: 100, bottom: 36, top: 54, ...over });
  it("a free top edge below the ceiling gets a strip; the counter edge and the wall ends do not", () => {
    expect(mosaicFinishedEdges(wall({}), [wall({})], 144, 96)).toEqual(["top", "end"]);
    expect(mosaicFinishedEdges(wall({ start: 0, end: 144 }), [], 144, 96)).toEqual(["top"]);
  });
  it("edges shared with a neighbouring piece (behind a hood, around a window) are not stripped", () => {
    const left = wall({ start: 0, end: 50 });
    const hood = wall({ start: 50, end: 80, top: 80 });
    expect(mosaicFinishedEdges(left, [left, hood], 144, 96)).toEqual(["top"]);
    const below = wall({ start: 30, end: 60, top: 42 });
    const above = wall({ start: 30, end: 60, bottom: 60, top: 80 });
    expect(mosaicFinishedEdges(below, [below, above], 144, 96)).toContain("top");
    expect(mosaicFinishedEdges(above, [below, above], 144, 96)).toContain("bottom");
  });
});

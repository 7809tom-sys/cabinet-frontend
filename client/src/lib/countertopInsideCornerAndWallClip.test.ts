import { describe, expect, it } from "vitest";
import { countertopSurfaces, countertopSurfacePlanPolygon, wallPlacementAt, type PlacedCabinet, type PonyWall, type RoomData } from "./design";

const cab = (o: Partial<PlacedCabinet>): PlacedCabinet => ({
  uid: "u", cabinetId: 1, masterCode: "B-36", description: "Base", placement: "base",
  x: 0, y: 0, width: 36, depth: 24, rotation: 0, height: 34.5, ...o,
} as PlacedCabinet);
const area = (s: ReturnType<typeof countertopSurfaces>) => s.reduce((t, x) => t + (x.areaInches ?? x.width * x.depth), 0);

describe("shared countertop pass: inside 90° corner fill + interior pony-wall clip", () => {
  it("fills the open square at a regular-room inside L (no hole)", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
    const top = [0, 1, 2].map((i) => cab({ uid: `t${i}`, x: 24 + i * 36, y: 0, wallId: "top" }));
    const left = [0, 1].map((i) => cab({ uid: `l${i}`, x: 0, y: 24 + i * 36, width: 24, depth: 36, rotation: 90, wallId: "left" }));
    const s = countertopSurfaces([...top, ...left], room, null);
    // Tom, Nov 19 2026, 1:06 PM CT: both runs reach the corner, so they meet on a 45° miter seam instead of a separate square
    // fill. Same coverage (the whole 25.5 in square), no overlap, both slabs flagged mitered.
    expect(s.some((x) => x.cabinetRunId?.startsWith("corner-fill"))).toBe(false);
    const pair = s.filter((x) => x.insideCornerMiterKey);
    expect(pair.length).toBe(2);
    expect(pair.every((x) => x.miteredStart || x.miteredEnd)).toBe(true);
    const insidePoly = (pt: { x: number; y: number }, poly: { x: number; y: number }[]) => {
      let hit = false;
      for (let k = 0, m = poly.length - 1; k < poly.length; m = k++) {
        const a = poly[k]!, b = poly[m]!;
        if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
      }
      return hit;
    };
    let holes = 0, overlaps = 0;
    for (let x = 0.25; x < 25.5; x += 0.5) for (let y = 0.25; y < 25.5; y += 0.5) {
      const n = s.filter((slab) => insidePoly({ x, y }, countertopSurfacePlanPolygon(slab))).length;
      if (n === 0) holes += 1;
      if (n > 1) overlaps += 1;
    }
    expect(holes).toBe(0);
    expect(overlaps).toBe(0);
  });

  it("adds no fill when a corner cabinet already covers the corner", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
    const corner = cab({ uid: "c", x: 0, y: 0, width: 36, depth: 36, wallId: "top" });
    const s = countertopSurfaces([corner], room, null);
    expect(s.some((x) => x.cabinetRunId?.startsWith("corner-fill"))).toBe(false);
  });

  it("fills the inside 90° corner of a Continuous Wall room without moving the wall slabs", () => {
    const room = {
      width: 180, depth: 180, ceilingHeight: 96,
      vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 180, y: 0 }, { id: "c", x: 180, y: 96 }, { id: "d", x: 96, y: 96 }, { id: "e", x: 96, y: 180 }, { id: "f", x: 0, y: 180 }],
      customWalls: [["w1", "a", "b"], ["w2", "b", "c"], ["w3", "c", "d"], ["w4", "d", "e"], ["w5", "e", "f"], ["w6", "f", "a"]].map(([id, s, e]) => ({ id, startVertexId: s, endVertexId: e })),
    } as RoomData;
    const run = (wallId: string, offs: number[], w: number) => offs.map((o, i) => {
      const spot = wallPlacementAt(o, w, 24, wallId as never, room);
      return cab({ uid: wallId + i, width: w, ...spot, wallId, wallOffset: o });
    });
    const placed = [...run("w3", [0, 36], 36), ...run("w4", [24, 60], 24)];
    const s = countertopSurfaces(placed, room, null);
    expect(s.some((x) => x.cabinetRunId?.startsWith("corner-fill"))).toBe(true);
    // w3 is one continuous 36+36 slab. w4 carries two 24" cabinets 12" apart, and
    // a 12" empty gap is not support: the top ends at the first and starts again
    // at the second (owner rule — a top covers only the cabinets under it).
    expect(s.filter((x) => x.customWallId).length).toBe(3);
    const w4Spans = s
      .filter((x) => x.customWallId === "w4")
      .map((x) => ({ start: Number(x.customWallRunStartIn), end: Number(x.customWallRunStartIn) + Number(x.linearInches) }))
      .sort((left, right) => left.start - right.start);
    expect(w4Spans).toEqual([{ start: 24, end: 48 }, { start: 60, end: 84 }]);
  });

  it("never lets a top cross an interior pony wall", () => {
    const room = { width: 240, depth: 120, ceilingHeight: 96 } as RoomData;
    const top = [0, 1, 2, 3].map((i) => cab({ uid: `t${i}`, x: i * 36, y: 0, wallId: "top" }));
    const pony: PonyWall = { uid: "p", x: 70, y: 0, width: 4, depth: 60, height: 34.5 } as PonyWall;
    const before = countertopSurfaces(top, room, null);
    const after = countertopSurfaces(top, room, null, [pony]);
    const maxX = (list: typeof after) => Math.max(...list.flatMap((x) => countertopSurfacePlanPolygon(x).map((p) => p.x)));
    expect(maxX(before)).toBeGreaterThan(74);
    expect(maxX(after)).toBeLessThanOrEqual(70.01);
    expect(area(after)).toBeLessThan(area(before));
  });
});

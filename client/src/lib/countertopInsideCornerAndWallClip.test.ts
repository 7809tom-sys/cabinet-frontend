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
    const fill = s.find((x) => x.cabinetRunId?.startsWith("corner-fill"));
    expect(fill).toBeTruthy();
    expect(fill!.width).toBeCloseTo(25.5, 1);
    expect(fill!.x).toBeCloseTo(0, 1);
    expect(fill!.y).toBeCloseTo(0, 1);
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
    expect(s.filter((x) => x.customWallId).length).toBe(2);
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

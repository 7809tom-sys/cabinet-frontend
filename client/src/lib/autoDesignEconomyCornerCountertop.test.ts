import { describe, expect, it } from "vitest";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { isEconomicCornerFiller } from "./autoDesignEconomyCorner";
import { economyKeepClearShifts } from "./autoDesignEconomyKeepClear";
import { buildCountertopFabricationSheet } from "./countertopFabricationSheet";
import {
  wallPlacementAt,
  appliancesForRoom, applianceAsDesignCabinet, countertopSurfacePlanPolygon, countertopSurfaces, wallRunFrame,
  type CountertopSurface, type PlacedCabinet, type RoomData, type WallOpening,
} from "./design";

// Countertop continuity at the economic corner (Tom, voice, Nov 19 2026, 12:59 + 1:06 PM CT): the 3/4 in top is decorative and
// never yields to plumbing or a window; it covers every inside corner; two runs meet on a 45° miter seam. The old-construction
// kitchen (window 30-66 sill 42 over the sink, door 100-120) used to leave a 7.5 in break on the right wall at 24-33.
const pack = (matrix as any)["330014"];
const ROOM = { width: 120, depth: 120, ceilingHeight: 96 } as RoomData;
const WINDOW = (sill: number): WallOpening => ({ uid: "w1", kind: "window", label: "Window", side: "right", offset: 30, width: 36, height: 48, sill } as WallOpening);
const DOOR: WallOpening = { uid: "d1", kind: "door", label: "Door", side: "right", offset: 100, width: 20, height: 80 } as WallOpening;

function build(over: { openings?: WallOpening[]; canMove?: Partial<Record<"electrical" | "plumbing" | "rangeHookup" | "sinkBase", boolean | null>>; sinkC?: number } = {}) {
  let uid = 0;
  return runAutoDesignLayout({
    input: { layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36, stove: { wallLabel: "Wall 1", centerOffsetIn: 60 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: over.sinkC ?? 48 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular", dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "old", preferences: ["budget-friendly"], islandOrPeninsula: "none", canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true, ...over.canMove } } } as never,
    room: ROOM, openings: over.openings ?? [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])], styleId: 330014, makeUid: () => `s-${++uid}`,
  } as never) as any;
}

type Pt = { x: number; y: number };
const inside = (pt: Pt, poly: Pt[]) => {
  let hit = false;
  for (let k = 0, m = poly.length - 1; k < poly.length; m = k++) {
    const a = poly[k]!, b = poly[m]!;
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};
const cover = (tops: CountertopSurface[], pt: Pt) => tops.filter((s) => inside(pt, countertopSurfacePlanPolygon(s))).length;
/** Sample a rectangle on a 0.5 in grid (offset off the seams); returns holes (0 slabs) and overlaps (2+ slabs). */
function sample(tops: CountertopSurface[], x0: number, x1: number, y0: number, y1: number) {
  let holes = 0, overlaps = 0, total = 0;
  for (let x = x0 + 0.25; x < x1; x += 0.5) for (let y = y0 + 0.25; y < y1; y += 0.5) {
    const n = cover(tops, { x, y });
    total += 1;
    if (n === 0) holes += 1;
    if (n > 1) overlaps += 1;
  }
  return { holes, overlaps, total };
}
const cabinetsOn = (r: any, wallId: string, layer: "base" | "wall") => r.placed
  .filter((p: any) => p.wallId === wallId && (layer === "wall" ? p.placement === "wall" : p.placement !== "wall"))
  .map((p: any) => ({ code: p.masterCode, off: Number(p.wallOffset), w: Number(p.width) }))
  .sort((a: any, b: any) => a.off - b.off);

describe("old-construction 10x10 L, window over the sink (the 7.5 in break)", () => {
  const r = build({ openings: [WINDOW(42), DOOR] });
  const tops = countertopSurfaces(r.placed, ROOM, null);

  it("builds, and the sink + dishwasher slid 3 in under the window (a sill-42 window does not block the slide)", () => {
    expect(r.ok, r.message).toBe(true);
    expect(r.notes.some((n: string) => /economic corner keep-clear: the sink base \+ dishwasher on right slid 3″ toward the corner/i.test(n))).toBe(true);
    expect(r.notes.some((n: string) => /stays where it was measured/i.test(n))).toBe(false);
    const right = cabinetsOn(r, "right", "base");
    expect(right.find((c: any) => c.code === "F342")?.off).toBeCloseTo(24, 2);
    expect(right.find((c: any) => c.code === "SB36")?.off).toBeCloseTo(27, 2);
  });

  it("the countertop is continuous from the corner to the end of the right run: no hole, no overlap", () => {
    const rightSlab = tops.filter((s) => s.supportWallId === "right");
    const end = Math.max(...rightSlab.map((s) => s.y + s.depth));
    expect(end).toBeGreaterThan(90);
    const s = sample(tops, 94.5, 120, 0, end);
    expect(s.holes).toBe(0);
    expect(s.overlaps).toBe(0);
  });

  it("the top leg is continuous across the corner square and the 3 in filler seat too", () => {
    const top = tops.filter((s) => s.supportWallId === "top");
    const minX = Math.min(...top.map((s) => s.x));
    const s = sample(tops, Math.max(minX, 81), 120, 0, 25.5);
    expect(s.holes).toBe(0);
    expect(s.overlaps).toBe(0);
  });

  it("no upper cabinet lands in the window; the 3 in upper filler still sits over the corner seat", () => {
    const uppers = cabinetsOn(r, "right", "wall");
    for (const u of uppers) expect(u.off + u.w <= 30.01 || u.off >= 66 - 0.01, `${u.code} ${u.off}-${u.off + u.w}`).toBe(true);
    expect(uppers.some((u: any) => u.code === "F342" && Math.abs(u.off - 24) < 0.05)).toBe(true);
  });

  it("the economic fillers carry the 45° miter as data (plan draws the cut), base and upper", () => {
    const fillers = r.placed.filter((p: any) => isEconomicCornerFiller(p));
    expect(fillers.length).toBe(4);
    for (const f of fillers) {
      expect(f.fillerMiterAngle).toBe(45);
      expect(["start", "end"]).toContain(f.fillerMiteredEnd);
    }
  });
});

describe("45° miter seam at the inside corner", () => {
  const r = build({ openings: [WINDOW(42), DOOR] });
  const tops = countertopSurfaces(r.placed, ROOM, null);
  const pair = tops.filter((s) => s.insideCornerMiterKey);

  it("two slabs share one miter key, both flagged mitered, no square corner-fill left", () => {
    expect(pair.length).toBe(2);
    expect(new Set(pair.map((s) => s.insideCornerMiterKey)).size).toBe(1);
    expect(pair.every((s) => s.miteredStart || s.miteredEnd)).toBe(true);
    expect(tops.some((s) => s.cabinetRunId?.startsWith("corner-fill"))).toBe(false);
  });

  it("the seam is the diagonal from the room corner (120,0) to the inside corner point (94.5,25.5)", () => {
    const [top, right] = [pair.find((s) => s.supportWallId === "top")!, pair.find((s) => s.supportWallId === "right")!];
    expect(top && right).toBeTruthy();
    // Points just on each side of the diagonal y = 120 - x belong to exactly one slab.
    expect(inside({ x: 100, y: 10 }, countertopSurfacePlanPolygon(top))).toBe(true);   // above the diagonal: top run
    expect(inside({ x: 100, y: 10 }, countertopSurfacePlanPolygon(right))).toBe(false);
    expect(inside({ x: 115, y: 20 }, countertopSurfacePlanPolygon(right))).toBe(true); // below it: right run
    expect(inside({ x: 115, y: 20 }, countertopSurfacePlanPolygon(top))).toBe(false);
    const has = (s: CountertopSurface, p: Pt) => countertopSurfacePlanPolygon(s).some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.01);
    for (const s of [top, right]) {
      expect(has(s, { x: 120, y: 0 })).toBe(true);
      expect(has(s, { x: 94.5, y: 25.5 })).toBe(true);
    }
  });

  it("no overlap and no hole over the whole 25.5 in corner square", () => {
    const s = sample(tops, 94.5, 120, 0, 25.5);
    expect(s.holes).toBe(0);
    expect(s.overlaps).toBe(0);
  });

  it("the run notes name the miter, and the fabrication sheet lists exactly one 45° mitered joint for the corner", () => {
    expect(r.notes.some((n: string) => /45° miter seam at the inside corner/.test(n))).toBe(true);
    const sheet = buildCountertopFabricationSheet({ room: ROOM, placed: r.placed, sinks: r.sinks ?? [], now: new Date("2026-11-19T12:00:00Z") } as never);
    const joints = sheet.corners.filter((c: any) => c.kind === "45° mitered joint");
    expect(joints.length).toBe(1);
    expect(joints[0]!.notes.join(" ")).toMatch(/45° miter seam/);
  });
});

describe("countertop wins over plumbing (Tom, 1:06 PM CT)", () => {
  it("sink/plumbing cannot move: the sink stays, the 3 in filler is seated, the top bridges the open run and a warning says so", () => {
    const r = build({ openings: [WINDOW(42), DOOR], canMove: { plumbing: false, sinkBase: false } });
    expect(r.ok, r.message).toBe(true);
    const right = cabinetsOn(r, "right", "base");
    const sink = right.find((c: any) => c.code === "SB36")!;
    expect(sink.off).toBeCloseTo(30, 2); // measured 48 center - 18: not moved
    expect(right.find((c: any) => c.code === "F342")?.off).toBeCloseTo(24, 2);
    expect((r.warnings as string[]).some((w) => /economic corner on right — 3″ of open run is left between the corner filler and SB36.*countertop bridges it/.test(w))).toBe(true);
    const tops = countertopSurfaces(r.placed, ROOM, null);
    const end = Math.max(...tops.filter((s) => s.supportWallId === "right").map((s) => s.y + s.depth));
    const s = sample(tops, 94.5, 120, 0, end);
    expect(s.holes).toBe(0);
    expect(s.overlaps).toBe(0);
  });

  it("no window at all: same continuous result as before", () => {
    const r = build({ openings: [DOOR] });
    const tops = countertopSurfaces(r.placed, ROOM, null);
    const end = Math.max(...tops.filter((s) => s.supportWallId === "right").map((s) => s.y + s.depth));
    const s = sample(tops, 94.5, 120, 0, end);
    expect(s.holes).toBe(0);
    expect(s.overlaps).toBe(0);
  });
});

describe("keep-clear opening and lock rules", () => {
  const anchors = [
    { kind: "sink", wallId: "right" as const, along: 30, width: 36, depth: 24, group: "sink" },
    { kind: "refrigerator", wallId: "top" as const, along: 0, width: 36, depth: 24, group: "refrigerator" },
  ];
  const base = { anchors, movableKinds: ["sink", "dishwasher", "stove"], room: ROOM, frameOf: (wallId: any) => wallRunFrame(wallId, ROOM) };
  it("a window with a 42 in sill does not block; a 30 in sill and a door do", () => {
    expect(economyKeepClearShifts({ ...base, openings: [WINDOW(42)] }).shifts.get("sink")).toBe(-3);
    expect(economyKeepClearShifts({ ...base, openings: [WINDOW(30)] }).shifts.size).toBe(0);
    expect(economyKeepClearShifts({ ...base, openings: [{ ...DOOR, offset: 40, width: 30 }] }).shifts.size).toBe(0);
  });
  it("a locked anchor never slides and the note says the counter bridges the gap", () => {
    const out = economyKeepClearShifts({ ...base, openings: [], lockedKinds: ["sink", "dishwasher"] });
    expect(out.shifts.size).toBe(0);
    expect(out.notes.join(" ")).toMatch(/cannot move, so it stays and the countertop bridges the gap/);
  });
});

describe("every inside corner is mitered (shared closeInsideCornersAndClipInteriorWalls)", () => {
  const cab = (o: Partial<PlacedCabinet>): PlacedCabinet => ({
    uid: "u", cabinetId: 1, masterCode: "B-36", description: "Base", placement: "base",
    x: 0, y: 0, width: 36, depth: 24, rotation: 0, height: 34.5, ...o,
  } as PlacedCabinet);
  it("a regular L with a 24 in open corner: two mitered slabs, no hole, no overlap, run lengths include the corner", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
    const top = [0, 1, 2].map((i) => cab({ uid: `t${i}`, x: 24 + i * 36, y: 0, wallId: "top" }));
    const left = [0, 1].map((i) => cab({ uid: `l${i}`, x: 0, y: 24 + i * 36, width: 24, depth: 36, rotation: 90, wallId: "left" }));
    const tops = countertopSurfaces([...top, ...left], room, null);
    // The left wall has a second slab past a 12 in open gap (not part of the corner); the two corner runs are mitered.
    const pair = tops.filter((s) => s.insideCornerMiterKey);
    expect(pair.length).toBe(2);
    expect(pair.every((s) => s.miteredStart || s.miteredEnd)).toBe(true);
    const s = sample(tops, 0, 25.5, 0, 25.5);
    expect(s.holes).toBe(0);
    expect(s.overlaps).toBe(0);
    expect(inside({ x: 10, y: 3 }, countertopSurfacePlanPolygon(tops.find((t) => t.supportWallId === "top")!))).toBe(true);
    expect(inside({ x: 3, y: 10 }, countertopSurfacePlanPolygon(tops.find((t) => t.supportWallId === "left")!))).toBe(true);
  });
  it("one run only (nothing on the other wall): no seam to cut, the square corner top is kept", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
    const tops = countertopSurfaces([cab({ uid: "t0", x: 0, y: 0, wallId: "top" })], room, null);
    expect(tops.some((s) => s.insideCornerMiterKey)).toBe(false);
  });
  it("a Continuous Wall room's inside 90° corner is mitered too, and the run metadata follows the extension", () => {
    const room = {
      width: 180, depth: 180, ceilingHeight: 96,
      vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 180, y: 0 }, { id: "c", x: 180, y: 180 }, { id: "d", x: 0, y: 180 }],
      customWalls: [["w1", "a", "b"], ["w2", "b", "c"], ["w3", "c", "d"], ["w4", "d", "a"]].map(([id, st, en]) => ({ id, startVertexId: st, endVertexId: en })),
    } as RoomData;
    const run = (wallId: string, offs: number[], w: number) => offs.map((o, i) => {
      const spot = wallPlacementAt(o, w, 24, wallId as never, room);
      return cab({ uid: wallId + i, width: w, ...spot, wallId, wallOffset: o });
    });
    // w1 ends 24 in short of corner b (a 24 in open corner square), w2 starts 24 in past it: both reach the 25.5 in square.
    const placed = [...run("w1", [96, 132], 36), ...run("w2", [24, 60], 36)];
    const tops = countertopSurfaces(placed, room, null);
    const pair = tops.filter((x) => x.insideCornerMiterKey);
    expect(pair.length).toBe(2);
    expect(pair.map((x) => x.customWallId).sort()).toEqual(["w1", "w2"]);
    expect(tops.some((x) => x.cabinetRunId?.startsWith("corner-fill"))).toBe(false);
    for (const slab of pair) {
      expect(slab.miteredStart || slab.miteredEnd).toBe(true);
      expect(Number(slab.customWallRunStartIn)).toBeGreaterThanOrEqual(0);
    }
    const w1 = pair.find((x) => x.customWallId === "w1")!;
    expect(Number(w1.customWallRunStartIn) + Number(w1.linearInches)).toBeGreaterThan(179); // run now reaches corner b
    const s = sample(tops, 154.5, 180, 0, 25.5);
    expect(s.holes).toBe(0);
    expect(s.overlaps).toBe(0);
  });
});

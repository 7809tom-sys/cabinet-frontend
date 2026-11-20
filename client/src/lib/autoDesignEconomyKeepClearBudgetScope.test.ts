import { describe, expect, it } from "vitest";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { isEconomicCornerFiller } from "./autoDesignEconomyCorner";
import { economyKeepClearShifts } from "./autoDesignEconomyKeepClear";
import {
  appliancesForRoom, applianceAsDesignCabinet, cabinetWall, isRangeOrOven, isSinkBaseCabinet,
  wallRunFrame, wallRunOffset, wallRunSpan, DEFAULT_ROOM,
  type PlacedCabinet, type RoomData,
} from "./design";

// Tom, owner voice, Nov 20 2026, 11:03 AM CT: economic-corner keep-clear is budget mode only.
// Outside budget it must not reserve the 27 in footprint or move the range or sink, on any cabinet line.
// Standard-mode centerlines below are the pre-4c35444 (keep-clear) positions from the fixed-room sweep
// (rect-U range −3 and angled-45 sink +1 / range −2 were already present on 95a30bb / 3486f67).
// Budget mode must still reserve the 27 in keep-clear exactly as before (rect-U range +3, angled-45 sink +3.75).

const pack = (matrix as any)["330014"];

const RECT = { width: 170, depth: 170, ceilingHeight: 96 } as RoomData;
const L10 = { width: 120, depth: 120, ceilingHeight: 96 } as RoomData;
const ANGLED = {
  width: 220, depth: 180, ceilingHeight: 96, openWallPath: true,
  vertices: [
    { id: "v1", x: 0, y: 0 }, { id: "v2", x: 168, y: 0 }, { id: "v3", x: 168, y: 72 },
    { id: "v4", x: 108, y: 132 }, { id: "v5", x: 40, y: 132 },
  ],
  customWalls: [
    { id: "w1", label: "Wall 1", startVertexId: "v1", endVertexId: "v2" },
    { id: "w2", label: "Wall 2", startVertexId: "v2", endVertexId: "v3" },
    { id: "w3", label: "Wall 3", startVertexId: "v3", endVertexId: "v4", lockedAngle: 45 },
    { id: "w4", label: "Wall 4", startVertexId: "v4", endVertexId: "v5" },
  ],
} as unknown as RoomData;

type Plan = {
  name: string;
  room: RoomData;
  layout: string;
  sink: [string, number];
  stove: [string, number];
  fridge: [string, number];
  openings: any[];
  noDw?: boolean;
};

function build(plan: Plan, budget: boolean, over: { sinkC?: number; dw?: "left" | "right" | "none" } = {}) {
  let uid = 0;
  const dw = over.dw ?? (plan.noDw ? "none" : "right");
  return runAutoDesignLayout({
    input: {
      layoutType: plan.layout, originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: plan.fridge[0], centerOffsetIn: plan.fridge[1] }, refrigeratorWidthIn: 36,
      stove: { wallLabel: plan.stove[0], centerOffsetIn: plan.stove[1] },
      sink: { wallLabel: plan.sink[0], centerOffsetIn: over.sinkC ?? plan.sink[1] }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      dishwasherSide: dw, skipDishwasher: dw === "none" || Boolean(plan.noDw), overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: {
        ...emptyAutoDesignIntake(), construction: "new",
        preferences: budget ? ["budget-friendly"] : [],
        islandOrPeninsula: "none",
        canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true },
      },
    } as never,
    room: plan.room, openings: plan.openings, baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])],
    styleId: 330014, makeUid: () => `s-${++uid}`,
  } as never) as any;
}

function centerOf(placed: PlacedCabinet[], room: RoomData, pred: (p: PlacedCabinet) => boolean) {
  const item = placed.find(pred);
  if (!item) return null;
  const wall = cabinetWall(item, { ...DEFAULT_ROOM, ...room } as RoomData);
  const resolved = { ...DEFAULT_ROOM, ...room } as RoomData;
  return Math.round((wallRunOffset(item, wall, resolved) + wallRunSpan(item, wall, resolved) / 2) * 100) / 100;
}

function sinkCenter(r: any, room: RoomData) {
  return centerOf(r.placed, room, (p) => p.placement === "base" && isSinkBaseCabinet(p));
}
function rangeCenter(r: any, room: RoomData) {
  return centerOf(r.placed, room, (p) => p.placement === "appliance" && isRangeOrOven(p.masterCode, p.description));
}
function keepClearNotes(r: any): string[] {
  return (r.notes as string[]).filter((n) => /economic corner keep-clear/i.test(n));
}

const RECT_U: Plan = {
  name: "rect-U 170x170",
  room: RECT, layout: "u-shape",
  sink: ["Wall 1", 85], stove: ["Wall 2", 54], fridge: ["Wall 3", 60],
  openings: [{ uid: "win", kind: "window", label: "w", side: "top", offset: 67, width: 36, height: 42, sill: 42 }],
};
const ANGLED_45: Plan = {
  name: "angled-45",
  room: ANGLED, layout: "u-shape",
  sink: ["Wall 3", 40], stove: ["Wall 2", 36], fridge: ["Wall 1", 18],
  openings: [{ uid: "win", kind: "window", label: "w", side: "w3", offset: 15, width: 36, height: 42, sill: 42 }],
  noDw: true,
};
const L_10: Plan = {
  name: "10x10 L",
  room: L10, layout: "l-shape",
  sink: ["Wall 2", 66], stove: ["Wall 1", 60], fridge: ["Wall 1", 18],
  openings: [],
};

describe("economyKeepClearShifts budgetMode scope", () => {
  const insideFootprint = {
    anchors: [
      { kind: "sink" as const, wallId: "right" as const, along: 10, width: 36, depth: 24, group: "sink" },
      { kind: "stove" as const, wallId: "top" as const, along: 80, width: 30, depth: 24, group: "stove" },
    ],
    movableKinds: ["sink", "dishwasher", "stove"],
    room: L10,
    openings: [] as const,
    frameOf: (wallId: "top" | "right" | "bottom" | "left") => wallRunFrame(wallId, L10),
  };

  it("budgetMode false: no shift and no note, even when the sink sits in the 27 in footprint", () => {
    const out = economyKeepClearShifts({ ...insideFootprint, budgetMode: false });
    expect(out.shifts.size).toBe(0);
    expect(out.notes).toEqual([]);
  });

  it("budgetMode true: still slides the sink clear of the 27 in footprint", () => {
    const out = economyKeepClearShifts({ ...insideFootprint, budgetMode: true });
    expect(out.shifts.get("sink")).toBeGreaterThan(0);
    expect(out.notes.some((n) => /economic corner keep-clear/i.test(n))).toBe(true);
  });
});

describe("keep-clear applies only in budget mode (Tom, Nov 20 2026, 11:03 AM CT)", () => {
  it("standard rect-U: range and sink centerlines match pre-4c35444 (sink 0, range −3); no keep-clear", () => {
    const r = build(RECT_U, false);
    expect(r.ok, r.message).toBe(true);
    expect(keepClearNotes(r)).toEqual([]);
    expect(r.placed.some((p: PlacedCabinet) => isEconomicCornerFiller(p))).toBe(false);
    expect(sinkCenter(r, RECT)).toBeCloseTo(85, 2);
    expect(rangeCenter(r, RECT)).toBeCloseTo(51, 2); // 54 − 3, the pre-keep-clear wiggle
  });

  it("budget rect-U: still reserves the 27 in keep-clear and slides the range +3, as before", () => {
    const r = build(RECT_U, true);
    expect(r.ok, r.message).toBe(true);
    expect(r.notes.some((n: string) => /economy corner — no corner cabinet|keep-clear/i.test(n))).toBe(true);
    expect(sinkCenter(r, RECT)).toBeCloseTo(85, 2);
    expect(rangeCenter(r, RECT)).toBeCloseTo(57, 2); // 54 + 3
    expect(r.placed.some((p: PlacedCabinet) => isEconomicCornerFiller(p))).toBe(true);
    // Nothing but the 3 in economic filler sits inside each accepted 27 in leg footprint on the range wall (right).
    const inside = r.placed.filter((p: any) => p.wallId === "right" && p.placement !== "wall" && !isEconomicCornerFiller(p)
      && Number(p.wallOffset) < 26.95);
    expect(inside.map((p: any) => p.masterCode)).toEqual([]);
  });

  it("standard angled-45: range and sink centerlines match pre-4c35444 (sink +1, range −2); no keep-clear", () => {
    const r = build(ANGLED_45, false);
    expect(r.ok, r.message).toBe(true);
    expect(keepClearNotes(r)).toEqual([]);
    expect(r.placed.some((p: PlacedCabinet) => isEconomicCornerFiller(p))).toBe(false);
    expect(sinkCenter(r, ANGLED)).toBeCloseTo(41, 2); // 40 + 1
    expect(rangeCenter(r, ANGLED)).toBeCloseTo(34, 2); // 36 − 2
  });

  it("budget angled-45: still reserves the 27 in keep-clear and slides the sink +3.75, as before", () => {
    const r = build(ANGLED_45, true);
    expect(r.ok, r.message).toBe(true);
    expect(keepClearNotes(r).length + (r.notes as string[]).filter((n: string) => /economy corner/i.test(n)).length).toBeGreaterThan(0);
    expect(sinkCenter(r, ANGLED)).toBeCloseTo(43.75, 2); // 40 + 3.75
    expect(rangeCenter(r, ANGLED)).toBeCloseTo(34, 2);
    // A 45° leg may not seat an F342; the keep-clear effect is the sink slide out of the 27 in footprint.
  });

  it("standard 10x10 L: a sink+DW that would be slid in budget stays at the measured spot; no keep-clear", () => {
    const r = build(L_10, false, { sinkC: 66, dw: "left" });
    expect(r.ok, r.message).toBe(true);
    expect(keepClearNotes(r)).toEqual([]);
    expect(r.notes.some((n: string) => /economy corner — no corner cabinet/i.test(n))).toBe(false);
    expect(r.placed.some((p: PlacedCabinet) => isEconomicCornerFiller(p))).toBe(false);
    const dw = r.placed.find((p: any) => p.masterCode === "DW-24");
    expect(dw).toBeTruthy();
    // Budget keep-clear would put this dishwasher at 27. Standard leaves it at the measured 24 in start (48 center → 24 start for a 24 in DW left of an SB36 at c66: SB 48-84, DW 24-48).
    expect(Number(dw.wallOffset)).toBeCloseTo(24, 2);
  });

  it("budget 10x10 L: the same sink+DW is still slid 3 in clear of the 27 in footprint", () => {
    const r = build(L_10, true, { sinkC: 66, dw: "left" });
    expect(r.ok, r.message).toBe(true);
    expect(keepClearNotes(r).some((n) => /sink base \+ dishwasher on right slid 3″ away from the corner/i.test(n))).toBe(true);
    expect(r.placed.find((p: any) => p.masterCode === "DW-24")!.wallOffset).toBeCloseTo(27, 2);
    for (const wallId of ["top", "right"]) {
      const inside = r.placed.filter((p: any) => p.wallId === wallId && p.placement !== "wall" && !isEconomicCornerFiller(p)
        && (wallId === "right" ? Number(p.wallOffset) < 26.95 : Number(p.wallOffset) + Number(p.width) > 120 - 26.95 + 0.01));
      expect(inside.map((p: any) => p.masterCode), wallId).toEqual([]);
    }
  });
});

import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake, type AutoDesignIntake } from "./autoDesignFifteenRules";
import type { AutoDesignInputs, AutoDesignLayoutType } from "./autoDesignAutoBuild";
import { buildAutoDesignRulesReport } from "./designerReviewFindings";
import { DEFAULT_ROOM, cabinetWall, isPanelItem, isSinkBaseCabinet, wallRunOffset, wallRunSpan, type DesignCabinet, type PlacedCabinet } from "./design";

// Tom, Nov 23 2026 (COS-57, bug 2): on a line that finishes the sink base with a
// 3/4 in end panel beside the dishwasher (540005), a dishwasher measured flush to
// a wall end was pushed 3/4 in away from the sink base, past the wall, and then
// removed by the bounds pass. The panel room now comes from the cabinet side.
type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const CATALOG = matrixCatalog as unknown as Record<string, Pack>;
const appliance = (code: string, w: number, d: number, h: number) => ({ id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance", width: String(w), depth: String(d), height: String(h), placement: "appliance" }) as DesignCabinet;
const PALETTE = [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70)];
const at = (wallLabel: string, centerOffsetIn: number) => ({ wallLabel, centerOffsetIn });

type Case = { layoutType: AutoDesignLayoutType; sink: ReturnType<typeof at>; side: "left" | "right"; stove: ReturnType<typeof at>; sinkCanMove?: boolean; rangeCanMove?: boolean };

function build(c: Case, style = "540005") {
  const intake: AutoDesignIntake = {
    ...emptyAutoDesignIntake(),
    construction: "new",
    canMove: { electrical: true, plumbing: true, rangeHookup: c.rangeCanMove ?? true, sinkBase: c.sinkCanMove ?? true },
    preferences: [],
  };
  const input = {
    intake, layoutType: c.layoutType, originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
    sink: c.sink, sinkBaseWidthIn: 36, sinkBaseKind: "regular", stove: c.stove,
    dishwasher: null, skipDishwasher: false, dishwasherSide: c.side,
    refrigerator: null, refrigeratorWidthIn: 36, refrigeratorPanels: "both", refrigeratorEnclosure: "cabinet-above",
    sinkWindowCenter: null, overRangeAnswer: "microwave-bridge",
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
  } as AutoDesignInputs;
  const pack = CATALOG[style]!;
  let uid = 0;
  const run = runAutoDesignLayout({
    input, room: DEFAULT_ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: PALETTE, refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])],
    styleId: Number(style), makeUid: () => `d-${++uid}`,
  });
  if (!run.ok) throw new Error(run.message);
  return run;
}

const span = (item: PlacedCabinet) => {
  const wall = cabinetWall(item, DEFAULT_ROOM)!;
  const start = wallRunOffset(item, wall, DEFAULT_ROOM);
  return { wall, start, end: start + wallRunSpan(item, wall, DEFAULT_ROOM) };
};
const only = (run: AutoDesignLayoutSuccess, test: RegExp) => {
  const list = run.placed.filter((item) => test.test(item.masterCode ?? ""));
  expect(list.map((item) => item.masterCode), `${test} placed once`).toHaveLength(1);
  return list[0]!;
};
const report = (run: AutoDesignLayoutSuccess) => [...buildAutoDesignRulesReport(run.reviewFindings).unmet, ...run.warnings].join("\n");

describe("Auto-Design keeps an appliance measured flush to a wall end (end-panel line)", () => {
  it("single wall: range flush at the wall start, dishwasher flush at the wall end", () => {
    const run = build({ layoutType: "single-wall", stove: at("Wall 1", 15), sink: at("Wall 1", 102), side: "right" });
    const dw = span(only(run, /^DW-/));
    const range = span(only(run, /^RANGE/));
    expect(dw).toMatchObject({ start: 120, end: 144 });
    expect(range.start).toBeGreaterThanOrEqual(0);
    expect(range.end).toBeLessThanOrEqual(144);
    // The 3/4 in end panel sits between the sink base and the dishwasher; the sink base gave up the room.
    const sinkBase = span(run.placed.find((item) => item.placement === "base" && isSinkBaseCabinet(item))!);
    const panel = run.placed.filter((item) => isPanelItem(item)).map(span).find((p) => Math.abs(p.end - 120) < 0.01);
    expect(panel, "end panel against the dishwasher").toBeTruthy();
    expect(sinkBase.end).toBeCloseTo(119.25, 2);
    expect(Math.abs(sinkBase.start - 84)).toBeLessThanOrEqual(3);
    expect(report(run)).not.toMatch(/left the room bounds|was removed/);
  });

  it("single wall: dishwasher flush at the wall start, range flush at the wall end", () => {
    const run = build({ layoutType: "single-wall", stove: at("Wall 1", 129), sink: at("Wall 1", 42), side: "left" });
    expect(span(only(run, /^DW-/))).toMatchObject({ start: 0, end: 24 });
    const range = span(only(run, /^RANGE/));
    expect(range.start).toBeGreaterThanOrEqual(0);
    expect(range.end).toBeLessThanOrEqual(144);
    expect(report(run)).not.toMatch(/left the room bounds|was removed/);
  });

  it("L-shape: dishwasher flush at the end of Wall 2", () => {
    const run = build({ layoutType: "l-shape", stove: at("Wall 1", 15), sink: at("Wall 2", 78), side: "right" });
    expect(span(only(run, /^DW-/))).toMatchObject({ start: 96, end: 120 });
    expect(report(run)).not.toMatch(/left the room bounds|was removed/);
  });

  it("when the sink base cannot move either, both stay put and the missing panel is named", () => {
    const run = build({ layoutType: "single-wall", stove: at("Wall 1", 15), sink: at("Wall 1", 102), side: "right", sinkCanMove: false });
    expect(span(only(run, /^DW-/))).toMatchObject({ start: 120, end: 144 });
    expect(report(run)).not.toMatch(/left the room bounds|was removed/);
    expect(run.reviewFindings.some((f) => f.code === "sink-dw-panel-no-room-at-wall-end")).toBe(true);
  });

  it("a range that cannot move, right against the sink base, is not overlapped to make panel room", () => {
    const run = build({ layoutType: "single-wall", stove: at("Wall 1", 69), sink: at("Wall 1", 102), side: "right", rangeCanMove: false });
    expect(span(only(run, /^DW-/))).toMatchObject({ start: 120, end: 144 });
    const range = span(only(run, /^RANGE/));
    const sinkBase = span(run.placed.find((item) => item.placement === "base" && isSinkBaseCabinet(item))!);
    expect(Math.min(range.end, sinkBase.end) - Math.max(range.start, sinkBase.start)).toBeLessThanOrEqual(0.01);
    expect(report(run)).not.toMatch(/left the room bounds|was removed/);
    expect(run.reviewFindings.some((f) => f.code === "sink-dw-panel-no-room-at-wall-end")).toBe(true);
  });

  it("a dishwasher with free room past it still steps 3/4 in for the panel, as before", () => {
    const run = build({ layoutType: "single-wall", stove: at("Wall 1", 15), sink: at("Wall 1", 51), side: "right" });
    expect(span(only(run, /^DW-/)).start).toBeCloseTo(66.75, 2);
  });
});

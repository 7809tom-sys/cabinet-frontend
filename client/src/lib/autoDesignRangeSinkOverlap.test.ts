import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake, type AutoDesignIntake, type PreferenceId } from "./autoDesignFifteenRules";
import type { AutoDesignInputs, AutoDesignLayoutType } from "./autoDesignAutoBuild";
import { DEFAULT_ROOM, cabinetWall, wallRunOffset, wallRunSpan, type DesignCabinet } from "./design";

// Tom, Nov 23 2026: on the default room, single wall with no optional answers,
// line 510004 built RANGE-30 at 0 3/8-30 3/8 and SB36 at 30 1/4-66 1/4 (1/8 in.
// into each other), and line 540005 left SB36 1/8 in. inside the TEP3096 end panel
// beside the dishwasher. The run planner (planRun) accepted a 1/8 in. overlap
// between neighbours as "touching", so the range and the sink base wiggled by
// amounts 1/8 in. apart. No two floor pieces may ever share floor.
type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const CATALOG = matrixCatalog as unknown as Record<string, Pack>;
const appliance = (code: string, w: number, d: number, h: number) => ({ id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance", width: String(w), depth: String(d), height: String(h), placement: "appliance" }) as DesignCabinet;
const PALETTE = [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70)];

/** The Auto-Design dialog's starting centers on the default room (sink, range, refrigerator). */
const CENTERS: Record<string, [string, number, string, number, string, number]> = {
  "single-wall": ["Wall 1", 51, "Wall 1", 18, "Wall 1", 124.5],
  galley: ["Wall 1", 60, "Wall 3", 30, "Wall 3", 124.5],
  "l-shape": ["Wall 2", 69, "Wall 1", 69, "Wall 1", 19.5],
  "u-shape": ["Wall 1", 54, "Wall 2", 60, "Wall 3", 19.5],
};

function build(layoutType: AutoDesignLayoutType, style: string, preferences: PreferenceId[]) {
  const c = CENTERS[layoutType]!;
  const intake: AutoDesignIntake = { ...emptyAutoDesignIntake(), construction: "new", canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true }, preferences };
  const input = {
    intake, layoutType, originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
    sink: { wallLabel: c[0], centerOffsetIn: c[1] }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
    stove: { wallLabel: c[2], centerOffsetIn: c[3] }, dishwasher: null, skipDishwasher: false, dishwasherSide: "right",
    refrigerator: { wallLabel: c[4], centerOffsetIn: c[5] }, refrigeratorWidthIn: 36, refrigeratorPanels: "both", refrigeratorEnclosure: "cabinet-above",
    sinkWindowCenter: null, overRangeAnswer: "microwave-bridge",
    kitchenUsage: preferences.length ? { uses: ["everyday-cooking"], skipped: false, acceptedSuggestionIds: [] } : { uses: [], skipped: true, acceptedSuggestionIds: [] },
  } as unknown as AutoDesignInputs;
  const pack = CATALOG[style]!;
  let uid = 0;
  return runAutoDesignLayout({
    input, room: DEFAULT_ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: PALETTE, refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])],
    styleId: Number(style), makeUid: () => `d-${++uid}`,
  });
}

/** Every pair of floor pieces (bases, appliances, panels, fillers, talls) on one wall that shares floor. */
function floorOverlaps(run: AutoDesignLayoutSuccess): string[] {
  const spans = run.placed
    .filter((item) => item.placement !== "wall")
    .flatMap((item) => {
      const wall = cabinetWall(item, DEFAULT_ROOM);
      if (!wall) return [];
      const start = wallRunOffset(item, wall, DEFAULT_ROOM);
      return [{ code: item.masterCode, wall, start, end: start + wallRunSpan(item, wall, DEFAULT_ROOM) }];
    });
  const out: string[] = [];
  for (let i = 0; i < spans.length; i += 1) {
    for (let j = i + 1; j < spans.length; j += 1) {
      const a = spans[i]!;
      const b = spans[j]!;
      if (a.wall !== b.wall) continue;
      const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      if (overlap > 0.001) out.push(`${a.code} ${a.start}-${a.end} overlaps ${b.code} ${b.start}-${b.end} on ${a.wall} by ${overlap}`);
    }
  }
  return out;
}

describe("Auto-Design never leaves two floor pieces 1/8 in. inside each other", () => {
  it("510004 single wall, no optional answers: the range and the sink base butt exactly", () => {
    const run = build("single-wall", "510004", []);
    if (!run.ok) throw new Error(run.message);
    expect(floorOverlaps(run)).toEqual([]);
    const range = run.placed.find((item) => /^RANGE/.test(item.masterCode))!;
    const sinkBase = run.placed.find((item) => item.masterCode === "SB36")!;
    expect(wallRunOffset(range, "top", DEFAULT_ROOM) + wallRunSpan(range, "top", DEFAULT_ROOM)).toBe(wallRunOffset(sinkBase, "top", DEFAULT_ROOM));
  });

  it("540005 single wall, no optional answers: the sink base stays out of the end panel beside the dishwasher", () => {
    const run = build("single-wall", "540005", []);
    if (!run.ok) throw new Error(run.message);
    expect(floorOverlaps(run)).toEqual([]);
  });

  it("no line and no default layout overlaps on the floor", () => {
    const found: string[] = [];
    for (const layoutType of Object.keys(CENTERS) as AutoDesignLayoutType[]) {
      for (const preferences of [["budget-friendly"], []] as PreferenceId[][]) {
        for (const style of Object.keys(CATALOG)) {
          const run = build(layoutType, style, preferences);
          if (!run.ok) continue;
          for (const line of floorOverlaps(run)) found.push(`${layoutType} [${preferences.join(",")}] ${style}: ${line}`);
        }
      }
    }
    expect(found).toEqual([]);
  }, 120000);
});

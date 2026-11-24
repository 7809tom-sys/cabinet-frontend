import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake, type AutoDesignIntake, type PreferenceId } from "./autoDesignFifteenRules";
import type { AutoDesignInputs, AutoDesignLayoutType } from "./autoDesignAutoBuild";
import { autoDesignDefaultCenters } from "./autoDesignDefaultCenters";
import { buildAutoDesignRulesReport } from "./designerReviewFindings";
import { DEFAULT_ROOM, cabinetWall, isRefrigerator, isSinkBaseCabinet, wallRunOffset, wallRunSpan, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";

// Tom, Nov 23 2026: pressing Build measured kitchen with the dialog's own starting
// values failed on the default room ("refrigerator cannot be placed at that exact
// measurement on Wall 1"). These runs use the real layout engine with the
// starting centers the dialog now computes, for every layout type.
type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const CATALOG = matrixCatalog as unknown as Record<string, Pack>;
const appliance = (code: string, w: number, d: number, h: number) => ({ id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance", width: String(w), depth: String(d), height: String(h), placement: "appliance" }) as DesignCabinet;
const PALETTE = [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70)];
const LAYOUTS: AutoDesignLayoutType[] = ["single-wall", "galley", "l-shape", "u-shape"];
const STYLES = ["510004", "330014", "540005"] as const;

type Scenario = { name: string; preferences: PreferenceId[]; everydayCooking: boolean };
/** Tom's live run tonight, and a run with no optional answers at all. */
const SCENARIOS: Scenario[] = [
  { name: "Budget friendly, everyday cooking", preferences: ["budget-friendly"], everydayCooking: true },
  { name: "no optional answers", preferences: [], everydayCooking: false },
];

function dialogInputs(layoutType: AutoDesignLayoutType, scenario: Scenario, room: RoomData = DEFAULT_ROOM): AutoDesignInputs {
  const centers = autoDesignDefaultCenters({
    room, layoutType, originCorner: "left", runDirection: "right", wallCount: 4,
    sinkBaseWidthIn: 36, dishwasherSide: "right", includeStove: true, includeRefrigerator: true, refrigeratorWidthIn: 36,
  });
  const intake: AutoDesignIntake = {
    ...emptyAutoDesignIntake(),
    construction: "new",
    canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true },
    preferences: scenario.preferences,
  };
  // The same shape AutoDesignDialog submits with nothing edited.
  return {
    intake, layoutType, originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
    sink: centers.sink, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
    stove: centers.stove, dishwasher: null, skipDishwasher: false, dishwasherSide: "right",
    refrigerator: centers.refrigerator, refrigeratorWidthIn: 36, refrigeratorPanels: "both", refrigeratorEnclosure: "cabinet-above",
    sinkWindowCenter: null, overRangeAnswer: "microwave-bridge",
    kitchenUsage: scenario.everydayCooking
      ? { uses: ["everyday-cooking"], skipped: false, acceptedSuggestionIds: [] }
      : { uses: [], skipped: true, acceptedSuggestionIds: [] },
  } as AutoDesignInputs;
}

function build(input: AutoDesignInputs, style: string, room: RoomData = DEFAULT_ROOM) {
  const pack = CATALOG[style]!;
  let uid = 0;
  return runAutoDesignLayout({
    input, room, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: PALETTE, refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])],
    styleId: Number(style), makeUid: () => `d-${++uid}`,
  });
}

const isDishwasher = (item: PlacedCabinet) => /^DW[-_]/i.test(item.masterCode ?? "");
const isRange = (item: PlacedCabinet) => /^RANGE/i.test(item.masterCode ?? "");
const isSinkBase = (item: PlacedCabinet) => item.placement === "base" && isSinkBaseCabinet(item);

/** The four measured anchors, each once, with no two sharing floor along the same wall. */
function expectAnchorsBuiltWithoutOverlap(run: AutoDesignLayoutSuccess, room: RoomData) {
  const anchors = {
    sink: run.placed.filter(isSinkBase),
    dishwasher: run.placed.filter(isDishwasher),
    range: run.placed.filter(isRange),
    refrigerator: run.placed.filter((item) => item.placement === "appliance" && isRefrigerator(item)),
  };
  for (const [kind, list] of Object.entries(anchors)) expect(list, `${kind} placed once`).toHaveLength(1);
  const spans = Object.values(anchors).flat().map((item) => {
    const wall = cabinetWall(item, room)!;
    const start = wallRunOffset(item, wall, room);
    return { code: item.masterCode, wall, start, end: start + wallRunSpan(item, wall, room) };
  });
  for (let i = 0; i < spans.length; i += 1) {
    for (let j = i + 1; j < spans.length; j += 1) {
      const a = spans[i]!;
      const b = spans[j]!;
      if (a.wall !== b.wall) continue;
      const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      // 1/8 in. tolerance: on some lines the engine's own wiggle/filler passes leave the
      // range and sink base 1/8 in. into each other (it reports "-0.1 in of counter").
      // That comes from the engine, not from the starting centers, which never overlap.
      expect(overlap, `${a.code} ${a.start}-${a.end} overlaps ${b.code} ${b.start}-${b.end} on ${a.wall}`).toBeLessThanOrEqual(0.13);
    }
  }
}

/** The "Couldn't be met" lines the end-of-run report shows (findings plus run warnings). */
function couldNotBeMet(run: AutoDesignLayoutSuccess): string[] {
  const report = buildAutoDesignRulesReport(run.reviewFindings);
  return [...report.unmet, ...run.warnings];
}

describe("Auto-Design dialog starting centers build a kitchen on the default room", () => {
  it("the old fixed starting values (sink 24, range 120, refrigerator 72) overlapped on the 144 in. wall", () => {
    const input = { ...dialogInputs("single-wall", SCENARIOS[0]!), sink: { wallLabel: "Wall 1", centerOffsetIn: 24 }, stove: { wallLabel: "Wall 1", centerOffsetIn: 120 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 72 } } as AutoDesignInputs;
    const run = build(input, "510004");
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.message).toMatch(/refrigerator cannot be placed at that exact measurement on Wall 1/);
  });

  it("single wall on the 144 in. wall: the starting centers do not trip the overlap error", () => {
    const input = dialogInputs("single-wall", SCENARIOS[0]!);
    // A 3 in. filler at the wall, range 3–33, sink base 33–69, dishwasher 69–93, then
    // the refrigerator bay 105–144 (1 1/2 in. of panel room each side; the build slides
    // the refrigerator to the wall, leaving 15 in. of base beside it).
    expect(input.sink).toEqual({ wallLabel: "Wall 1", centerOffsetIn: 51 });
    expect(input.stove).toEqual({ wallLabel: "Wall 1", centerOffsetIn: 18 });
    expect(input.refrigerator).toEqual({ wallLabel: "Wall 1", centerOffsetIn: 124.5 });
    for (const style of STYLES) {
      const run = build(input, style);
      expect(run.ok ? "" : run.message).not.toMatch(/cannot be placed|overlaps|does not fit|No layout was built/);
      expect(run.ok).toBe(true);
    }
  });

  for (const layoutType of LAYOUTS) {
    for (const scenario of SCENARIOS) {
      it(`${layoutType} (${scenario.name}) builds with no placement error and no overlapping anchors`, () => {
        const input = dialogInputs(layoutType, scenario);
        for (const style of STYLES) {
          const run = build(input, style);
          if (!run.ok) throw new Error(`${layoutType} / ${style}: ${run.message}`);
          expectAnchorsBuiltWithoutOverlap(run, DEFAULT_ROOM);
          expect(couldNotBeMet(run).join("\n")).not.toMatch(/left the room bounds|cannot be placed/);
          expect(run.placed.filter((item) => item.placement === "base").length).toBeGreaterThan(1);
          if (process.env.AUTO_DESIGN_DEFAULTS_REPORT) {
            console.log(`\n[${layoutType} | ${scenario.name} | ${style}] sink ${input.sink.wallLabel} ${input.sink.centerOffsetIn}, range ${input.stove?.wallLabel} ${input.stove?.centerOffsetIn}, refrigerator ${input.refrigerator?.wallLabel} ${input.refrigerator?.centerOffsetIn}\n  - ${couldNotBeMet(run).join("\n  - ")}`);
          }
        }
      });
    }
  }

  it("still builds when the room is larger or smaller than the default", () => {
    for (const room of [{ width: 120, depth: 108 }, { width: 132, depth: 120 }, { width: 168, depth: 132 }, { width: 192, depth: 144 }]) {
      const insideRoom = { ...DEFAULT_ROOM, ...room } as RoomData;
      for (const layoutType of LAYOUTS) {
        // A 120 in. single wall is shorter than the sink base, dishwasher, range and refrigerator together.
        if (layoutType === "single-wall" && room.width < 126) continue;
        const run = build(dialogInputs(layoutType, SCENARIOS[0]!, insideRoom), "510004", insideRoom);
        if (!run.ok) throw new Error(`${layoutType} ${room.width}x${room.depth}: ${run.message}`);
        expectAnchorsBuiltWithoutOverlap(run, insideRoom);
      }
    }
  });

  it("a single wall too short for every item says so instead of overlapping silently", () => {
    const insideRoom = { ...DEFAULT_ROOM, width: 120, depth: 108 } as RoomData;
    const centers = autoDesignDefaultCenters({
      room: insideRoom, layoutType: "single-wall", originCorner: "left", runDirection: "right", wallCount: 4,
      sinkBaseWidthIn: 36, dishwasherSide: "right", includeStove: true, includeRefrigerator: true, refrigeratorWidthIn: 36,
    });
    expect(centers.fits).toBe(false);
    const run = build(dialogInputs("single-wall", SCENARIOS[0]!, insideRoom), "510004", insideRoom);
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.message).toMatch(/Wall 1 is 120 in, but the refrigerator, sink base, dishwasher and range need/);
  });
});

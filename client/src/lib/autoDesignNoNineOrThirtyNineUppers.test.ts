import { describe, expect, it } from "vitest";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { autoDesignStandardUpperRows } from "./autoDesignWallCabinets";
import { closeRemainingRunGaps } from "./autoDesignCloseRemainingGaps";
import { isAutoDesignSkippedUpperWidth, isAutoDesignNeverUpperWidth } from "./autoDesignUpperWidths";
import {
  appliancesForRoom,
  applianceAsDesignCabinet,
  elevationBox,
  isFillerItem,
  isPanelItem,
  isStacker,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";

/**
 * Tom, Nov 17 2026 (voice 12:18 PM CT): no blank spot above an upper when
 * "Glass cabinets above" is on. Aero Solstice sells GD stackers 12-36 in wide
 * and no 9 in or 39 in stacker, so Auto Design never places a 39 in upper
 * (39 becomes W2730 + W1230) and a 9 in upper beside a 3 in filler becomes the
 * single W1230. Demo: 170 x 170 L, Aero Solstice 390019, 108 and 96 in ceilings.
 */
const LIVE = live as unknown as {
  base: DesignCabinet[];
  wall: DesignCabinet[];
  accessory: DesignCabinet[];
  tall: DesignCabinet[];
  surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] };
};

const sinkWindow = {
  uid: "demo-sink-window", kind: "window", label: "Window 36\"", side: "top",
  offset: 67, width: 36, height: 42, sill: 42,
} as WallOpening;

function runDemo(ceilingHeight: number): { result: AutoDesignLayoutSuccess; room: RoomData } {
  const room = { width: 170, depth: 170, ceilingHeight, openWallPath: false } as RoomData;
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape",
      originCorner: "left",
      runDirection: "right",
      wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 85 },
      sinkBaseWidthIn: 36,
      sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 54 },
      refrigerator: { wallLabel: "Wall 2", centerOffsetIn: 100 },
      refrigeratorWidthIn: 36,
      dishwasherSide: "right",
      skipDishwasher: false,
      tallCabinets: null,
      overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      designQuestionDoorStyleId: 390019,
      designQuestionDoorStyleName: "Aero Solstice",
      intake: {
        ...emptyAutoDesignIntake(),
        construction: "new",
        preferences: ["glass-uppers", "crown-molding", "dishwasher"],
        islandOrPeninsula: "island",
      },
    },
    room,
    openings: [sinkWindow],
    baseCatalog: LIVE.base,
    wallCatalog: LIVE.wall,
    fillers: LIVE.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(LIVE.wall, LIVE.surround.deepAbove ?? []),
    refrigeratorEndPanels: LIVE.surround.endPanels ?? [],
    tallCatalog: LIVE.tall,
    panelCatalog: LIVE.accessory,
    styleId: 390019,
    makeUid: () => `no39-${ceilingHeight}-${++uid}`,
  } as never) as AutoDesignLayoutSuccess;
  expect(result.ok).toBe(true);
  return { result, room };
}

const at = (item: PlacedCabinet, room: RoomData) => {
  const wall = item.wallId!;
  const start = wallRunOffset(item, wall, room);
  return { wall, start, end: start + wallRunSpan(item, wall, room) };
};

/** A regular design-height upper: not a stacker, filler, panel, bridge or hood. */
const ordinaryUpper = (item: PlacedCabinet) => item.placement === "wall" && !isStacker(item as never)
  && !isFillerItem(item) && !isPanelItem(item) && Math.abs(Number(item.height) - 30) <= 0.5;

describe("Auto Design never places a 39 in upper and swaps a 9 in upper for a 12 in one", () => {
  it("the run tilers' upper rows leave out 9 in and 39 in widths", () => {
    const codes = autoDesignStandardUpperRows(LIVE.wall, 30).map((row) => row.masterCode);
    expect(codes).not.toContain("W-39-30");
    expect(codes).not.toContain("W0930");
    expect(codes).toEqual(expect.arrayContaining(["W1230", "W-15-30", "W1830", "W2130", "W2730", "W3030", "W3630"]));
    expect(isAutoDesignNeverUpperWidth({ width: "39.00" })).toBe(true);
    expect(isAutoDesignSkippedUpperWidth({ width: "9.000" })).toBe(true);
    expect(isAutoDesignSkippedUpperWidth({ width: "12.00" })).toBe(false);
  });

  it("a 39 in wall gap splits into two stocked uppers, never a W-39-30", () => {
    const room = { width: 39, depth: 120, ceilingHeight: 108 } as RoomData;
    let uid = 0;
    const result = closeRemainingRunGaps({
      placed: [], room, wallIds: ["top"], baseCatalog: [], wallCatalog: LIVE.wall, fillers: LIVE.accessory as never,
      styleId: 390019, makeUid: () => `gap39-${++uid}`, wallHeightIn: 30,
    });
    const uppers = result.placed.filter((item) => item.placement === "wall" && !isFillerItem(item));
    expect(uppers.length).toBe(2);
    expect(uppers.some((item) => Math.abs(Number(item.width) - 39) < 0.05)).toBe(false);
    expect(uppers.reduce((sum, item) => sum + Number(item.width), 0)).toBeCloseTo(39, 3);
    expect(uppers.map((item) => item.masterCode)).toEqual(["W2730", "W1230"]);
    expect(result.placed.filter((item) => item.placement === "wall" && isFillerItem(item))).toEqual([]);
  });

  it("a hole only a 9 in box fits still gets the W0930 (a cabinet beats a filler)", () => {
    const room = { width: 10.5, depth: 120, ceilingHeight: 108 } as RoomData;
    const result = closeRemainingRunGaps({
      placed: [], room, wallIds: ["top"], baseCatalog: [], wallCatalog: LIVE.wall, fillers: LIVE.accessory as never,
      styleId: 390019, makeUid: () => "gap9", wallHeightIn: 30,
    });
    expect(result.placed.filter((item) => item.placement === "wall" && !isFillerItem(item)).map((item) => item.masterCode)).toEqual(["W0930"]);
  });

  it.each([[108, 18, 102], [96, 12, 96]] as const)("170 x 170 L glass demo at %i in: every upper gets a %i in stacker, top at %i in", (ceiling, stackerHeight, top) => {
    const { result, room } = runDemo(ceiling);
    const placed = result.placed;
    // No 9 in or 39 in upper anywhere.
    const odd = placed.filter((item) => item.placement === "wall" && !isFillerItem(item)
      && [9, 39].some((width) => Math.abs(Number(item.width) - width) < 0.05));
    expect(odd.map((item) => item.masterCode)).toEqual([]);
    // Every ordinary upper carries a same-width glass stacker.
    const uppers = placed.filter(ordinaryUpper);
    const stackers = placed.filter((item) => isStacker(item as never));
    expect(uppers.length).toBeGreaterThanOrEqual(8);
    for (const upper of uppers) {
      const stacker = stackers.find((item) => item.stackedOnCabinetUid === upper.uid);
      expect(stacker, `${upper.masterCode} on ${upper.wallId} at ${at(upper, room).start}`).toBeTruthy();
      expect(Number(stacker!.width)).toBeCloseTo(Number(upper.width), 2);
      expect(Number(stacker!.height)).toBe(stackerHeight);
      const box = elevationBox(stacker!, room);
      expect(box.bottom + box.height).toBeCloseTo(top, 2);
    }
    expect((result.reviewFindings ?? []).some((finding) => finding.code === "preference-glass-stackers-skipped")).toBe(false);
    // The old W-39-30 right of the window is now W2730 + W1230 (12 in flank at the corner end).
    const right = uppers.filter((item) => item.wallId === "top" && at(item, room).start >= 100)
      .sort((a, b) => at(a, room).start - at(b, room).start)
      .map((item) => `${item.masterCode}@${at(item, room).start}`);
    expect(right).toEqual(["W2730@106", "W1230@133"]);
    // The old W0930 + 3 in filler beside the diagonal corner is one W1230.
    const flank = placed.filter((item) => item.placement === "wall" && item.wallId === "right"
      && at(item, room).start >= 23.9 && at(item, room).end <= 36.1);
    expect(flank.map((item) => item.masterCode).filter((code) => !/GD$/.test(code))).toEqual(["W1230"]);
  });
});

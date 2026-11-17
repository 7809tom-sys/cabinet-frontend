import { describe, expect, it } from "vitest";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake, type PreferenceId } from "./autoDesignFifteenRules";
import { finishedBaseEndPanelStock } from "./autoDesignRangeFlanks";
import { autoDesignExactUpperTiling } from "./autoDesignGlassSchedule";
import {
  appliancesForRoom, applianceAsDesignCabinet, elevationBox, isFillerItem, isGlassDoorCabinet, isPanelItem, isStacker,
  wallRunOffset, wallRunSpan, type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening,
} from "./design";
import { threeDCrownPerimeterSegments } from "@/components/design/InteractiveRoom3D";

/**
 * Tom, Nov 17 2026 (voice 2:51-3:10 PM CT): the Aero Solstice demo kitchen
 * (170 x 170 L, 108 in ceiling, sink + window on Wall 1, range with microwave
 * bridge and refrigerator on Wall 2, "Glass cabinets above" + crown) must come
 * out of Auto Design exactly as the hand-corrected v2 plan:
 * - glass only on the schedule: diagonal corner, 9 in cabinet, microwave bridge,
 *   refrigerator cabinet, and the two 21 in uppers over the B42 (6 stackers);
 * - every upper stack tops out at 96 in (solid 42 in, or 30 in + 12 in glass);
 * - two 21s over a 42 in base, a W2142 over the B24, the window mirrored with a
 *   W2142 each side, no 39 in upper, crown one run at 96 in.
 */
const LIVE = live as unknown as {
  base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall: DesignCabinet[];
  surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] };
};
const sinkWindow = { uid: "demo-sink-window", kind: "window", label: "Window 36\"", side: "top", offset: 67, width: 36, height: 42, sill: 42 } as WallOpening;

function runDemo(preferences: PreferenceId[], wallCatalog: DesignCabinet[] = LIVE.wall, ceilingHeight = 108): { result: AutoDesignLayoutSuccess; room: RoomData } {
  const room = { width: 170, depth: 170, ceilingHeight, openWallPath: false } as RoomData;
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 85 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 54 }, refrigerator: { wallLabel: "Wall 2", centerOffsetIn: 100 }, refrigeratorWidthIn: 36,
      dishwasherSide: "right", skipDishwasher: false, tallCabinets: null, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      designQuestionDoorStyleId: 390019, designQuestionDoorStyleName: "Aero Solstice",
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences, islandOrPeninsula: "island" },
    } as never,
    room, openings: [sinkWindow], baseCatalog: LIVE.base, wallCatalog, fillers: LIVE.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(wallCatalog, LIVE.surround.deepAbove ?? []),
    refrigeratorEndPanels: LIVE.surround.endPanels ?? [], tallCatalog: LIVE.tall, panelCatalog: LIVE.accessory,
    styleId: 390019, makeUid: () => `v2t-${++uid}`,
  } as never);
  if (!result.ok) throw new Error(result.message);
  return { result, room };
}

const DEMO: PreferenceId[] = ["glass-uppers", "crown-molding", "dishwasher"];
const at = (item: PlacedCabinet, room: RoomData) => {
  const wall = item.wallId ?? "";
  const start = wallRunOffset(item, wall, room);
  const box = elevationBox(item, room);
  return { start: Math.round(start * 100) / 100, end: Math.round((start + wallRunSpan(item, wall, room)) * 100) / 100, bottom: box.bottom, top: Math.round((box.bottom + box.height) * 100) / 100 };
};
const upperRow = (placed: readonly PlacedCabinet[], room: RoomData, wall: string) => placed
  .filter((item) => item.placement === "wall" && item.wallId === wall && !isStacker(item))
  .map((item) => ({ item, ...at(item, room) }))
  .sort((a, b) => a.start - b.start || b.end - a.end)
  .map((entry) => `${entry.item.masterCode} ${entry.start}-${entry.end}`);

describe("Auto Design v2 Aero Solstice: glass schedule, flush tops, 21s over 42s", () => {
  const { result, room } = runDemo(DEMO);
  const placed = result.placed;

  it("lays out the v2 uppers on both walls", () => {
    // Tom, 3:27 PM CT: the corner rule fires first (a 12 in on each leg of the diagonal), and
    // Rule 10 puts 3/4 in S2496 stock on every visible side (window sides, the band under the
    // microwave), replacing the 1/4 in WSV skin.
    expect(upperRow(placed, room, "top")).toEqual([
      "W2130 0-21", "W2130 21-42", "W2142 42-63", "S2496 63-63.75", "W2742 106-133", "W1242 133-145", "F1.5 145-146",
    ]);
    expect(upperRow(placed, room, "right")).toEqual([
      "DCW2430 0-24", "W1230 24-36", "W3012 36-66", "S2496 36-36.75", "S2496 66-66.75", "W1242 66.75-78.75", "F342 78.75-80.75",
      "W361224 82-118", "W3642 119.25-155.25", "W1242 155.25-167.25",
    ]);
    expect(placed.some((item) => item.placement === "wall" && Math.abs(Number(item.width) - 39) <= 0.05)).toBe(false);
  });

  it("places glass only on the 6 scheduled spots, real GD rows, no double GD flag", () => {
    const stackers = placed.filter((item) => isStacker(item));
    const schedule = stackers.map((stacker) => `${stacker.masterCode} on ${placed.find((item) => item.uid === stacker.stackedOnCabinetUid)?.masterCode}`).sort();
    expect(schedule).toEqual([
      "DCW2412GD on DCW2430", "W1212GD on W1230", "W2112GD on W2130", "W2112GD on W2130", "W3012GD on W3012", "W3612GD on W361224",
    ]);
    const byCode = new Map(LIVE.wall.map((row) => [row.masterCode, row]));
    for (const stacker of stackers) {
      expect(byCode.get(stacker.masterCode)?.id).toBe(stacker.cabinetId);
      expect(isGlassDoorCabinet(stacker)).toBe(true);
      // The code already carries GD; the flag would make the cart append a second one (PR 441).
      expect(stacker.glassDoor).not.toBe(true);
    }
    // Nothing else is glass.
    expect(placed.filter((item) => !isStacker(item) && isGlassDoorCabinet(item)).map((item) => item.masterCode)).toEqual([]);
    expect(result.reviewFindings.some((finding) => finding.code === "preference-glass-stackers-skipped")).toBe(false);
  });

  it("every upper stack ends at one flush top of 96 in; nothing is pushed back", () => {
    const wallLayer = placed.filter((item) => item.placement === "wall" && !isPanelItem(item));
    const tops = new Set(wallLayer.map((item) => at(item, room).top).filter((top, _, all) => all.length > 0));
    const covered = new Set(placed.filter((item) => isStacker(item)).map((item) => item.stackedOnCabinetUid));
    const exposedTops = new Set(wallLayer.filter((item) => !covered.has(item.uid) && !(isFillerItem(item) && at(item, room).top === 84)).map((item) => at(item, room).top));
    expect(Array.from(exposedTops)).toEqual([96]);
    expect(tops.has(102)).toBe(false);
    for (const stacker of placed.filter((item) => isStacker(item))) {
      const parent = placed.find((item) => item.uid === stacker.stackedOnCabinetUid)!;
      expect(at(stacker, room).bottom).toBeCloseTo(at(parent, room).top, 2);
      expect(at(stacker, room).top).toBeCloseTo(96, 2);
    }
    // Solid uppers sit on the wall (12 in deep against the wall), not pushed back.
    for (const item of wallLayer.filter((entry) => /^W\d{4}$/.test(entry.masterCode) && entry.wallId === "top")) expect(item.y).toBeCloseTo(0, 2);
  });

  it("crown is one run at 96 in, including over the 12 in stacker that spans the 9 in cabinet and its filler", () => {
    const segments = threeDCrownPerimeterSegments(placed, room);
    expect(segments.length).toBeGreaterThan(0);
    expect(Array.from(new Set(segments.map((segment) => Math.round(segment.top * 100) / 100)))).toEqual([96]);
  });

  it("the diagonal pair DCW2430 + DCW2412GD is aligned and flush", () => {
    const parent = placed.find((item) => item.masterCode === "DCW2430")!;
    const stacker = placed.find((item) => item.masterCode === "DCW2412GD")!;
    expect(stacker.stackedOnCabinetUid).toBe(parent.uid);
    expect(stacker.x).toBeCloseTo(parent.x, 2);
    expect(stacker.y).toBeCloseTo(parent.y, 2);
    expect(Number(stacker.rotation)).toBe(Number(parent.rotation));
    expect(Number(stacker.width)).toBe(Number(parent.width));
    expect(at(parent, room).top).toBeCloseTo(84, 2);
    expect(at(stacker, room).bottom).toBeCloseTo(84, 2);
    expect(at(stacker, room).top).toBeCloseTo(96, 2);
  });

  it("the 12 in glass stacker sits on the 12 in cabinet that replaced the 9 in cabinet and its 3 in filler", () => {
    const stacker = placed.find((item) => item.masterCode === "W1212GD")!;
    expect(at(stacker, room).start).toBeCloseTo(24, 2);
    expect(at(stacker, room).end).toBeCloseTo(36, 2);
  });

  it("all or nothing: a line missing one scheduled glass stacker gets no glass and one report line", () => {
    const withoutTwelveGlass = LIVE.wall.filter((row) => !/^W12(12|15|18)GD$/.test(row.masterCode));
    const { result: run, room: r } = runDemo(DEMO, withoutTwelveGlass);
    expect(run.placed.filter((item) => isStacker(item) || isGlassDoorCabinet(item))).toEqual([]);
    const warning = run.reviewFindings.filter((finding) => finding.code === "preference-glass-stackers-skipped");
    expect(warning).toHaveLength(1);
    expect(warning[0]!.detail).toMatch(/all or nothing/);
    expect(warning[0]!.detail).toMatch(/W1230/);
    // The plan keeps its design-height uppers, flush at 84 in.
    const tops = new Set(run.placed.filter((item) => item.placement === "wall" && !isPanelItem(item)).map((item) => at(item, r).top));
    expect(Array.from(tops)).toEqual([84]);
  });

  it("without the glass pick: no glass, but still two 21s over the B42 and no 39 in upper", () => {
    const { result: run, room: r } = runDemo(["crown-molding", "dishwasher"]);
    expect(run.placed.some((item) => isStacker(item) || isGlassDoorCabinet(item))).toBe(false);
    const top = upperRow(run.placed, r, "top");
    expect(top.slice(0, 2)).toEqual(["W2130 0-21", "W2130 21-42"]);
    expect(run.placed.some((item) => item.placement === "wall" && Math.abs(Number(item.width) - 39) <= 0.05)).toBe(false);
  });

  it("corners first: the 24 in diagonal upper has a 12 in cabinet on each leg", () => {
    const top = upperRow(placed, room, "top");
    const right = upperRow(placed, room, "right");
    expect(right.slice(0, 2)).toEqual(["DCW2430 0-24", "W1230 24-36"]);
    // On the other leg a 1.5 in corner filler sits between the 12 in and the diagonal box.
    expect(top.slice(-2)).toEqual(["W1242 133-145", "F1.5 145-146"]);
    expect(result.notes.some((note) => /DCW2430 24″ diagonal corner upper has a 12″ W1230 beside it/.test(note))).toBe(true);
    // The mirror cannot also be met on that run, and the report says so.
    expect(result.reviewFindings.some((finding) => finding.code === "window-uppers-not-mirrored" && /12″ corner cabinet comes first/.test(finding.detail))).toBe(true);
  });

  it("cabinet before filler: the 9 in upper and its 3 in filler become one W1230", () => {
    expect(placed.some((item) => item.placement === "wall" && Math.abs(Number(item.width) - 9) <= 0.05)).toBe(false);
    expect(result.notes.some((note) => /W0930 \+ the 3″ F342 on right became one W1230/.test(note))).toBe(true);
  });

  it("names the corner actually placed and never claims a diagonal base the line does not sell", () => {
    expect(placed.some((item) => item.masterCode === "ERB36")).toBe(true);
    expect(result.notes.some((note) => /BBC36 blind corner pulled/.test(note))).toBe(false);
    expect(result.notes.some((note) => /catalog-fitting lazy Susan \(or a blind/.test(note))).toBe(false);
    expect(result.notes.some((note) => /^Corner between Wall 1 and Wall 2: ERB36 lazy Susan corner placed/.test(note))).toBe(true);
    const diagonal = result.reviewFindings.filter((finding) => finding.code === "corner-diagonal-base-unavailable");
    expect(diagonal).toHaveLength(1);
    expect(diagonal[0]!.detail).toMatch(/sells no diagonal base corner/);
  });

  it("Rule 10: 3/4 in stock on every visible side, no 1/4 in skins, no false 'sells no matching panel'", () => {
    expect(placed.some((item) => /^(WSV|BSV|USV|FPV)/.test(item.masterCode))).toBe(false);
    // The one side left open is named with the real reason: the window's 3 in clearance (the
    // W2742 is already 3 in off the window), never "the selected line sells no matching panel".
    const unfinished = result.reviewFindings.filter((finding) => finding.code === "exposed-side-left-unfinished");
    expect(unfinished.map((finding) => finding.title)).toEqual(["W2742 keeps an unfinished start side"]);
    expect(unfinished[0]!.detail).toMatch(/window's 3″ clearance/);
    expect(result.reviewFindings.some((finding) => /sells no matching panel/.test(finding.detail ?? ""))).toBe(false);
    for (const panel of placed.filter((item) => item.masterCode === "S2496" && item.placement === "wall")) {
      expect(Math.min(Number(panel.width), Number(panel.depth))).toBeCloseTo(0.75, 2);
    }
  });

  it("measures the range against the refrigerator, not against the microwave over it", () => {
    expect(result.reviewFindings.some((finding) => /between range and range/.test(finding.title))).toBe(false);
  });

  it("a base end panel within about 1 in of the cabinet depth covers the side (BDEP 23.5, BSV 23.25 on a 24 in base)", () => {
    const stock = finishedBaseEndPanelStock(LIVE.accessory as never, { depth: 24, height: 34.5 });
    // Rule 10 takes 3/4 in stock first: the 3/4 in BDEP, not the 1/4 in BSV skin.
    expect(stock?.masterCode).toBe("BDEP");
    const skinOnly = finishedBaseEndPanelStock(LIVE.accessory.filter((row) => row.masterCode !== "BDEP") as never, { depth: 24, height: 34.5 });
    expect(skinOnly?.masterCode).toBe("BSV");
  });

  it("splits spans into real widths, 21 and 30 first", () => {
    const widths = [9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
    expect(autoDesignExactUpperTiling(42, widths)).toEqual([21, 21]);
    expect(autoDesignExactUpperTiling(39, widths)).toEqual([21, 18]);
    expect(autoDesignExactUpperTiling(36, widths)).toEqual([36]);
    expect(autoDesignExactUpperTiling(51, widths)).toEqual([30, 21]);
    expect(autoDesignExactUpperTiling(4, widths)).toBeNull();
  });
});

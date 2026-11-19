import { describe, expect, it } from "vitest";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { autoDesignGlassOffered } from "./autoDesignFormOptions";
import { withoutNoGlassUppers } from "./autoDesignWallCabinets";
import {
  appliancesForRoom, applianceAsDesignCabinet, isFillerItem, isPanelItem, isStacker, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

/**
 * Tom, voice, Nov 18 2026 (5:03-5:22 PM CT): no 39 wide (W-39-30) or 39 tall wall
 * cabinet on any wall or run where glass is offered, because no 39 in glass exists.
 * Work base-first: size each upper from the base(s) beneath so it, and its glass
 * stacker, sits square over and matches the cabinet below (two W2130 over a B42, and
 * a window-clipped 39 slot is W2130 + W1830, not a 39). Where glass is NOT offered
 * the 39 stays allowed. Scenario: 170 x 170 L, Aero Solstice (390019), 108 in ceiling,
 * 30 in wall program, sink window 67-103 on the top wall.
 */
const LIVE = live as unknown as {
  base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall: DesignCabinet[];
  surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] };
};

function run(opts: { sinkCenter?: number; glass?: boolean; ceiling?: number } = {}): { result: AutoDesignLayoutSuccess; room: RoomData } {
  const sinkCenter = opts.sinkCenter ?? 85;
  const room = { width: 170, depth: 170, ceilingHeight: opts.ceiling ?? 108, openWallPath: false } as RoomData;
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: sinkCenter }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 54 }, refrigerator: { wallLabel: "Wall 2", centerOffsetIn: 100 }, refrigeratorWidthIn: 36,
      dishwasherSide: "right", skipDishwasher: false, tallCabinets: null, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      designQuestionDoorStyleId: 390019, designQuestionDoorStyleName: "Aero Solstice",
      intake: {
        ...emptyAutoDesignIntake(), construction: "new", islandOrPeninsula: "none",
        preferences: opts.glass === false ? ["crown-molding", "dishwasher"] : ["glass-uppers", "crown-molding", "dishwasher"],
      },
    } as never,
    room,
    openings: [{ uid: "win", kind: "window", label: "w", side: "top", offset: sinkCenter - 18, width: 36, height: 42, sill: 42 } as never],
    baseCatalog: LIVE.base, wallCatalog: LIVE.wall, fillers: LIVE.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(LIVE.wall, LIVE.surround.deepAbove ?? []),
    refrigeratorEndPanels: LIVE.surround.endPanels ?? [], tallCatalog: LIVE.tall, panelCatalog: LIVE.accessory,
    styleId: 390019, makeUid: () => `n39-${++uid}`,
  } as never);
  if (!result.ok) throw new Error(result.message);
  return { result, room };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
type Box = { item: PlacedCabinet; code: string; start: number; end: number };
function boxes(placed: readonly PlacedCabinet[], room: RoomData, wall: string, pick: (item: PlacedCabinet) => boolean): Box[] {
  return placed.filter((item) => item.wallId === wall && pick(item)).map((item) => {
    const start = wallRunOffset(item, wall, room);
    return { item, code: item.masterCode, start: r2(start), end: r2(start + wallRunSpan(item, wall, room)) };
  }).sort((a, b) => a.start - b.start);
}
const isUpper = (item: PlacedCabinet) => item.placement === "wall" && !isStacker(item) && !isFillerItem(item) && !isPanelItem(item);
const isStraightBaseBox = (item: PlacedCabinet) => item.placement === "base" && /^B\d+$/.test(item.masterCode);
const is39 = (item: PlacedCabinet) => Math.abs(Number(item.width) - 39) < 0.1 || Math.abs(Number(item.height) - 39) < 0.1;
const wallsOf = (placed: readonly PlacedCabinet[]) => Array.from(new Set(placed.map((item) => item.wallId).filter(Boolean))) as string[];

describe("no 39 wall cabinet where glass is offered (base-first)", () => {
  it("170 x 170 L, 108 in ceiling, glass on: no 39 wide or 39 tall wall cabinet on any wall", () => {
    const { result } = run();
    expect(result.placed.filter((item) => item.placement === "wall" && !isStacker(item) && is39(item)).map((item) => item.masterCode)).toEqual([]);
  });

  it("uppers line up over the bases: two W2130 over the B42, the B24's upper on its seam, W3630 over B36", () => {
    const { result, room } = run();
    const top = boxes(result.placed, room, "top", isUpper);
    const topBases = boxes(result.placed, room, "top", isStraightBaseBox);
    const b42 = topBases.find((base) => base.code === "B42")!;
    const b24 = topBases.find((base) => base.code === "B24")!;
    const overB42 = top.filter((upper) => upper.start >= b42.start - 0.1 && upper.end <= b42.end + 0.1);
    expect(overB42.map((upper) => [upper.code, upper.start, upper.end])).toEqual([["W2130", b42.start, b42.start + 21], ["W2130", b42.start + 21, b42.end]]);
    // the window keeps 3 in clear of the B24's far end; the upper still starts on the B24's seam
    const overB24 = top.find((upper) => Math.abs(upper.start - b24.start) <= 0.1)!;
    expect(overB24.code).toBe("W2130");
    // nothing reaches across the seam between two touching straight bases
    const seams = topBases.filter((base, i) => i > 0 && Math.abs(topBases[i - 1]!.end - base.start) <= 0.1).map((base) => base.start);
    expect(seams.length).toBeGreaterThan(0);
    for (const seam of seams) {
      for (const upper of top) expect(upper.start < seam - 0.1 && upper.end > seam + 0.1, `${upper.code} ${upper.start}-${upper.end} straddles the ${seam} seam`).toBe(false);
    }
    const right = boxes(result.placed, room, "right", isUpper);
    const rightBases = boxes(result.placed, room, "right", isStraightBaseBox);
    const b36 = rightBases.find((base) => base.code === "B36")!;
    expect(right.find((upper) => upper.start === b36.start)).toMatchObject({ code: "W3630", end: b36.end });
    const b12 = rightBases.filter((base) => base.code === "B12").pop()!;
    expect(right.find((upper) => upper.start === b12.start)).toMatchObject({ code: "W1230", end: b12.end });
  });

  it("each of those uppers carries a glass stacker of the same width and seams", () => {
    const { result, room } = run();
    for (const wall of wallsOf(result.placed)) {
      const stackers = boxes(result.placed, room, wall, (item) => item.placement === "wall" && isStacker(item));
      const parents = boxes(result.placed, room, wall, (item) => isUpper(item) && /^W(21|27|18|12|36|15)\d\d$|^W-15-30$/.test(item.masterCode) && Math.abs(Number(item.height) - 30) < 0.5);
      for (const parent of parents) {
        expect(stackers.some((stk) => stk.start === parent.start && stk.end === parent.end), `${wall} ${parent.code} ${parent.start}-${parent.end}`).toBe(true);
      }
    }
  });

  it("a window-clipped 39 in slot over the B42 is W2130 + W1830 with matching stackers, never a 39 or a 36 + filler", () => {
    const { result, room } = run({ sinkCenter: 60 });
    expect(result.placed.filter((item) => item.placement === "wall" && !isStacker(item) && is39(item))).toEqual([]);
    const b42 = boxes(result.placed, room, "top", isStraightBaseBox).find((base) => base.code === "B42")!;
    const over = boxes(result.placed, room, "top", isUpper).filter((upper) => upper.start >= b42.start - 0.1 && upper.end <= b42.end + 0.1);
    expect(over.map((upper) => [upper.code, upper.start, upper.end])).toEqual([["W2130", 0, 21], ["W1830", 21, 39]]);
    const stackers = boxes(result.placed, room, "top", (item) => isStacker(item));
    expect(stackers.map((stk) => [stk.code, stk.start, stk.end])).toEqual(expect.arrayContaining([["W2118GD", 0, 21], ["W1818GD", 21, 39]]));
  });

  it("where glass is NOT offered the 39 stays: glass off, or no room for a stacker under the ceiling", () => {
    const off = run({ sinkCenter: 60, glass: false });
    expect(off.result.placed.filter((item) => item.placement === "wall" && is39(item)).length).toBeGreaterThan(0);
    const low = run({ sinkCenter: 60, ceiling: 90 });
    expect(low.result.placed.filter((item) => item.placement === "wall" && !isStacker(item) && is39(item)).length).toBeGreaterThan(0);
    const intake = { ...emptyAutoDesignIntake(), preferences: ["glass-uppers"] } as never;
    expect(autoDesignGlassOffered({ intake, wallCatalog: LIVE.wall, room: { ceilingHeight: 108 } as RoomData, wallCabinetHeightIn: 30 })).toBe(true);
    expect(autoDesignGlassOffered({ intake, wallCatalog: LIVE.wall, room: { ceilingHeight: 90 } as RoomData, wallCabinetHeightIn: 30 })).toBe(false);
    expect(autoDesignGlassOffered({ intake: emptyAutoDesignIntake(), wallCatalog: LIVE.wall, room: { ceilingHeight: 108 } as RoomData, wallCabinetHeightIn: 30 })).toBe(false);
  });

  it("the filter drops only the ordinary 39 uppers from the pool (bridges, corners and other widths stay)", () => {
    expect(LIVE.wall.some((row) => Math.abs(Number(row.width) - 39) < 0.1 && row.masterCode === "W-39-30")).toBe(true);
    const kept = withoutNoGlassUppers(LIVE.wall);
    expect(kept.some((row) => row.masterCode === "W-39-30")).toBe(false);
    expect(LIVE.wall.length - kept.length).toBeGreaterThan(0);
    for (const code of ["W2130", "W1830", "W2730", "W3630", "W3012", "W361224"]) {
      expect(kept.some((row) => row.masterCode === code), code).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import {
  appliancesForRoom, applianceAsDesignCabinet, isStacker, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

/**
 * Tom, Nov 18 2026 (voice 10:28 and 10:34 AM CT): a B42 whose line sells no 42 in
 * upper at the selected height always gets two 21 in uppers at that height
 * (W2130 at 30, W2142 at 42), from the catalog. A line that does sell the 42 keeps
 * the single upper. No 21 at that height is a "couldn't be met" line.
 */
const LIVE = live as unknown as {
  base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall: DesignCabinet[];
  surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] };
};

function run(opts: { wall?: DesignCabinet[]; heightIn?: number } = {}): { result: AutoDesignLayoutSuccess; room: RoomData } {
  const room = { width: 192, depth: 144, ceilingHeight: 108, openWallPath: false } as RoomData;
  const wall = opts.wall ?? LIVE.wall;
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "u-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: opts.heightIn ?? 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 96 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 72 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
      dishwasherSide: "right", skipDishwasher: true, tallCabinets: null, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      designQuestionDoorStyleId: 390019, designQuestionDoorStyleName: "Aero Solstice",
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: [], islandOrPeninsula: "none" },
    } as never,
    room, openings: [], baseCatalog: LIVE.base, wallCatalog: wall, fillers: LIVE.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(wall, LIVE.surround.deepAbove ?? []),
    refrigeratorEndPanels: LIVE.surround.endPanels ?? [], tallCatalog: LIVE.tall, panelCatalog: LIVE.accessory,
    styleId: 390019, makeUid: () => `b42-${++uid}`,
  } as never);
  if (!result.ok) throw new Error(result.message);
  return { result, room };
}

const spanOf = (item: PlacedCabinet, wall: string, room: RoomData) => {
  const start = wallRunOffset(item, wall, room);
  return { start: Math.round(start * 100) / 100, end: Math.round((start + wallRunSpan(item, wall, room)) * 100) / 100 };
};

/** Uppers over every B42 on the wall, by base. */
function uppersOverB42(placed: readonly PlacedCabinet[], room: RoomData) {
  return placed.filter((item) => item.placement === "base" && item.masterCode === "B42").map((base) => {
    const wall = base.wallId ?? "";
    const b = spanOf(base, wall, room);
    const over = placed.filter((item) => item.placement === "wall" && item.wallId === wall && !isStacker(item))
      .map((item) => ({ item, ...spanOf(item, wall, room) }))
      .filter((entry) => entry.start < b.end - 0.1 && entry.end > b.start + 0.1)
      .sort((x, y) => x.start - y.start);
    return { base, wall, ...b, over };
  });
}

describe("B42 with no 42 in upper: two 21 in uppers at the selected height (Aero)", () => {
  it("at 30 in: six W2130s over B42 + B42 + B42 (+ B30), no W-39-30, no 'kept' finding", () => {
    const { result, room } = run();
    const bottom = uppersOverB42(result.placed, room).filter((entry) => entry.wall === "bottom");
    expect(bottom).toHaveLength(3);
    for (const entry of bottom) {
      expect(entry.over.map((o) => `${o.item.masterCode} ${o.start}-${o.end}`)).toEqual([
        `W2130 ${entry.start}-${entry.start + 21}`, `W2130 ${entry.start + 21}-${entry.end}`,
      ]);
    }
    expect(result.placed.filter((item) => item.wallId === "bottom" && /^W-?39/i.test(item.masterCode))).toEqual([]);
    expect(result.reviewFindings.filter((f) => f.code === "upper-width-not-matched" && /B42/.test(f.title))).toEqual([]);
    expect(result.reviewFindings.filter((f) => f.code === "b42-two-21-not-met")).toEqual([]);
  });

  it("at 42 in: the pair is W2142 + W2142, not a hardcoded W2130", () => {
    const { result, room } = run({ heightIn: 42 });
    const bottom = uppersOverB42(result.placed, room).filter((entry) => entry.wall === "bottom");
    expect(bottom.length).toBeGreaterThan(0);
    for (const entry of bottom) expect(entry.over.map((o) => o.item.masterCode)).toEqual(["W2142", "W2142"]);
    expect(result.placed.some((item) => item.masterCode === "W2130")).toBe(false);
  });

  it("a line that sells a W4230 keeps the single W4230 over each B42", () => {
    const w3630 = LIVE.wall.find((row) => row.masterCode === "W3630")!;
    const w4230 = { ...w3630, id: 990042, masterCode: "W4230", width: "42.000", description: '42" Wall Cabinet' } as DesignCabinet;
    const { result, room } = run({ wall: [...LIVE.wall, w4230] });
    const bottom = uppersOverB42(result.placed, room).filter((entry) => entry.wall === "bottom");
    expect(bottom).toHaveLength(3);
    for (const entry of bottom) expect(entry.over.map((o) => o.item.masterCode)).toEqual(["W4230"]);
  });

  it("no 42 and no 21 at the height: a couldn't-be-met line, no invented SKU", () => {
    const { result } = run({ wall: LIVE.wall.filter((row) => !/^W21\d\d$/.test(row.masterCode)) });
    expect(result.reviewFindings.some((f) => f.code === "b42-two-21-not-met" && f.severity === "warning")).toBe(true);
    expect(result.placed.some((item) => /^W21/.test(item.masterCode))).toBe(false);
  });
});

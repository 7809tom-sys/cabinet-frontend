import { describe, expect, it } from "vitest";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import {
  appliancesForRoom, applianceAsDesignCabinet, isStacker, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

/**
 * Rule 1, Tom (voice, Nov 18 2026, 11:08 / 11:10 AM CT): the upper height is 30, 36
 * or 42 in, set by the wall program the customer picks. Over a base 42: if the wall
 * program is 42 in, place a 42 in upper. Otherwise place two 21 in uppers side by
 * side at the wall program height: W2130 on a 30 program, W2136 on a 36 program.
 * Fallbacks from the catalog only: a 42 program with no 42 wide upper gets two
 * W2142s; no fitting SKU is a "couldn't be met" warning, never an invented SKU.
 */
const LIVE = live as unknown as {
  base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall: DesignCabinet[];
  surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] };
};

function run(opts: { wall?: DesignCabinet[]; heightIn?: number; preferences?: string[] } = {}): { result: AutoDesignLayoutSuccess; room: RoomData } {
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
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: opts.preferences ?? [], islandOrPeninsula: "none" },
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

const bottomB42 = (placed: readonly PlacedCabinet[], room: RoomData) =>
  uppersOverB42(placed, room).filter((entry) => entry.wall === "bottom");

/** A wall row cloned from a real catalog row at that height, for a width Aero does not sell. */
function injected(fromCode: string, masterCode: string, width: number): DesignCabinet {
  const from = LIVE.wall.find((row) => row.masterCode === fromCode)!;
  return { ...from, id: 990000 + width * 100 + Number(String(from.height).split(".")[0]), masterCode, width: `${width}.000`, description: `${width}" Wall Cabinet` } as DesignCabinet;
}

describe("Rule 1: the upper over a B42 follows the wall program (Aero)", () => {
  it.each([
    [30, "W2130"],
    [36, "W2136"],
  ])("on a %i in wall program: two %s uppers side by side over each B42, tops flush", (heightIn, code) => {
    const { result, room } = run({ heightIn });
    const bottom = bottomB42(result.placed, room);
    expect(bottom.length).toBeGreaterThan(0);
    for (const entry of bottom) {
      expect(entry.over.map((o) => `${o.item.masterCode} ${o.start}-${o.end}`)).toEqual([
        `${code} ${entry.start}-${entry.start + 21}`, `${code} ${entry.start + 21}-${entry.end}`,
      ]);
      expect(new Set(entry.over.map((o) => (o.item.mountBottom ?? 54) + Number(o.item.height))).size).toBe(1);
    }
    expect(result.reviewFindings.filter((f) => f.code === "b42-upper-rule-not-met")).toEqual([]);
  });

  it("on a 42 in wall program with a 42 wide upper in the line: one W4242 over each B42", () => {
    const { result, room } = run({ heightIn: 42, wall: [...LIVE.wall, injected("W3642", "W4242", 42)] });
    const bottom = bottomB42(result.placed, room);
    expect(bottom.length).toBeGreaterThan(0);
    for (const entry of bottom) expect(entry.over.map((o) => `${o.item.masterCode} ${o.start}-${o.end}`)).toEqual([`W4242 ${entry.start}-${entry.end}`]);
  });

  it("on a 42 in wall program with no 42 wide upper (Aero as sold): two W2142s over each B42", () => {
    const { result, room } = run({ heightIn: 42 });
    const bottom = bottomB42(result.placed, room);
    expect(bottom.length).toBeGreaterThan(0);
    for (const entry of bottom) expect(entry.over.map((o) => o.item.masterCode)).toEqual(["W2142", "W2142"]);
    expect(result.placed.some((item) => item.masterCode === "W2130")).toBe(false);
  });

  it("on a 30 in wall program in a line that sells a W4230: still two W2130s, flagged in the review", () => {
    const { result, room } = run({ wall: [...LIVE.wall, injected("W3630", "W4230", 42)] });
    const bottom = bottomB42(result.placed, room);
    expect(bottom.length).toBeGreaterThan(0);
    for (const entry of bottom) expect(entry.over.map((o) => o.item.masterCode)).toEqual(["W2130", "W2130"]);
    expect(result.reviewFindings.some((f) => f.code === "b42-single-upper-not-used" && /W4230/.test(f.detail))).toBe(true);
  });

  it.each([
    [30, /^W2130$/],
    [36, /^W2136$/],
  ])("on a %i in wall program with no 21 wide upper at that height: couldn't be met, no invented SKU", (heightIn, drop) => {
    const { result } = run({ heightIn, wall: LIVE.wall.filter((row) => !drop.test(row.masterCode)) });
    expect(result.reviewFindings.some((f) => f.code === "b42-upper-rule-not-met" && f.severity === "warning")).toBe(true);
    expect(result.placed.some((item) => drop.test(item.masterCode))).toBe(false);
  });

  it("on a 42 in wall program with neither a 42 nor a 21 wide upper: couldn't be met, no invented SKU", () => {
    const { result } = run({ heightIn: 42, wall: LIVE.wall.filter((row) => row.masterCode !== "W2142") });
    expect(result.reviewFindings.some((f) => f.code === "b42-upper-rule-not-met" && f.severity === "warning" && /42″ wide and no 21″/.test(f.detail))).toBe(true);
    expect(result.placed.some((item) => /^W(?:21|42)42$/.test(item.masterCode))).toBe(false);
  });
});

/**
 * Rule 1b, Tom (voice, Nov 18 2026, 11:14 AM CT): "If you do not have a glass cabinet
 * for the appropriate cabinet, do not put that cabinet in the plan." With glass on,
 * the upper over a B42 is only placed when the line sells its matching glass stacker.
 */
describe("Rule 1b: with glass on, a B42 upper is only placed when its glass stacker exists (Aero)", () => {
  const GLASS = ["glass-uppers"];
  const no21Glass = LIVE.wall.filter((row) => !/^W21(?:12|15|18)GD$/.test(row.masterCode));
  const stackersOn = (placed: readonly PlacedCabinet[], uid: string) => placed.filter((item) => item.stackedOnCabinetUid === uid);

  it("on a 30 in wall program with the 21 in glass stacker sold: two W2130s, each with its W21 glass stacker", () => {
    const { result, room } = run({ preferences: GLASS });
    const bottom = bottomB42(result.placed, room);
    expect(bottom.length).toBeGreaterThan(0);
    for (const entry of bottom) {
      expect(entry.over.map((o) => o.item.masterCode)).toEqual(["W2130", "W2130"]);
      for (const o of entry.over) expect(stackersOn(result.placed, o.item.uid).map((item) => item.masterCode)).toEqual([expect.stringMatching(/^W21(?:12|15|18)GD$/)]);
    }
    expect(result.reviewFindings.filter((f) => /^b42-glass/.test(f.code ?? ""))).toEqual([]);
  });

  it("on a 30 in wall program with no 21 in glass stacker but a 42 that has one: a single W4230 with its glass stacker, flagged", () => {
    const w4230 = injected("W3630", "W4230", 42);
    const w4218gd = injected("W3618GD", "W4218GD", 42);
    const { result, room } = run({ preferences: GLASS, wall: [...no21Glass, w4230, w4218gd] });
    const bottom = bottomB42(result.placed, room);
    expect(bottom.length).toBeGreaterThan(0);
    for (const entry of bottom) {
      expect(entry.over.map((o) => o.item.masterCode)).toEqual(["W4230"]);
      expect(stackersOn(result.placed, entry.over[0]!.item.uid).map((item) => item.masterCode)).toEqual(["W4218GD"]);
    }
    expect(result.reviewFindings.some((f) => f.code === "b42-glass-single-upper")).toBe(true);
  });

  it("on a 30 in wall program with no glass stacker for a 21 or a 42: the upper is left out, couldn't be met, no non-glass box in the glass spot", () => {
    const { result, room } = run({ preferences: GLASS, wall: no21Glass });
    const bottom = bottomB42(result.placed, room);
    expect(bottom.length).toBeGreaterThan(0);
    for (const entry of bottom) expect(entry.over.map((o) => o.item.masterCode)).toEqual([]);
    expect(result.reviewFindings.some((f) => f.code === "b42-glass-not-met" && f.severity === "warning")).toBe(true);
  });

  it("with glass off the same catalog still gets two W2130s (rule 1b only applies with glass)", () => {
    const { result, room } = run({ wall: no21Glass });
    for (const entry of bottomB42(result.placed, room)) expect(entry.over.map((o) => o.item.masterCode)).toEqual(["W2130", "W2130"]);
  });
});

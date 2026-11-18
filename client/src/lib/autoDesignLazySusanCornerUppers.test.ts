import { describe, expect, it } from "vitest";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake, type PreferenceId } from "./autoDesignFifteenRules";
import { applyLazySusanCornerUppers, lazySusanCornerClass, lazySusanCornerLegs, tileUpperSpan } from "./autoDesignLazySusanCornerUppers";
import {
  appliancesForRoom, applianceAsDesignCabinet, cabinetWall, elevationBox, isCornerCabinet, isFillerItem, isPanelItem, isStacker,
  wallPlacementAt, wallRunOffset, wallRunSpan, type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

/**
 * Tom, Nov 18 2026 (voice 10:28-10:34 AM CT), lazy Susan corner uppers on the
 * Aero Solstice line, 192 x 144 U-shape, 108 in ceiling:
 *  - 33 in lazy Susan (ERB33): DCW24<h> + a W09<h> on each leg, glass not selected.
 *    With glass selected the 9s are skipped and the leg is filled from the
 *    diagonal with glass-capable widths (each gets its same-width stacker).
 *  - 36 in lazy Susan (ERB36): DCW24<h> + a W12<h> on each leg.
 *  - The open span after the flank is filled from the catalog.
 */
const LIVE = live as unknown as {
  base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall: DesignCabinet[];
  surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] };
};

type RunOpts = { base?: DesignCabinet[]; wall?: DesignCabinet[]; heightIn?: number; preferences?: PreferenceId[] };

function run(opts: RunOpts = {}): { result: AutoDesignLayoutSuccess; room: RoomData } {
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
    room, openings: [], baseCatalog: opts.base ?? LIVE.base, wallCatalog: wall, fillers: LIVE.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(wall, LIVE.surround.deepAbove ?? []),
    refrigeratorEndPanels: LIVE.surround.endPanels ?? [], tallCatalog: LIVE.tall, panelCatalog: LIVE.accessory,
    styleId: 390019, makeUid: () => `ls-${++uid}`,
  } as never);
  if (!result.ok) throw new Error(result.message);
  return { result, room };
}

/** Aero without the ERB36, so the lazy Susan corners are the ERB33. */
const BASE_33 = LIVE.base.filter((row) => row.masterCode !== "ERB36");

const span = (item: PlacedCabinet, wall: string, room: RoomData) => {
  const start = wallRunOffset(item, wall, room);
  return { start: Math.round(start * 100) / 100, end: Math.round((start + wallRunSpan(item, wall, room)) * 100) / 100 };
};

/** Each lazy Susan corner with its diagonal upper and the leg uppers in order away from the corner. */
function cornerLegs(placed: readonly PlacedCabinet[], room: RoomData) {
  return placed.filter((item) => lazySusanCornerClass(item) != null).map((corner) => {
    const own = corner.wallId!;
    const c = span(corner, own, room);
    const upper = placed.find((item) => item.placement === "wall" && !isStacker(item) && isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null)
      && cabinetWall(item, room) === own && (() => { const u = span(item, own, room); return u.start < c.end - 0.3 && u.end > c.start + 0.3; })())!;
    const legs = lazySusanCornerLegs(corner, room).map((leg) => {
      const u = span(upper, leg.wall, room);
      const row = placed.filter((item) => item.placement === "wall" && cabinetWall(item, room) === leg.wall && !isStacker(item) && item.uid !== upper.uid && !isPanelItem(item))
        .map((item) => ({ item, ...span(item, leg.wall, room) }))
        .filter((entry) => leg.atStart ? entry.start >= u.end - 0.3 : entry.end <= u.start + 0.3)
        .sort((a, b) => leg.atStart ? a.start - b.start : b.end - a.end);
      return { wall: leg.wall, edge: leg.atStart ? u.end : u.start, atStart: leg.atStart, row };
    });
    return { corner, upper, legs };
  });
}

const stackerOn = (placed: readonly PlacedCabinet[], item: PlacedCabinet) => placed.find((other) => isStacker(other) && other.stackedOnCabinetUid === item.uid);

describe("33 in lazy Susan: DCW24 + W09 on each leg (glass not selected)", () => {
  const { result, room } = run({ base: BASE_33 });
  const corners = cornerLegs(result.placed, room);

  it("seats ERB33 corners with DCW2430 and a W0930 flush on both legs", () => {
    expect(corners.length).toBe(2);
    for (const { corner, upper, legs } of corners) {
      expect(corner.masterCode).toBe("ERB33");
      expect(upper.masterCode).toBe("DCW2430");
      expect(legs).toHaveLength(2);
      for (const leg of legs) {
        const first = leg.row[0]!;
        expect(first.item.masterCode, `${leg.wall} flank`).toBe("W0930");
        expect(leg.atStart ? first.start : first.end).toBeCloseTo(leg.edge, 1);
        expect(elevationBox(first.item, room).bottom).toBeCloseTo(elevationBox(upper, room).bottom, 1);
      }
    }
    expect(result.reviewFindings.filter((f) => f.code === "lazy-susan-corner-uppers-not-met")).toEqual([]);
  });

  it("keeps the W0930s through every later pass and leaves the B42 pairs alone", () => {
    expect(result.placed.filter((item) => item.masterCode === "W0930")).toHaveLength(4);
    const bottomB42 = result.placed.filter((item) => item.wallId === "bottom" && item.masterCode === "B42");
    for (const base of bottomB42) {
      const b = span(base, "bottom", room);
      const over = result.placed.filter((item) => item.wallId === "bottom" && item.placement === "wall" && !isStacker(item))
        .map((item) => ({ item, ...span(item, "bottom", room) })).filter((e) => e.start < b.end - 0.1 && e.end > b.start + 0.1);
      expect(over.map((e) => e.item.masterCode)).toEqual(["W2130", "W2130"]);
    }
  });

  it("at 42 in: DCW2442 + W0942", () => {
    const tall = run({ base: BASE_33, heightIn: 42 });
    for (const { upper, legs } of cornerLegs(tall.result.placed, tall.room)) {
      expect(upper.masterCode).toBe("DCW2442");
      for (const leg of legs) expect(leg.row[0]!.item.masterCode).toBe("W0942");
    }
  });

  it("no W09 at the height: a couldn't-be-met line, nothing substituted", () => {
    const noNine = run({ base: BASE_33, wall: LIVE.wall.filter((row) => row.masterCode !== "W0930") });
    expect(noNine.result.reviewFindings.some((f) => f.code === "lazy-susan-corner-uppers-not-met")).toBe(true);
    expect(noNine.result.placed.some((item) => item.masterCode === "W0930")).toBe(false);
  });
});

describe("33 in lazy Susan with glass selected: no 9s, leg filled from the diagonal with glass-capable widths", () => {
  const { result, room } = run({ base: BASE_33, preferences: ["glass-uppers"] });
  const corners = cornerLegs(result.placed, room);

  it("places no W0930 and leaves no gap after the DCW2430", () => {
    expect(result.placed.some((item) => /^W09/.test(item.masterCode))).toBe(false);
    expect(corners.length).toBe(2);
    for (const { upper, legs } of corners) {
      expect(upper.masterCode).toBe("DCW2430");
      for (const leg of legs) {
        const first = leg.row[0]!;
        expect(leg.atStart ? first.start : first.end, `${leg.wall} first upper starts at the diagonal`).toBeCloseTo(leg.edge, 1);
        expect(Number(first.item.width)).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("every leg upper has its same-width glass stacker and the tops stay flush", () => {
    const tops = new Set<number>();
    for (const { upper, legs } of corners) {
      const cap = stackerOn(result.placed, upper);
      expect(cap, "diagonal has a stacker").toBeTruthy();
      tops.add(Math.round((elevationBox(cap!, room).bottom + elevationBox(cap!, room).height) * 10) / 10);
      for (const leg of legs) {
        const first = leg.row[0]!.item;
        expect(isFillerItem(first)).toBe(false);
        const stacker = stackerOn(result.placed, first);
        expect(stacker, `${first.masterCode} on ${leg.wall} has a glass stacker`).toBeTruthy();
        expect(Number(stacker!.width)).toBeCloseTo(Number(first.width), 1);
        tops.add(Math.round((elevationBox(stacker!, room).bottom + elevationBox(stacker!, room).height) * 10) / 10);
      }
    }
    expect(tops.size).toBe(1);
  });
});

describe("36 in lazy Susan: DCW24 + W12 on each leg", () => {
  it("at 30 in: ERB36 gets DCW2430 + W1230 on both legs", () => {
    const { result, room } = run();
    const corners = cornerLegs(result.placed, room);
    expect(corners.length).toBe(2);
    for (const { corner, upper, legs } of corners) {
      expect(corner.masterCode).toBe("ERB36");
      expect(upper.masterCode).toBe("DCW2430");
      expect(legs).toHaveLength(2);
      for (const leg of legs) {
        expect(leg.row[0]!.item.masterCode).toBe("W1230");
        expect(leg.atStart ? leg.row[0]!.start : leg.row[0]!.end).toBeCloseTo(leg.edge, 1);
      }
    }
  });

  it("at 42 in: DCW2442 + W1242", () => {
    const { result, room } = run({ heightIn: 42 });
    for (const { upper, legs } of cornerLegs(result.placed, room)) {
      expect(upper.masterCode).toBe("DCW2442");
      for (const leg of legs) expect(leg.row[0]!.item.masterCode).toBe("W1242");
    }
  });
});

describe("open span after the corner flank is filled from the catalog", () => {
  it("tiles one exact width first, else the fewest pieces, never 39 or 9", () => {
    const widths = [12, 15, 18, 21, 24, 27, 30, 33, 36];
    expect(tileUpperSpan(30, widths, 3)).toEqual({ pieces: [30], remainder: 0 });
    expect(tileUpperSpan(21, widths, 3)).toEqual({ pieces: [21], remainder: 0 });
    expect(tileUpperSpan(42, widths, 3)!.pieces).toHaveLength(2);
    expect(tileUpperSpan(20.25, widths, 3)).toEqual({ pieces: [18], remainder: 2.25 });
    expect(tileUpperSpan(8, widths, 3)).toBeNull();
  });

  function reopenRightLeg(openTo: number) {
    const { result, room } = run();
    const height = 30;
    // Clear the uppers on the right wall after the top-right corner's W1230 (24-36) and
    // stand a panel at `openTo`, so the span 36..openTo is open after the flank.
    const kept = result.placed.filter((item) => {
      if (cabinetWall(item, room) !== "right" || item.placement === "base") return true;
      if (/RANGE/i.test(item.masterCode)) return true;
      const s = span(item, "right", room);
      return s.end <= 36.3 || s.start >= 108 - 0.3;
    });
    const panel = { ...result.placed.find((item) => item.masterCode === "WSV30")!, uid: "probe-panel" };
    const at = { ...panel, ...wallPlacementAt(openTo, Number(panel.width), Number(panel.depth), "right", room) } as PlacedCabinet;
    const out = applyLazySusanCornerUppers({
      placed: [...kept, at], room, openings: [], wallCatalog: LIVE.wall, heightIn: height, glass: false, styleId: 390019,
      makeUid: (() => { let n = 0; return () => `fill-${++n}`; })(),
    });
    return out.placed.filter((item) => item.placement === "wall" && cabinetWall(item, room) === "right" && !isPanelItem(item))
      .map((item) => ({ code: item.masterCode, ...span(item, "right", room) })).filter((e) => e.start >= 35.7 && e.end <= openTo + 0.3);
  }

  it("30 in of open wall after the W1230 gets a W3030", () => {
    expect(reopenRightLeg(66)).toEqual([{ code: "W3030", start: 36, end: 66 }]);
  });

  it("21 in of open wall after the W1230 gets a W2130", () => {
    expect(reopenRightLeg(57)).toEqual([{ code: "W2130", start: 36, end: 57 }]);
  });
});

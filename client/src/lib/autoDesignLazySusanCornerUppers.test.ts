import { describe, expect, it } from "vitest";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake, type PreferenceId } from "./autoDesignFifteenRules";
import { lazySusanCornerClass, lazySusanCornerLegs } from "./autoDesignLazySusanCornerUppers";
import {
  appliancesForRoom, applianceAsDesignCabinet, cabinetWall, elevationBox, isCornerCabinet, isPanelItem, isStacker,
  wallRunOffset, wallRunSpan, type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

/**
 * Tom, Nov 18 2026 (voice 10:28-10:34 AM CT), lazy Susan corner uppers on the
 * Aero Solstice line, 192 x 144 U-shape, 108 in ceiling:
 *  - 33 in lazy Susan (ERB33): DCW24<h> + a W09<h> on each leg, glass not selected.
 *    With glass selected the 9s are skipped.
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

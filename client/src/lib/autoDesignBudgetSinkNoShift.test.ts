import { describe, expect, it } from "vitest";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import pelicanRows from "./__fixtures__/pelicanCatalogRows.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import type { AutoDesignSinkProduct } from "./autoDesignSink";
import {
  appliancesForRoom, applianceAsDesignCabinet, cabinetWall, isRangeOrOven, isSinkBaseCabinet, wallRunOffset, wallRunSpan, DEFAULT_ROOM,
  type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

// Tom, owner voice, Nov 20 2026 ("All"): the budget sink/faucet pick (PR 466) must not move the range or the sink. Before 466 the sink base
// was the measured size; 466 widened an SB30/SB33 to SB36, which re-packed the run and moved the sink (+3 to +4.5 in), the dishwasher and
// the range. The pick may now only choose the lowest-priced base AT THE MEASURED WIDTH. "Pre-466" is the same build with no line sinks,
// which makes pickBudgetSinkBase return null, so the measured base is seated exactly as before 466.
const pack = (matrix as any)["330014"];
const REAL_330014 = new Map<number, number>([[9390219, 299.41], [9360035, 323.13], [9360036, 327.41], [9390222, 379.12], [9390223, 414.89], [9390224, 269.47]]);
const sinkRows = (pelicanRows as Array<Record<string, unknown>>)
  .filter((row) => row.subCategory === "Sinks")
  .map((row) => ({ id: Number(row.id), pelicanCode: row.pelicanCode as string, name: row.name as string, category: row.category as string, subCategory: "Sinks", size: (row.size as string) ?? null, sellPrice: (row.sellPrice as number) ?? null })) as AutoDesignSinkProduct[];

type Scenario = { name: string; room: RoomData; layout: string; sink: [string, number]; stove: [string, number]; fridge: [string, number] };
const SCENARIOS: Scenario[] = [
  { name: "L 144x120", room: { width: 144, depth: 120, ceilingHeight: 96 } as RoomData, layout: "l-shape", sink: ["Wall 2", 70], stove: ["Wall 1", 75], fridge: ["Wall 1", 18] },
  { name: "U 170x170", room: { width: 170, depth: 170, ceilingHeight: 96 } as RoomData, layout: "u-shape", sink: ["Wall 1", 85], stove: ["Wall 2", 54], fridge: ["Wall 3", 60] },
];

function build(sc: Scenario, sinkBaseWidthIn: number, opts: { catalogSinks: boolean; prices?: ReadonlyMap<number, number> | null; baseCatalog?: DesignCabinet[] }) {
  let uid = 0;
  return runAutoDesignLayout({
    input: {
      layoutType: sc.layout, originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: sc.fridge[0], centerOffsetIn: sc.fridge[1] }, refrigeratorWidthIn: 36,
      stove: { wallLabel: sc.stove[0], centerOffsetIn: sc.stove[1] },
      sink: { wallLabel: sc.sink[0], centerOffsetIn: sc.sink[1] }, sinkBaseWidthIn, sinkBaseKind: "regular",
      dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: ["budget-friendly"], islandOrPeninsula: "none",
        canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } },
    } as never,
    room: sc.room, openings: [], baseCatalog: opts.baseCatalog ?? pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])],
    sinkCatalog: opts.catalogSinks ? sinkRows : [], faucetCatalog: [], styleId: 330014,
    cabinetPriceById: opts.prices === undefined ? REAL_330014 : opts.prices, makeUid: () => `s-${++uid}`,
  } as never) as any;
}

function centerlines(sc: Scenario, placed: PlacedCabinet[]) {
  const room = { ...DEFAULT_ROOM, ...sc.room } as RoomData;
  const center = (p: PlacedCabinet | undefined) => {
    if (!p) return null;
    const wall = cabinetWall(p, room);
    return { wall, c: Math.round((wallRunOffset(p, wall, room) + wallRunSpan(p, wall, room) / 2) * 100) / 100, w: Number(p.width) };
  };
  return {
    sink: center(placed.find((p) => p.placement === "base" && isSinkBaseCabinet(p))),
    range: center(placed.find((p) => p.placement === "appliance" && isRangeOrOven(p.masterCode, p.description))),
    dishwasher: center(placed.find((p) => p.placement === "appliance" && /^DW/i.test(p.masterCode))),
  };
}

describe("budget sink pick never moves the range or the sink (regression vs pre-466)", () => {
  for (const sc of SCENARIOS) {
    for (const measured of [30, 33, 36]) {
      it(`${sc.name}, measured SB${measured}: sink, dishwasher and range centerlines equal the pre-466 build`, () => {
        const before = build(sc, measured, { catalogSinks: false });
        const after = build(sc, measured, { catalogSinks: true });
        expect(before.ok).toBe(true);
        expect(after.ok).toBe(true);
        const was = centerlines(sc, before.placed);
        expect(was.sink).not.toBeNull();
        expect(was.range).not.toBeNull();
        expect(centerlines(sc, after.placed)).toEqual(was);
      });
    }
  }

  it("at the measured width the lowest-priced base is still picked (a cheaper twin SB36 wins) and nothing moves", () => {
    const sb36 = (pack.base as DesignCabinet[]).find((r) => r.masterCode === "SB36")!;
    const twin = { ...sb36, id: 1, masterCode: "SB36X" } as DesignCabinet;
    const prices = new Map<number, number>([[sb36.id, 400], [1, 350]]);
    const sc = SCENARIOS[0]!;
    const before = build(sc, 36, { catalogSinks: false });
    const after = build(sc, 36, { catalogSinks: true, prices, baseCatalog: [...pack.base, twin] });
    expect(after.placed.map((p: PlacedCabinet) => p.masterCode)).toContain("SB36X");
    expect(centerlines(sc, after.placed)).toEqual(centerlines(sc, before.placed));
  });

  it("a different-width pick is reported, not applied: SB30 stays SB30S and the note names SB36", () => {
    const sc = SCENARIOS[0]!;
    const after = build(sc, 30, { catalogSinks: true });
    expect(after.placed.map((p: PlacedCabinet) => p.masterCode)).toContain("SB30S");
    expect(after.notes.some((n: string) => /is SB36 \(36″\), but your plan places a 30″ sink base/.test(n))).toBe(true);
  });
});

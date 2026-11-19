import { describe, expect, it } from "vitest";
import aero from "./__fixtures__/aeroSolsticeLive390019.json";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import pelicanRows from "./__fixtures__/pelicanCatalogRows.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { pickBudgetDefaultSink, budgetSinkFits } from "./autoDesignBudgetSink";
import type { AutoDesignSinkProduct } from "./autoDesignSink";
import { appliancesForRoom, applianceAsDesignCabinet, type RoomData } from "./design";

const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
const sinkRows = (pelicanRows as Array<Record<string, unknown>>)
  .filter((row) => row.subCategory === "Sinks")
  .map((row) => ({ id: Number(row.id), pelicanCode: row.pelicanCode as string, name: row.name as string, category: row.category as string, subCategory: "Sinks", size: (row.size as string) ?? null, sellPrice: (row.sellPrice as number) ?? null })) as AutoDesignSinkProduct[];

function build(pack: any, styleId: number, budget: boolean, sinkCatalog: AutoDesignSinkProduct[] = []) {
  let uid = 0;
  return runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
      stove: { wallLabel: "Wall 1", centerOffsetIn: 75 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 70 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: budget ? ["budget-friendly"] : [], islandOrPeninsula: "none",
        canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } },
    } as never,
    room: ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])],
    sinkCatalog, styleId, makeUid: () => `s-${++uid}`,
  } as never) as any;
}

describe("Budget friendly picks the sink without asking (Tom, voice, Nov 19 2026, 8:40 AM CT)", () => {
  it("fit rule: sink width <= base width - 3 in and minimum cabinet width <= base width", () => {
    expect(budgetSinkFits({ widthIn: 33, minimumCabinetWidthIn: 33 }, 36)).toBe(true);
    expect(budgetSinkFits({ widthIn: 33.5, minimumCabinetWidthIn: 33 }, 36)).toBe(false);
    expect(budgetSinkFits({ widthIn: 30, minimumCabinetWidthIn: 36.5 }, 36)).toBe(false);
  });

  it("12x10 L, Aero 390019, line sells no sink: the verified Pelican default double bowl that fits SB36, reported, not priced", () => {
    const r = build(aero, 390019, true);
    expect(r.ok).toBe(true);
    const sink = r.sinks[0];
    expect(sink.pelicanProfileId).toBeTruthy();
    expect(sink.pelicanProductId).toBeUndefined();
    expect(sink.bowlCount).toBe(2);
    expect(sink.width).toBeLessThanOrEqual(33.001);
    const note = r.notes.find((n: string) => /^Budget friendly: the line sells no sink, so the default/.test(n));
    expect(note).toMatch(/PL-VS4060/);
    expect(note).toMatch(/sink width ≤ base width − 3″/);
  });

  it("330014 (matrix line), no sink rows: same verified default", () => {
    const r = build((matrix as any)["330014"], 330014, true);
    expect(r.ok, r.message).toBe(true);
    expect(r.notes.some((n: string) => /^Budget friendly: the line sells no sink, so the default .*PL-VS4060/.test(n))).toBe(true);
  });

  it("with real catalog sink rows: a priced catalog row is picked and seated (billable product id)", () => {
    const r = build(aero, 390019, true, sinkRows);
    const sink = r.sinks[0];
    expect(sink.pelicanProductId).toBeGreaterThan(0);
    expect(sinkRows.some((row) => row.id === sink.pelicanProductId)).toBe(true);
    expect(sink.width).toBeLessThanOrEqual(33.001);
    expect(r.notes.some((n: string) => /^Budget friendly: the sink was picked for you, no question asked/.test(n))).toBe(true);
  });

  it("nothing fits anywhere: placeholder basin and a clear report, nothing invented", () => {
    const pick = pickBudgetDefaultSink({ base: { width: 12, masterCode: "SB12", description: "Sink Base", subCategory: "" }, lineProducts: [] });
    expect(pick.source).toBe("none");
    expect(pick.note).toMatch(/no sink in the line or the verified Pelican catalog/);
  });

  it("non-budget behavior unchanged: no automatic sink product", () => {
    const r = build(aero, 390019, false, sinkRows);
    expect(r.sinks[0].pelicanProductId).toBeUndefined();
    expect(r.notes.some((n: string) => /^Budget friendly: .*sink/.test(n))).toBe(false);
  });
});

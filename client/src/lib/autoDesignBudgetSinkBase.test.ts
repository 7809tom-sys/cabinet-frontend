import { describe, expect, it } from "vitest";
import matrix from "./__fixtures__/autoDesignMatrixCatalog.json";
import pelicanRows from "./__fixtures__/pelicanCatalogRows.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { pickBudgetSinkBase } from "./autoDesignBudgetSink";
import type { AutoDesignSinkProduct } from "./autoDesignSink";
import { appliancesForRoom, applianceAsDesignCabinet, type DesignCabinet, type RoomData } from "./design";

// Budget friendly picks the sink BASE too (Tom, voice, Nov 19 2026, 9:01 AM CT; code go 1:26 PM CT):
// the smallest, lowest-priced regular sink base that takes a double-bowl sink.

const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
const pack = (matrix as any)["330014"];
const baseCatalog = pack.base as DesignCabinet[];
// REAL live homeowner prices for style 330014 (cabinetdealz.com design.priceForCabinetsByStyles, Nov 19 2026 ~2:40 PM CT).
const REAL_330014 = new Map<number, number>([[9390219, 299.41], [9360035, 323.13], [9360036, 327.41], [9390222, 379.12], [9390223, 414.89], [9390224, 269.47]]);
const sinkRows = (pelicanRows as Array<Record<string, unknown>>)
  .filter((row) => row.subCategory === "Sinks")
  .map((row) => ({ id: Number(row.id), pelicanCode: row.pelicanCode as string, name: row.name as string, category: row.category as string, subCategory: "Sinks", size: (row.size as string) ?? null, sellPrice: (row.sellPrice as number) ?? null })) as AutoDesignSinkProduct[];

function build(budget: boolean, sinkBaseWidthIn: 30 | 33 | 36 | 42, prices: ReadonlyMap<number, number> | null = REAL_330014) {
  let uid = 0;
  return runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
      stove: { wallLabel: "Wall 1", centerOffsetIn: 75 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 70 }, sinkBaseWidthIn, sinkBaseKind: "regular",
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
    sinkCatalog: sinkRows, faucetCatalog: [], styleId: 330014, cabinetPriceById: prices, makeUid: () => `s-${++uid}`,
  } as never) as any;
}

describe("Budget friendly sink base pick (smallest, lowest-priced double-bowl sink base)", () => {
  it("line 330014, real prices: SB36 ($327.41) is the smallest base that takes a double bowl (SB30S/SB33 cannot)", () => {
    const pick = pickBudgetSinkBase({ baseCatalog, lineSinkProducts: sinkRows, priceByCabinetId: REAL_330014 });
    expect(pick?.row.masterCode).toBe("SB36");
    expect(pick?.widthIn).toBe(36);
    expect(pick?.priceUsd).toBe(327.41);
    expect(pick?.note).toMatch(/SB36, 36″, \$327\.41, the smallest regular sink base the line sells that takes the double-bowl sink PL-VS5050 18g \(32\.125″ wide\)/);
  });

  it("never picks farmhouse, ADA, vanity or corner sink bases", () => {
    const pick = pickBudgetSinkBase({ baseCatalog, lineSinkProducts: sinkRows, priceByCabinetId: REAL_330014 });
    expect(pick?.row.masterCode).not.toMatch(/^F|ADA|^V|^L/);
  });

  it("no prices loaded: still picks by width (plain SB first), says no price was available, invents nothing", () => {
    const pick = pickBudgetSinkBase({ baseCatalog, lineSinkProducts: sinkRows, priceByCabinetId: null });
    expect(pick?.row.masterCode).toBe("SB36");
    expect(pick?.priceUsd).toBeNull();
    expect(pick?.note).toMatch(/no catalog price available to rank it/);
  });

  it("a smaller base wins when the line sells a double bowl that fits it (test-only sink row)", () => {
    // Test-only double-bowl row (not catalog data): 24 in wide, so it needs a base of 27 in or more -> SB30S.
    const small: AutoDesignSinkProduct = { id: 99001, pelicanCode: null, name: "TEST double-bowl undermount", category: "Sinks", subCategory: "Sinks", size: "24 x 18", description: "double bowl", sellPrice: 50 } as never;
    const pick = pickBudgetSinkBase({ baseCatalog, lineSinkProducts: [small], priceByCabinetId: REAL_330014 });
    expect(pick?.row.masterCode).toBe("SB30S");
    expect(pick?.priceUsd).toBe(299.41);
  });

  it("among bases of the same width the lowest real price wins (test-only second SB36 row and test-only prices)", () => {
    const sb36 = baseCatalog.find((r) => r.masterCode === "SB36")!;
    const twin = { ...sb36, id: 1, masterCode: "SB36X" } as DesignCabinet;
    const prices = new Map<number, number>([[sb36.id, 400], [1, 350]]);
    const pick = pickBudgetSinkBase({ baseCatalog: [...baseCatalog, twin], lineSinkProducts: sinkRows, priceByCabinetId: prices });
    expect(pick?.row.masterCode).toBe("SB36X");
    expect(pick?.note).toMatch(/lowest-priced base at that width/);
  });

  it("line sells no double-bowl sink: null, so the measured base is kept and the verified default is unchanged", () => {
    const singlesOnly = sinkRows.filter((r) => !/VS(?:3070|4040|4060|5050|7030)|VR(?:4060|5050|6040)|HA1(?:17|25|26|28|30|36|39)/.test(r.pelicanCode ?? ""));
    expect(pickBudgetSinkBase({ baseCatalog, lineSinkProducts: singlesOnly, priceByCabinetId: REAL_330014 })).toBeNull();
  });

  it("no base takes a double bowl: null, so the measured base is kept", () => {
    const only30 = baseCatalog.filter((r) => r.masterCode === "SB30S" || !/^SB3[36]$/.test(r.masterCode));
    expect(pickBudgetSinkBase({ baseCatalog: only30, lineSinkProducts: sinkRows, priceByCabinetId: REAL_330014 })).toBeNull();
  });

  it("engine, budget on: a measured SB30 request keeps SB30S (the cheapest base is a different width, so nothing moves) and the note names SB36", () => {
    const r = build(true, 30);
    expect(r.ok).toBe(true);
    const codes = r.placed.map((p: any) => p.masterCode);
    expect(codes).toContain("SB30S");
    expect(codes).not.toContain("SB36");
    expect(r.notes.some((n: string) => /smallest sink base that takes the lowest-priced double-bowl sink is SB36 \(36″\), but your plan places a 30″ sink base/.test(n))).toBe(true);
    expect(r.notes.some((n: string) => /sink base was picked for you/.test(n))).toBe(false);
    expect(r.notes.some((n: string) => /PL-VS5050 18g.*\$119\.97.*double-bowl/.test(n) || /double-bowl/.test(n))).toBe(true);
  });

  it("engine, budget on: a measured SB36 request takes the picked SB36 with the sink-base note", () => {
    const r = build(true, 36);
    expect(r.ok).toBe(true);
    expect(r.placed.map((p: any) => p.masterCode)).toContain("SB36");
    expect(r.notes.some((n: string) => /^Budget friendly: the sink base was picked for you, no question asked: SB36, 36″, \$327\.41/.test(n))).toBe(true);
    expect(r.notes.some((n: string) => /PL-VS5050 18g.*\$119\.97.*double-bowl/.test(n))).toBe(true);
  });

  it("engine, budget off: the measured SB30 request is untouched and no sink-base note is written", () => {
    const r = build(false, 30);
    expect(r.ok).toBe(true);
    expect(r.placed.map((p: any) => p.masterCode)).toContain("SB30S");
    expect(r.notes.some((n: string) => /sink base was picked for you/.test(n))).toBe(false);
  });
});

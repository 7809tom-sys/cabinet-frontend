import { describe, expect, it } from "vitest";
import { cabinetPlacementCollisionDetail, DEFAULT_ROOM, wallPlacementAt, wallRunOffset, wallRunSpan, type PlacedCabinet } from "./design";
import {
  applyAutomaticSinkBaseSubstitutions,
  applyInventorySuggestion,
  evaluateDesignInventory,
  inventoryCornerKind,
  sinkBaseSubstitutionOrderNote,
  type InventoryCatalogCandidate,
  type InventorySuggestion,
} from "./inventoryAlternatives";
import { buildDesignCabinetCartLines } from "./designCartLines";
import { resetKitchenRuleParameters, setKitchenRuleParameters, setKitchenRuleTextParameters } from "./kitchenRuleParameters";
import {
  INVENTORY_SIM_FIXTURE_OUT_OF_STOCK,
  StubInventoryProvider,
  UnknownInventoryProvider,
  VendorApiInventoryProvider,
  parseInventorySimulationValue,
  readInventorySimulation,
  resolveDesignerInventoryProvider,
  stockStatusFromVendorRecord,
  type InventoryProvider,
} from "./inventoryProvider";

const STYLE = 11;
const OTHER_STYLE = 12;
const VENDOR = 7;

function place(masterCode: string, width: number, offset: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const placement = extra.placement ?? "base";
  const depth = extra.depth ?? (placement === "wall" ? 12 : 24);
  const spot = wallPlacementAt(offset, width, depth, "top", DEFAULT_ROOM);
  return {
    uid: `${masterCode}-${offset}`,
    cabinetId: 1,
    description: "Base cabinet",
    category: "Base",
    subCategory: "Base",
    x: spot.x,
    y: spot.y,
    height: placement === "wall" ? 30 : 34.5,
    rotation: spot.rotation,
    wallId: spot.wallId ?? "top",
    wallOffset: spot.wallOffset ?? offset,
    numberOfDoors: placement === "base" ? 2 : 1,
    numberOfDrawers: 0,
    ...extra,
    masterCode,
    width,
    placement,
    depth,
  };
}

function item(partial: Partial<InventoryCatalogCandidate> & Pick<InventoryCatalogCandidate, "masterCode">): InventoryCatalogCandidate {
  const placement = partial.placement ?? "base";
  return {
    id: partial.id ?? Math.abs(hashCode(partial.masterCode + String(partial.styleId ?? STYLE))),
    description: partial.description ?? partial.masterCode,
    width: partial.width ?? 36,
    height: partial.height ?? (placement === "wall" ? 30 : 34.5),
    depth: partial.depth ?? (placement === "wall" ? 12 : 24),
    placement,
    styleId: partial.styleId ?? STYLE,
    distributorId: partial.distributorId ?? VENDOR,
    doorStyleName: partial.doorStyleName ?? (partial.styleId === OTHER_STYLE ? "Slab" : "Shaker"),
    numberOfDoors: partial.numberOfDoors ?? 2,
    numberOfDrawers: partial.numberOfDrawers ?? 0,
    category: partial.category ?? "Base",
    subCategory: partial.subCategory ?? "Base",
    ...partial,
  };
}

function hashCode(value: string): number {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) + 20;
}

function stub(outOfStock: readonly string[]): InventoryProvider {
  return new StubInventoryProvider({ outOfStock });
}

async function suggest(
  outOfStock: readonly string[],
  placed: PlacedCabinet[],
  catalog: InventoryCatalogCandidate[],
  provider: InventoryProvider = stub(outOfStock),
) {
  return evaluateDesignInventory({
    provider,
    placed,
    catalog,
    room: DEFAULT_ROOM,
    designStyleId: STYLE,
    distributorId: VENDOR,
    limit: 20,
  });
}

function codes(suggestions: readonly InventorySuggestion[]): string[] {
  return suggestions.map((suggestion) => (
    suggestion.kind === "single"
      ? suggestion.candidate.masterCode
      : suggestion.candidates.map((candidate) => candidate.masterCode).join("+")
  ));
}

describe("inventory provider", () => {
  it("keeps production on the unknown provider, including for non-admins who pass the simulation flag", () => {
    expect(resolveDesignerInventoryProvider({ isAdmin: false, search: "?inventorySim=B36", storedFlag: "B36" }).id).toBe("unknown");
    expect(resolveDesignerInventoryProvider({ isAdmin: true, search: "", storedFlag: null }).id).toBe("unknown");
    expect(resolveDesignerInventoryProvider({ isAdmin: true, search: "?inventorySim=0", storedFlag: "B36" }).id).toBe("unknown");
    const simulated = resolveDesignerInventoryProvider({ isAdmin: true, search: "?inventorySim=B36,W3012", storedFlag: null });
    expect(simulated.id).toBe("stub");
    const rows = simulated.getStockStatus(["B36", "W3012", "B24"]);
    expect(Array.isArray(rows)).toBe(true);
    if (rows instanceof Promise) throw new Error("stub provider is synchronous");
    expect(rows.map((row) => [row.sku, row.status])).toEqual([
      ["B36", "out_of_stock"],
      ["W3012", "out_of_stock"],
      ["B24", "unknown"],
    ]);
  });

  it("reads the fixture, a chosen SKU list, and localStorage", () => {
    expect(parseInventorySimulationValue("1")).toEqual({ enabled: true, skus: null });
    expect(readInventorySimulation("", "11:B36").enabled).toBe(true);
    expect(readInventorySimulation("inventorySim=BBC36,DB24", "B36")).toEqual({ enabled: true, skus: ["BBC36", "DB24"] });
    const fixture = resolveDesignerInventoryProvider({ isAdmin: true, search: "?inventorySim=fixture", storedFlag: null });
    const rows = fixture.getStockStatus([...INVENTORY_SIM_FIXTURE_OUT_OF_STOCK, "B24"]);
    if (rows instanceof Promise) throw new Error("stub provider is synchronous");
    expect(rows.find((row) => row.sku === "B24")?.status).toBe("unknown");
    expect(rows.filter((row) => row.status === "out_of_stock").map((row) => row.sku)).toEqual([...INVENTORY_SIM_FIXTURE_OUT_OF_STOCK]);
  });

  it("maps a future vendor row without treating a missing quantity as out of stock", () => {
    expect(stockStatusFromVendorRecord({ sku: "B24", quantityOnHand: null }).status).toBe("unknown");
    expect(stockStatusFromVendorRecord({ sku: "B36", quantityOnHand: 0 }).status).toBe("out_of_stock");
    expect(stockStatusFromVendorRecord({ sku: "B18", quantityOnHand: 2, vendor: "acme" })).toMatchObject({ status: "low", qtyAvailable: 2, vendor: "acme" });
    expect(stockStatusFromVendorRecord({ sku: "B12", quantityOnHand: 8 }).status).toBe("in_stock");
    const placeholder = new VendorApiInventoryProvider();
    expect(placeholder.configured).toBe(false);
    expect(placeholder.getStockStatus(["B36"])).toEqual([{ sku: "B36", status: "unknown" }]);
    expect(resolveDesignerInventoryProvider({ isAdmin: true, search: "?inventorySim=1", storedFlag: null }).id).not.toBe("vendor-api");
  });
});

describe("Designer inventory alternatives", () => {
  const sameSize = [
    item({ id: 101, masterCode: "B36R", width: 36, description: "Base cabinet right" }),
    item({ id: 102, masterCode: "B36", width: 36, styleId: OTHER_STYLE, doorStyleName: "Slab" }),
    item({ id: 103, masterCode: "B18", width: 18 }),
    item({ id: 104, masterCode: "W36", width: 36, height: 34.5, depth: 24, placement: "wall", description: "Wall cabinet" }),
  ];

  it("suggests the same size and type in the same door style before any other tier", async () => {
    const report = await suggest(["11:B36"], [place("B36", 36, 0)], sameSize);
    expect(report.notices).toHaveLength(1);
    expect(report.notices[0]?.status).toBe("out_of_stock");
    expect(codes(report.notices[0]?.suggestions ?? [])).toEqual(["B36R"]);
    expect(report.notices[0]?.suggestions[0]).toMatchObject({ tier: "same-style", kind: "single" });
    expect(report.notices[0]?.suggestions[0]).not.toHaveProperty("price");
    expect(report.notices[0]?.suggestions[0]).not.toHaveProperty("discountPct");
  });

  it("falls back to the same size in another door style from the same vendor", async () => {
    const report = await suggest(
      ["11:B36"],
      [place("B36", 36, 0)],
      sameSize.filter((candidate) => candidate.masterCode !== "B36R"),
    );
    expect(codes(report.notices[0]?.suggestions ?? [])).toEqual(["B36"]);
    expect(report.notices[0]?.suggestions[0]).toMatchObject({ tier: "cross-style" });
    expect(report.notices[0]?.suggestions[0]?.ruleNotes).toContain("same-vendor");
    expect(codes(report.notices[0]?.suggestions ?? [])).not.toContain("B18+B18");
  });

  it("falls back to two smaller cabinets that fill the opening exactly, with no filler", async () => {
    const report = await suggest(["11:B36", "B36"], [place("B36", 36, 0)], [
      item({ id: 201, masterCode: "B18", width: 18 }),
      item({ id: 202, masterCode: "B12", width: 12 }),
      item({ id: 203, masterCode: "B24", width: 24 }),
      item({ id: 204, masterCode: "F3", width: 3, description: "Filler", subCategory: "Filler" }),
    ]);
    expect(report.notices[0]?.suggestions[0]).toMatchObject({ kind: "combination", tier: "combination" });
    expect(codes(report.notices[0]?.suggestions ?? [])[0]).toBe("B18+B18");
    expect(report.notices[0]?.suggestions[0]?.ruleNotes).toEqual(expect.arrayContaining(["exact-opening", "no-filler", "catalog-price"]));
    expect(codes(report.notices[0]?.suggestions ?? []).join(" ")).not.toContain("F3");
    const widths = report.notices[0]?.suggestions[0]?.kind === "combination"
      ? report.notices[0].suggestions[0].candidates.map((candidate) => candidate.width)
      : [];
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(36);
  });

  it("keeps a corner on the same corner type and does not split it", async () => {
    expect(inventoryCornerKind({ masterCode: "BBC36", description: "Blind corner base", placement: "base" })).toBe("blind");
    expect(inventoryCornerKind({ masterCode: "ERB36", description: "Easy reach base", placement: "base" })).toBe("easy-reach");
    expect(inventoryCornerKind({ masterCode: "LS36", description: "Lazy susan base", placement: "base" })).toBe("easy-reach");
    expect(inventoryCornerKind({ masterCode: "DCB36", description: "Diagonal corner base", placement: "base" })).toBe("diagonal");

    const corner = place("BBC36", 36, 0, { description: "Blind corner base", cornerType: "blind-corner" });
    const catalog = [
      item({ id: 301, masterCode: "BBC36B", description: "Blind corner base", cornerType: "blind-corner" }),
      item({ id: 302, masterCode: "ERB36", description: "Easy reach base" }),
      item({ id: 303, masterCode: "DCB36", description: "Diagonal corner base" }),
      item({ id: 304, masterCode: "B36", description: "Base cabinet" }),
      item({ id: 305, masterCode: "B18", width: 18, description: "Base cabinet" }),
    ];
    const matched = await suggest(["11:BBC36"], [corner], catalog);
    expect(codes(matched.notices[0]?.suggestions ?? [])).toEqual(["BBC36B"]);
    expect(matched.notices[0]?.suggestions[0]?.ruleNotes).toContain("corner-type:blind");

    const unmatched = await suggest(["11:BBC36"], [corner], catalog.filter((candidate) => candidate.masterCode !== "BBC36B"));
    expect(unmatched.notices[0]?.suggestions).toEqual([]);

    const easyReach = place("ERB36", 36, 0, { description: "Easy reach base" });
    const easy = await suggest(["11:ERB36"], [easyReach], [
      item({ id: 311, masterCode: "LS36", description: "Lazy susan base" }),
      item({ id: 312, masterCode: "BBC36", description: "Blind corner base", cornerType: "blind-corner" }),
    ]);
    expect(codes(easy.notices[0]?.suggestions ?? [])).toEqual(["LS36"]);
  });

  it("keeps another sink base as a suggestion and never splits the opening", async () => {
    const sink = place("SB36", 36, 0, { description: "Sink base", subCategory: "Sink Base" });
    const report = await suggest(["11:SB36"], [sink], [
      item({ id: 401, masterCode: "B36", description: "Base cabinet" }),
      item({ id: 402, masterCode: "SB18", width: 18, description: "Sink base", subCategory: "Sink Base" }),
      item({ id: 403, masterCode: "SB36", description: "Sink base", subCategory: "Sink Base", styleId: OTHER_STYLE, doorStyleName: "Slab" }),
    ]);
    expect(codes(report.notices[0]?.suggestions ?? [])).toEqual(["SB36"]);
    expect(report.notices[0]?.suggestions[0]?.ruleNotes).toContain("sink-base");
    expect(report.notices[0]?.suggestions.some((suggestion) => suggestion.kind === "combination")).toBe(false);
  });

  it("keeps the cabinet beside a range at least 15 inches and beside a dishwasher flush, without a filler", async () => {
    const range = place("RANGE30", 30, 0, { placement: "appliance", description: "Freestanding range", depth: 26, height: 36, numberOfDoors: 0 });
    const besideRange = place("B30", 30, 30, { description: "Base cabinet" });
    const ranged = await suggest(["11:B30", "B30"], [range, besideRange], [
      item({ id: 501, masterCode: "B12", width: 12 }),
      item({ id: 502, masterCode: "B18", width: 18 }),
    ]);
    expect(codes(ranged.notices[0]?.suggestions ?? [])).toEqual(["B18+B12"]);

    const dishwasher = place("DW24", 24, 0, { placement: "appliance", description: "Dishwasher", depth: 24, height: 34.5, numberOfDoors: 0 });
    const besideWasher = place("B24", 24, 24, { description: "Base cabinet" });
    const washed = await suggest(["11:B24", "B24"], [dishwasher, besideWasher], [
      item({ id: 511, masterCode: "B12", width: 12 }),
      item({ id: 512, masterCode: "F3", width: 3, description: "Filler", subCategory: "Filler" }),
    ]);
    expect(codes(washed.notices[0]?.suggestions ?? [])).toEqual(["B12+B12"]);
  });

  it("does not offer a glass wall cabinet as the same type as a solid wall cabinet", async () => {
    const wall = place("W3012", 30, 0, { placement: "wall", description: "Wall cabinet", height: 12, depth: 12 });
    const report = await suggest(["11:W3012"], [wall], [
      item({ id: 601, masterCode: "W3012GD", width: 30, height: 12, depth: 12, placement: "wall", description: "Glass door wall", glassDoor: true }),
      item({ id: 602, masterCode: "W3012B", width: 30, height: 12, depth: 12, placement: "wall", description: "Wall cabinet" }),
    ]);
    expect(codes(report.notices[0]?.suggestions ?? [])).toEqual(["W3012B"]);
  });

  it("shows nothing when status is unknown, low, or in stock", async () => {
    const placed = [place("B36", 36, 0)];
    const catalog = [item({ masterCode: "B36R" })];
    const unknown = await suggest([], placed, catalog, new UnknownInventoryProvider());
    expect(unknown.notices).toEqual([]);

    const evil: InventoryProvider = {
      id: "unknown",
      getStockStatus: () => [{ sku: "B36", status: "out_of_stock", qtyAvailable: 0 }],
    };
    expect((await suggest([], placed, catalog, evil)).notices).toEqual([]);

    const low = new StubInventoryProvider({ outOfStock: [], low: ["B36"] });
    expect((await suggest([], placed, catalog, low)).notices).toEqual([]);

    const fixturePlaced = [place("BBC36", 36, 0, { description: "Blind corner base" }), place("B24", 24, 36)];
    const fixture = await suggest([], fixturePlaced, [], resolveDesignerInventoryProvider({
      isAdmin: true,
      search: "?inventorySim=1",
      storedFlag: null,
    }));
    expect(fixture.notices.map((notice) => notice.masterCode)).toEqual(["BBC36"]);
  });

  it("swaps only the chosen cabinet and does not write a price", () => {
    const original = place("B36", 36, 0, { discountPct: -10, styleId: null });
    const suggestion = {
      id: "single:11:B36R",
      kind: "single" as const,
      tier: "same-style" as const,
      candidate: item({ id: 88, masterCode: "B36R", description: "Base cabinet right" }),
      reason: "Same size.",
      ruleNotes: ["catalog-price"],
    };
    const single = applyInventorySuggestion({
      placed: [original],
      uid: original.uid,
      suggestion,
      room: DEFAULT_ROOM,
      designStyleId: STYLE,
    });
    expect(single.unchanged).toBe(false);
    expect(single.placed).toHaveLength(1);
    expect(single.placed[0]).toMatchObject({
      uid: original.uid,
      masterCode: "B36R",
      cabinetId: 88,
      discountPct: -10,
      x: original.x,
      y: original.y,
      styleId: null,
    });
    expect(single.placed[0]).not.toHaveProperty("customerPrice");
    expect(single.placed[0]).not.toHaveProperty("price");

    const opening = place("B36", 36, 12, { uid: "opening", discountPct: -25 });
    const combination = applyInventorySuggestion({
      placed: [opening],
      uid: opening.uid,
      suggestion: {
        id: "combination",
        kind: "combination",
        tier: "combination",
        candidates: [item({ id: 1, masterCode: "B18", width: 18 }), item({ id: 1, masterCode: "B18", width: 18 })],
        reason: "Two cabinets.",
        ruleNotes: ["exact-opening", "no-filler", "catalog-price"],
      },
      room: DEFAULT_ROOM,
      designStyleId: STYLE,
      makeUid: (() => {
        let n = 0;
        return () => `swap-${++n}`;
      })(),
    });
    expect(combination.unchanged).toBe(false);
    expect(combination.placed.map((cabinet) => cabinet.masterCode)).toEqual(["B18", "B18"]);
    expect(combination.placed.map((cabinet) => cabinet.discountPct)).toEqual([null, null]);
    expect(combination.placed.map((cabinet) => cabinet.width)).toEqual([18, 18]);
    expect(wallRunOffset(combination.placed[0]!, "top", DEFAULT_ROOM)).toBeCloseTo(12, 5);
    expect(wallRunOffset(combination.placed[1]!, "top", DEFAULT_ROOM)).toBeCloseTo(30, 5);
    expect(wallRunSpan(combination.placed[0]!, "top", DEFAULT_ROOM) + wallRunSpan(combination.placed[1]!, "top", DEFAULT_ROOM)).toBe(36);
    for (const cabinet of combination.placed) {
      expect(cabinetPlacementCollisionDetail(cabinet, combination.placed.filter((other) => other.uid !== cabinet.uid), DEFAULT_ROOM)).toBeNull();
      expect(cabinet).not.toHaveProperty("price");
    }
  });
});

describe("automatic out-of-stock sink base substitution", () => {
  const catalog = [
    item({ id: 301, masterCode: "B36", width: 36, description: "36 inch base cabinet", numberOfDrawers: 1, numberOfDoors: 0 }),
    item({ id: 302, masterCode: "B36", width: 36, styleId: OTHER_STYLE, description: "36 inch base cabinet" }),
    item({ id: 303, masterCode: "SB36", width: 36, styleId: OTHER_STYLE, description: "36 inch Sink Base" }),
    item({ id: 304, masterCode: "B33", width: 33, description: "33 inch base cabinet" }),
  ];
  function swap(placed: PlacedCabinet[], stockSkus: string[], extra: Partial<Parameters<typeof applyAutomaticSinkBaseSubstitutions>[0]> = {}) {
    return applyAutomaticSinkBaseSubstitutions({
      placed,
      catalog,
      stock: stockSkus.map((sku) => ({ sku, status: "out_of_stock" as const, qtyAvailable: 0 })),
      room: DEFAULT_ROOM,
      designStyleId: STYLE,
      distributorId: VENDOR,
      assumeUnlistedInStock: true,
      ...extra,
    });
  }

  it("swaps an out-of-stock SB36 for the same-style B36 and notes the exact substitution", () => {
    const sink = place("SB36", 36, 0, { description: "36 inch Sink Base", subCategory: "Sink Base" });
    const result = swap([sink], ["SB36"]);
    expect(result.swaps).toHaveLength(1);
    expect(result.placed[0]).toMatchObject({
      masterCode: "B36",
      fieldModificationNote: sinkBaseSubstitutionOrderNote("SB36", "B36", true),
    });
    expect(result.placed[0]?.styleId == null || result.placed[0]?.styleId === STYLE).toBe(true);
    expect(result.placed[0]?.fieldModificationNote).toContain("out of SB36, sub with a B36");
    expect(result.placed[0]?.fieldModificationNote).toContain("remove drawer, install false front");
    expect(result.placed[0]?.fieldModificationNote).toContain("include sink and faucet");
    expect(result.sinks).toEqual([]);
    expect(sink.masterCode).toBe("SB36");
    const lines = buildDesignCabinetCartLines({
      placed: result.placed,
      styleId: STYLE,
      distributorId: VENDOR,
      tier: "homeowner",
      styleNameById: new Map([[STYLE, "Shaker"]]),
      unitPriceFor: () => 100,
    });
    expect(lines[0]?.name).toContain("out of SB36, sub with a B36");
    expect(lines[0]?.qtyNote).toContain("remove drawer, install false front");
  });

  it("adds catalog sink and faucet products when they exist and leaves them off the note", () => {
    const sink = place("SB36", 36, 0, { description: "36 inch Sink Base", subCategory: "Sink Base" });
    const result = swap([sink], ["SB36"], {
      sinkProduct: { id: 900, name: "Drop-in sink" },
      faucetProduct: { id: 901, name: "Deck faucet" },
    });
    expect(result.placed[0]?.fieldModificationNote).toBe("out of SB36, sub with a B36. remove drawer, install false front");
    expect(result.sinks[0]).toMatchObject({
      cabinetUid: sink.uid,
      pelicanProductId: 900,
      pelicanFaucetProductId: 901,
    });
  });

  it("uses B33 for SB33, honors the admin simulation flag, and skips when undone, unmapped, or disabled", async () => {
    const sb33 = place("SB33", 33, 0, { description: "33 inch Sink Base", subCategory: "Sink Base" });
    expect(swap([sb33], ["SB33"]).placed[0]?.masterCode).toBe("B33");

    const simulated = resolveDesignerInventoryProvider({ isAdmin: true, search: "?inventorySim=SB36", storedFlag: null });
    const stock = await Promise.resolve(simulated.getStockStatus(["SB36", "B36"]));
    const sink = place("SB36", 36, 0, { description: "36 inch Sink Base", subCategory: "Sink Base" });
    const fromSim = applyAutomaticSinkBaseSubstitutions({
      placed: [sink],
      catalog,
      stock,
      room: DEFAULT_ROOM,
      designStyleId: STYLE,
      distributorId: VENDOR,
      assumeUnlistedInStock: true,
    });
    expect(fromSim.placed[0]?.masterCode).toBe("B36");

    expect(swap([sink], ["SB36"], { skipUids: new Set([sink.uid]) }).swaps).toEqual([]);
    expect(swap([sink], ["SB36", "B36"]).swaps).toEqual([]);

    try {
      setKitchenRuleTextParameters({ sink_base_map: "SBxx->DBxx" });
      expect(swap([sink], ["SB36"]).swaps).toEqual([]);
      setKitchenRuleTextParameters({});
      setKitchenRuleParameters({ sink_base_substitute: 0 });
      expect(swap([sink], ["SB36"]).swaps).toEqual([]);
    } finally {
      resetKitchenRuleParameters();
    }
  });
});

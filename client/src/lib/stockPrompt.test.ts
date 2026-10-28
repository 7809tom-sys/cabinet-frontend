import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet } from "./design";
import { applyInventorySuggestion, designInventoryFromStock, type InventoryCatalogCandidate } from "./inventoryAlternatives";
import { buildDesignCabinetCartLines } from "./designCartLines";
import { resetKitchenRuleParameters, setKitchenRuleParameters, setKitchenRuleTextParameters } from "./kitchenRuleParameters";
import { parseStockPrompts, readjustOutOfStockRun, suggestReadjustOptions, stockPromptOrderNote } from "./stockPrompt";
import type { StockStatusResult } from "./inventoryProvider";

const STYLE = 11;
const OTHER_STYLE = 12;
const VENDOR = 7;

function place(masterCode: string, width: number): PlacedCabinet {
  const spot = wallPlacementAt(0, width, 24, "top", DEFAULT_ROOM);
  return {
    uid: `${masterCode}-0`,
    cabinetId: 1,
    masterCode,
    description: `${width} inch base cabinet`,
    category: "Base",
    subCategory: "Base",
    placement: "base",
    x: spot.x,
    y: spot.y,
    width,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    wallId: spot.wallId ?? "top",
    wallOffset: spot.wallOffset ?? 0,
    numberOfDoors: 1,
    numberOfDrawers: 1,
  };
}

function item(partial: Partial<InventoryCatalogCandidate> & Pick<InventoryCatalogCandidate, "masterCode">): InventoryCatalogCandidate {
  return {
    id: partial.id ?? 1,
    description: partial.description ?? partial.masterCode,
    width: partial.width ?? 18,
    height: partial.height ?? 34.5,
    depth: partial.depth ?? 24,
    placement: partial.placement ?? "base",
    styleId: partial.styleId ?? STYLE,
    distributorId: partial.distributorId ?? VENDOR,
    doorStyleName: "Shaker",
    numberOfDoors: partial.numberOfDoors ?? 1,
    numberOfDrawers: partial.numberOfDrawers ?? 0,
    ...partial,
  };
}

function stock(rows: Array<[string, StockStatusResult["status"]]>): StockStatusResult[] {
  return rows.map(([sku, status]) => ({ sku, status, qtyAvailable: status === "in_stock" ? 4 : 0 }));
}

const catalog = [
  item({ id: 1, masterCode: "B18FH", description: "18 inch full-height door base", numberOfDoors: 1, numberOfDrawers: 0 }),
  item({ id: 2, masterCode: "B18FH2RS", description: "18 inch full-height base with rollouts", numberOfDoors: 1, numberOfDrawers: 0 }),
  item({ id: 3, masterCode: "B18FH", description: "18 inch full-height door base", styleId: OTHER_STYLE, numberOfDoors: 1, numberOfDrawers: 0 }),
  item({ id: 4, masterCode: "DB18", description: "18 inch drawer base", numberOfDoors: 0, numberOfDrawers: 1 }),
  item({ id: 5, masterCode: "3DB18", description: "18 inch 3-drawer base", numberOfDoors: 0, numberOfDrawers: 3 }),
  item({ id: 6, masterCode: "B24FH", description: "24 inch full-height door base", width: 24, numberOfDoors: 1, numberOfDrawers: 0 }),
  item({ id: 7, masterCode: "DB24", description: "24 inch drawer base", width: 24, numberOfDoors: 0, numberOfDrawers: 3 }),
];

function promptFor(masterCode: string, rows: Array<[string, StockStatusResult["status"]]>, width = 18) {
  const placed = place(masterCode, width);
  const report = designInventoryFromStock({
    providerId: "stub",
    placed: [placed],
    catalog,
    stock: stock(rows),
    room: DEFAULT_ROOM,
    designStyleId: STYLE,
    distributorId: VENDOR,
    assumeUnlistedInStock: false,
  });
  return { placed, notice: report.notices[0] };
}

describe("out-of-stock cabinet prompt", () => {
  it("asks for a B18 and does not change the plan", () => {
    const { placed, notice } = promptFor("B18", [
      ["B18", "out_of_stock"],
      ["B18FH", "in_stock"],
      ["DB18", "in_stock"],
      ["3DB18", "in_stock"],
    ]);
    expect(placed.masterCode).toBe("B18");
    expect(notice?.choicePrompt?.choices.map((choice) => choice.id)).toEqual(["full-height", "drawer", "readjust"]);
    expect(notice?.choicePrompt?.choices[0]?.candidate?.masterCode).toBe("B18FH");
    expect(notice?.choicePrompt?.choices[0]?.candidate?.styleId).toBe(STYLE);
    expect(notice?.choicePrompt?.choices[1]?.candidate?.masterCode).toBe("3DB18");
    expect(notice?.choicePrompt?.choices[2]).toMatchObject({ id: "readjust", candidate: null, suggestion: null });
  });

  it("uses the closest same-width full-height base when B18FH is not in the line", () => {
    const withoutExact = catalog.filter((candidate) => !(candidate.masterCode === "B18FH" && candidate.styleId === STYLE));
    const placed = place("B18", 18);
    const report = designInventoryFromStock({
      providerId: "stub",
      placed: [placed],
      catalog: withoutExact,
      stock: stock([
        ["B18", "out_of_stock"],
        ["B18FH2RS", "in_stock"],
        ["DB18", "in_stock"],
      ]),
      room: DEFAULT_ROOM,
      designStyleId: STYLE,
      distributorId: VENDOR,
      assumeUnlistedInStock: false,
    });
    expect(report.notices[0]?.choicePrompt?.choices[0]?.candidate?.masterCode).toBe("B18FH2RS");
  });

  it("hides a replacement that is out of stock and keeps the other choices", () => {
    const { notice } = promptFor("B18", [
      ["B18", "out_of_stock"],
      ["B18FH", "out_of_stock"],
      ["B18FH2RS", "out_of_stock"],
      ["DB18", "in_stock"],
      ["3DB18", "out_of_stock"],
    ]);
    expect(notice?.choicePrompt?.choices.map((choice) => choice.id)).toEqual(["drawer", "readjust"]);
    expect(notice?.choicePrompt?.choices[0]?.candidate?.masterCode).toBe("DB18");
  });

  it("applies the chosen cabinet and writes the order note", () => {
    const { placed, notice } = promptFor("B18", [
      ["B18", "out_of_stock"],
      ["B18FH", "in_stock"],
      ["DB18", "in_stock"],
    ]);
    const choice = notice?.choicePrompt?.choices.find((item) => item.id === "full-height");
    expect(choice?.suggestion?.fieldModificationNote).toBe("out of B18, customer chose full-height door base");
    const swapped = applyInventorySuggestion({
      placed: [placed],
      uid: placed.uid,
      suggestion: choice!.suggestion!,
      room: DEFAULT_ROOM,
      designStyleId: STYLE,
    });
    expect(swapped.placed[0]).toMatchObject({
      masterCode: "B18FH",
      fieldModificationNote: stockPromptOrderNote("B18", "full-height door base"),
    });
    expect(placed.masterCode).toBe("B18");
    const lines = buildDesignCabinetCartLines({
      placed: swapped.placed,
      styleId: STYLE,
      distributorId: VENDOR,
      tier: "homeowner",
      styleNameById: new Map([[STYLE, "Shaker"]]),
      unitPriceFor: () => 100,
    });
    expect(lines[0]?.name).toContain("out of B18, customer chose full-height door base");
    expect(lines[0]?.qtyNote).toContain("out of B18, customer chose full-height door base");
  });

  it("lets the owner change which SKUs ask and which options appear", () => {
    try {
      setKitchenRuleTextParameters({ stock_prompts: "B24:drawer,readjust;B18:not-a-real-option,drawer" });
      const b18 = promptFor("B18", [["B18", "out_of_stock"], ["DB18", "in_stock"], ["B18FH", "in_stock"]]);
      expect(b18.notice?.choicePrompt?.choices.map((choice) => choice.id)).toEqual(["drawer"]);
      const b24 = promptFor("B24", [["B24", "out_of_stock"], ["DB24", "in_stock"], ["B24FH", "in_stock"]], 24);
      expect(b24.notice?.choicePrompt?.choices.map((choice) => choice.id)).toEqual(["drawer", "readjust"]);
      expect(b24.notice?.choicePrompt?.choices[0]?.candidate?.masterCode).toBe("DB24");
      setKitchenRuleParameters({ stock_prompt_enabled: 0 });
      expect(promptFor("B18", [["B18", "out_of_stock"], ["B18FH", "in_stock"]]).notice?.choicePrompt).toBeUndefined();
    } finally {
      resetKitchenRuleParameters();
    }
  });

  it("re-lays the run within the shared 3 inch jog and falls back when nothing fits", () => {
    const seat = (masterCode: string, width: number, along: number, uid: string): PlacedCabinet => {
      const spot = wallPlacementAt(along, width, 24, "top", DEFAULT_ROOM);
      return { ...place(masterCode, width), ...spot, uid, width, wallId: spot.wallId ?? "top", wallOffset: spot.wallOffset ?? along };
    };
    const left = seat("B24", 24, 40, "left");
    const out = seat("B18", 18, 64, "out");
    const right = seat("B24", 24, 82, "right");
    const run = [left, out, right];
    const fillCatalog = [
      item({ id: 15, masterCode: "B15", width: 15, description: "15 inch base cabinet" }),
      item({ id: 21, masterCode: "B21", width: 21, description: "21 inch base cabinet" }),
      item({ id: 30, masterCode: "B30", width: 30, description: "30 inch base cabinet" }),
      item({ id: 90, masterCode: "BF3", width: 3, description: "Base filler", subCategory: "Filler", category: "Filler", numberOfDoors: 0 }),
    ];
    const rows: Array<[string, "in_stock" | "out_of_stock"]> = [
      ["B18", "out_of_stock"],
      ["B15", "in_stock"],
      ["B21", "in_stock"],
      ["B30", "in_stock"],
      ["BF3", "in_stock"],
    ];
    setKitchenRuleParameters({ filler_gap_max_in: 3, jog_max_in: 3 });
    try {
      const withSmallest = readjustOutOfStockRun({
        placed: run,
        uid: out.uid,
        room: DEFAULT_ROOM,
        catalog: fillCatalog,
        stock: stock(rows),
        designStyleId: STYLE,
        distributorId: VENDOR,
        assumeUnlistedInStock: false,
      });
      expect(withSmallest.ok).toBe(true);
      if (!withSmallest.ok) return;
      expect(withSmallest.shiftIn).toBe(0);
      expect(withSmallest.placed.map((cabinet) => cabinet.masterCode)).toEqual(["B24", "B15", "BF3", "B24"]);
      expect(withSmallest.placed.find((cabinet) => cabinet.masterCode === "B15")?.fieldModificationNote).toBe("out of B18, customer chose readjust the plan");
      expect(run.map((cabinet) => cabinet.masterCode)).toEqual(["B24", "B18", "B24"]);

      const shifted = readjustOutOfStockRun({
        placed: run,
        uid: out.uid,
        room: DEFAULT_ROOM,
        catalog: fillCatalog.filter((candidate) => candidate.masterCode !== "B15"),
        stock: stock(rows),
        designStyleId: STYLE,
        distributorId: VENDOR,
        assumeUnlistedInStock: false,
      });
      expect(shifted.ok).toBe(true);
      if (!shifted.ok) return;
      expect(shifted.shiftIn).toBe(1.5);
      expect(shifted.placed.some((cabinet) => cabinet.masterCode === "B21")).toBe(true);
      expect(shifted.placed.find((cabinet) => cabinet.uid === "left")?.wallOffset).toBe(38.5);
      expect(shifted.placed.find((cabinet) => cabinet.uid === "right")?.wallOffset).toBe(83.5);

      setKitchenRuleParameters({ filler_gap_max_in: 3, jog_max_in: 2 });
      const tooFar = readjustOutOfStockRun({
        placed: run,
        uid: out.uid,
        room: DEFAULT_ROOM,
        catalog: fillCatalog.filter((candidate) => candidate.masterCode === "B30" || candidate.masterCode === "BF3"),
        stock: stock([["B18", "out_of_stock"], ["B30", "in_stock"], ["BF3", "in_stock"]]),
        designStyleId: STYLE,
        distributorId: VENDOR,
        assumeUnlistedInStock: false,
      });
      expect(tooFar.ok).toBe(false);
      if (tooFar.ok) return;
      expect(tooFar.message).toBe("No fit within 2 inches. Choose a full-height door base or a drawer base.");
      expect(run.find((cabinet) => cabinet.uid === "out")?.masterCode).toBe("B18");
    } finally {
      resetKitchenRuleParameters();
    }
  });

  it("suggests B33 + B21 for a 54 inch B36 + B18 run and does not apply it", () => {
    const seat = (masterCode: string, width: number, along: number, uid: string): PlacedCabinet => {
      const spot = wallPlacementAt(along, width, 24, "top", DEFAULT_ROOM);
      return { ...place(masterCode, width), ...spot, uid, width, wallId: spot.wallId ?? "top", wallOffset: spot.wallOffset ?? along };
    };
    const wide = seat("B36", 36, 0, "wide");
    const out = seat("B18", 18, 36, "out");
    const run = [wide, out];
    const fillCatalog = [
      item({ id: 33, masterCode: "B33", width: 33, description: "33 inch base cabinet", numberOfDoors: 2, numberOfDrawers: 0 }),
      item({ id: 21, masterCode: "B21", width: 21, description: "21 inch base cabinet", numberOfDoors: 1, numberOfDrawers: 0 }),
      item({ id: 30, masterCode: "B30", width: 30, description: "30 inch base cabinet", numberOfDoors: 2, numberOfDrawers: 0 }),
      item({ id: 24, masterCode: "B24", width: 24, description: "24 inch base cabinet", numberOfDoors: 2, numberOfDrawers: 0 }),
      item({ id: 27, masterCode: "B27", width: 27, description: "27 inch base cabinet", numberOfDoors: 2, numberOfDrawers: 0 }),
      item({ id: 133, masterCode: "DB33", width: 33, description: "33 inch drawer base", numberOfDoors: 0, numberOfDrawers: 3 }),
    ];
    const options = suggestReadjustOptions({
      placed: run,
      uid: out.uid,
      room: DEFAULT_ROOM,
      catalog: fillCatalog,
      stock: stock([
        ["B18", "out_of_stock"],
        ["B36", "in_stock"],
        ["B33", "in_stock"],
        ["B21", "in_stock"],
        ["B30", "in_stock"],
        ["B24", "in_stock"],
        ["B27", "in_stock"],
        ["DB33", "in_stock"],
      ]),
      designStyleId: STYLE,
      distributorId: VENDOR,
      assumeUnlistedInStock: false,
    });
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(3);
    expect(options[0]?.label).toBe("B33 + B21");
    expect(options[0]?.detail).toContain("54");
    expect(options[0]?.placed.map((cabinet) => cabinet.masterCode)).toEqual(["B33", "B21"]);
    expect(options[0]?.placed.map((cabinet) => cabinet.wallOffset)).toEqual([0, 33]);
    expect(options[0]?.placed.every((cabinet) => cabinet.fieldModificationNote === "out of B18, customer chose readjust the plan")).toBe(true);
    expect(run.map((cabinet) => cabinet.masterCode)).toEqual(["B36", "B18"]);
    expect(options.some((option) => option.label.startsWith("DB33"))).toBe(false);
  });

  it("keeps a drawer neighbor a drawer and does not resize a sink", () => {
    const seat = (masterCode: string, width: number, along: number, uid: string): PlacedCabinet => {
      const spot = wallPlacementAt(along, width, 24, "top", DEFAULT_ROOM);
      return { ...place(masterCode, width), ...spot, uid, width, wallId: spot.wallId ?? "top", wallOffset: spot.wallOffset ?? along };
    };
    const drawer = { ...seat("DB36", 36, 0, "drawer"), numberOfDoors: 0, numberOfDrawers: 3, description: "36 inch drawer base" };
    const out = seat("B18", 18, 36, "out");
    const drawerOptions = suggestReadjustOptions({
      placed: [drawer, out],
      uid: out.uid,
      room: DEFAULT_ROOM,
      catalog: [
        item({ id: 33, masterCode: "B33", width: 33, description: "33 inch base cabinet", numberOfDoors: 2, numberOfDrawers: 0 }),
        item({ id: 21, masterCode: "B21", width: 21, description: "21 inch base cabinet", numberOfDoors: 1, numberOfDrawers: 0 }),
        item({ id: 233, masterCode: "DB33", width: 33, description: "33 inch drawer base", numberOfDoors: 0, numberOfDrawers: 3 }),
      ],
      stock: stock([["B18", "out_of_stock"], ["B33", "in_stock"], ["B21", "in_stock"], ["DB33", "in_stock"]]),
      designStyleId: STYLE,
      distributorId: VENDOR,
      assumeUnlistedInStock: false,
    });
    expect(drawerOptions.some((option) => option.label === "DB33 + B21")).toBe(true);
    expect(drawerOptions.some((option) => option.label === "B33 + B21")).toBe(false);

    const sink = { ...seat("SB36", 36, 0, "sink"), description: "36 inch sink base", subCategory: "Sink Base" };
    const sinkOptions = suggestReadjustOptions({
      placed: [sink, out],
      uid: out.uid,
      room: DEFAULT_ROOM,
      catalog: [
        item({ id: 30, masterCode: "B30", width: 30, description: "30 inch base cabinet", numberOfDoors: 2, numberOfDrawers: 0 }),
        item({ id: 24, masterCode: "B24", width: 24, description: "24 inch base cabinet", numberOfDoors: 2, numberOfDrawers: 0 }),
      ],
      stock: stock([["B18", "out_of_stock"], ["B30", "in_stock"], ["B24", "in_stock"], ["SB36", "in_stock"]]),
      designStyleId: STYLE,
      distributorId: VENDOR,
      assumeUnlistedInStock: false,
    });
    expect(sinkOptions.some((option) => option.placed.some((cabinet) => cabinet.masterCode === "B30" || cabinet.masterCode === "B24"))).toBe(false);
  });

  it("resizes an out-of-stock wall cabinet with wall cabinets of the same style", () => {
    const seat = (masterCode: string, width: number, along: number, uid: string): PlacedCabinet => {
      const spot = wallPlacementAt(along, width, 12, "top", DEFAULT_ROOM);
      return { ...place(masterCode, width), ...spot, uid, width, depth: 12, height: 30, placement: "wall", wallId: spot.wallId ?? "top", wallOffset: spot.wallOffset ?? along, numberOfDoors: 2, numberOfDrawers: 0 };
    };
    const wide = seat("W3630", 36, 0, "wide");
    const out = seat("W1830", 18, 36, "out");
    const options = suggestReadjustOptions({
      placed: [wide, out],
      uid: out.uid,
      room: DEFAULT_ROOM,
      catalog: [
        item({ id: 333, masterCode: "W3330", width: 33, height: 30, depth: 12, placement: "wall", description: "33 inch wall cabinet", numberOfDoors: 2, numberOfDrawers: 0 }),
        item({ id: 213, masterCode: "W2130", width: 21, height: 30, depth: 12, placement: "wall", description: "21 inch wall cabinet", numberOfDoors: 2, numberOfDrawers: 0 }),
      ],
      stock: stock([["W1830", "out_of_stock"], ["W3330", "in_stock"], ["W2130", "in_stock"]]),
      designStyleId: STYLE,
      distributorId: VENDOR,
      assumeUnlistedInStock: false,
    });
    expect(options[0]?.label).toBe("W3330 + W2130");
    expect(options[0]?.placed.every((cabinet) => cabinet.placement === "wall")).toBe(true);
  });

  it("parses several cabinet prompts and drops unknown options", () => {
    expect(parseStockPrompts("B18:full-height,drawer,readjust; B24:drawer,made-up")).toEqual([
      { sku: "B18", options: ["full-height", "drawer", "readjust"] },
      { sku: "B24", options: ["drawer"] },
    ]);
  });
});

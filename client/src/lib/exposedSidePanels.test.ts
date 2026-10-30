import { beforeEach, describe, expect, it } from "vitest";
import type { DoorStyleEndPanelInput } from "./autoEndPanels";
import { DEFAULT_ROOM, syncWallRunOffsets, wallPlacementAt, type PlacedCabinet, type WallOpening } from "./design";
import { buildMaterialsListRows, materialsListPrintHtml } from "./designMaterialsList";
import { stablePricePairKey } from "./designerPricingStability";
import { resetKitchenRuleParameters, setKitchenRuleParameters } from "./kitchenRuleParameters";
import {
  autoAddedOrderSurfaces,
  catalogItemToExposedPanelStock,
  syncExposedSidePanels,
  type ExposedPanelStock,
} from "./exposedSidePanels";

const room = DEFAULT_ROOM;

// The engine is off by default (panels are user-chosen); these tests exercise it directly.
beforeEach(() => {
  setKitchenRuleParameters({ exposed_panels_enabled: 1 });
});
const stock: ExposedPanelStock[] = [
  { id: 11, masterCode: "BEP2535", description: "Base end panel", placement: "base", stockFace: 25.625, stockHeight: 35.25, price: 86 },
  { id: 12, masterCode: "WEP1530", description: "Wall end panel", placement: "wall", stockFace: 15.25, stockHeight: 30.25, price: 42 },
  { id: 13, masterCode: "TEP3096", description: "Tall end panel", placement: "tall", stockFace: 29.875, stockHeight: 96, price: 140 },
];

function place(partial: {
  uid: string;
  masterCode: string;
  placement: PlacedCabinet["placement"];
  offset: number;
  width: number;
  depth?: number;
  height?: number;
  description?: string;
  constructionMethod?: string | null;
  islandFace?: PlacedCabinet["islandFace"];
  wall?: "top" | "right" | "bottom" | "left";
}): PlacedCabinet {
  const depth = partial.depth ?? (partial.placement === "wall" ? 12 : 24);
  const height = partial.height ?? (partial.placement === "wall" ? 30 : partial.placement === "tall" ? 84 : 34.5);
  const wall = partial.wall ?? "top";
  const spot = wallPlacementAt(partial.offset, partial.width, depth, wall, room);
  return {
    uid: partial.uid,
    cabinetId: 1,
    masterCode: partial.masterCode,
    description: partial.description ?? partial.masterCode,
    placement: partial.placement,
    ...spot,
    width: partial.width,
    depth,
    height,
    wallId: spot.wallId ?? partial.wall ?? "top",
    wallOffset: spot.wallOffset ?? partial.offset,
    constructionMethod: partial.constructionMethod ?? "frameless",
    islandFace: partial.islandFace,
  };
}

function panels(placed: readonly PlacedCabinet[]) {
  return placed.filter((item) => item.autoPlacedReason);
}

describe("exposed side panels", () => {
  it("panels both open ends of a single cabinet and does not double them", () => {
    const once = syncExposedSidePanels({
      placed: [place({ uid: "only", masterCode: "B24", placement: "base", offset: 40, width: 24 })],
      room,
      catalog: stock,
    });
    expect(panels(once.placed).map((item) => item.autoPlacedSide).sort()).toEqual(["end", "start"]);
    expect(panels(once.placed).every((item) => item.fieldModificationNote?.startsWith("Auto-added:"))).toBe(true);
    const twice = syncExposedSidePanels({ placed: once.placed, room, catalog: stock });
    expect(panels(twice.placed)).toHaveLength(2);
    expect(twice.placed).toBe(once.placed);
  });

  it("adds a panel where the run ends against the wall", () => {
    const result = syncExposedSidePanels({
      placed: [place({ uid: "end", masterCode: "B18", placement: "base", offset: 0, width: 18 })],
      room,
      catalog: stock,
    });
    const against = panels(result.placed).find((item) => item.autoPlacedSide === "start");
    expect(against?.fieldModificationNote).toContain("Auto-added: end of run against wall");
    expect(against?.masterCode).toBe("BEP2535");
    expect(result.placed.find((item) => item.uid === "end")?.wallOffset).toBeGreaterThan(0);
  });

  it("does not panel the joint between two cabinets and removes a panel when the side is covered", () => {
    const open = syncExposedSidePanels({
      placed: [place({ uid: "left", masterCode: "B24", placement: "base", offset: 20, width: 24 })],
      room,
      catalog: stock,
    });
    expect(panels(open.placed).length).toBeGreaterThan(0);
    const covered = syncExposedSidePanels({
      placed: [
        ...open.placed.filter((item) => !item.autoPlacedReason),
        place({ uid: "right", masterCode: "B24", placement: "base", offset: 44, width: 24 }),
      ],
      room,
      catalog: stock,
    });
    expect(panels(covered.placed).some((item) => item.autoPlacedForUid === "left" && item.autoPlacedSide === "end")).toBe(false);
    expect(panels(covered.placed).some((item) => item.autoPlacedForUid === "left" && item.autoPlacedSide === "start")).toBe(true);
  });

  it("panels frameless wall cabinets on both sides of a window and skips the framed panel", () => {
    const window: WallOpening = { uid: "win", kind: "window", side: "top", offset: 60, width: 30, sill: 42, height: 36, label: "Window" };
    const left = place({ uid: "left", masterCode: "W3030", placement: "wall", offset: 30, width: 30, height: 30, depth: 12 });
    const right = place({ uid: "right", masterCode: "W3030", placement: "wall", offset: 90, width: 30, height: 30, depth: 12 });
    const frameless = syncExposedSidePanels({ placed: [left, right], room, openings: [window], catalog: stock });
    const windowPanels = panels(frameless.placed).filter((item) => item.autoPlacedReason === "beside-window");
    expect(windowPanels.map((item) => item.autoPlacedForUid).sort()).toEqual(["left", "right"]);
    expect(windowPanels.every((item) => item.fieldModificationNote?.includes("window sill"))).toBe(true);

    const framed = syncExposedSidePanels({
      placed: [
        place({ uid: "left", masterCode: "W3030", placement: "wall", offset: 30, width: 30, height: 30, depth: 12, constructionMethod: "framed" }),
        place({ uid: "right", masterCode: "W3030", placement: "wall", offset: 90, width: 30, height: 30, depth: 12, constructionMethod: "framed" }),
      ],
      room,
      openings: [window],
      catalog: stock,
    });
    expect(panels(framed.placed).some((item) => item.autoPlacedReason === "beside-window")).toBe(false);
  });

  it("panels a tall pantry end, an island end, and a dishwasher side", () => {
    const tall = syncExposedSidePanels({
      placed: [place({ uid: "pantry", masterCode: "T2484", placement: "tall", offset: 40, width: 24, height: 84, depth: 24 })],
      room,
      catalog: stock,
    });
    expect(panels(tall.placed).some((item) => item.autoPlacedReason === "tall-cabinet-end" && item.masterCode === "TEP3096")).toBe(true);

    const island = syncExposedSidePanels({
      placed: [place({ uid: "isle", masterCode: "B36", placement: "base", offset: 40, width: 36, islandFace: "front" })],
      room,
      catalog: stock,
    });
    expect(panels(island.placed).some((item) => item.autoPlacedReason === "island-end" || item.autoPlacedReason === "island-back")).toBe(true);

    const dw = syncExposedSidePanels({
      placed: [
        place({ uid: "base", masterCode: "B24", placement: "base", offset: 20, width: 24 }),
        place({ uid: "dw", masterCode: "DW24", placement: "appliance", offset: 44, width: 24, description: "Dishwasher" }),
      ],
      room,
      catalog: stock,
    });
    expect(panels(dw.placed).some((item) => item.autoPlacedReason === "dw-exposed-side")).toBe(true);
  });

  it("prices the panel on every order surface and refuses a $0 line", () => {
    const result = syncExposedSidePanels({
      placed: [place({ uid: "only", masterCode: "B24", placement: "base", offset: 40, width: 24 })],
      room,
      catalog: stock,
    });
    const prices = new Map(stock.map((item) => [item.id, item.price]));
    const surfaces = autoAddedOrderSurfaces({
      placed: result.placed,
      styleId: 11,
      distributorId: 7,
      tier: "homeowner",
      styleName: "Shaker",
      unitPriceFor: (cabinet) => prices.get(cabinet.cabinetId) ?? null,
    });
    expect(surfaces.materialList.length).toBeGreaterThan(0);
    expect(surfaces.materialList.every((line) => line.unitPrice === 86 && line.autoAddedLabel.startsWith("Auto-added:"))).toBe(true);
    expect(surfaces.materialList.reduce((sum, line) => sum + line.qty, 0)).toBe(2);
    expect(surfaces.invoice.total).toBe(surfaces.distributorPo.total);
    expect(surfaces.invoice.total).toBe(172);
    expect(surfaces.cart.some((line) => line.unitPrice === 0)).toBe(false);
    expect(surfaces.distributorPo.lines[0]?.distributorItemName).toContain("Base end panel");

    const missing = syncExposedSidePanels({
      placed: [place({ uid: "only", masterCode: "B24", placement: "base", offset: 40, width: 24 })],
      room,
      catalog: stock.map((item) => ({ ...item, price: null })),
    });
    expect(panels(missing.placed)).toHaveLength(0);
    expect(missing.warnings).toHaveLength(1);
    expect(missing.warnings[0]?.id).toBe("missing-price:base-end");
    expect(missing.warnings[0]?.message).toMatch(/no priced base end panel/);
  });

  it("warns when the jog cannot make room and drops panels when the engine is unpublished", () => {
    const tight = syncExposedSidePanels({
      placed: [place({ uid: "full", masterCode: "B144", placement: "base", offset: 0, width: 144 })],
      room,
      catalog: stock,
    });
    expect(tight.warnings.some((warning) => warning.id.startsWith("no-room"))).toBe(true);
    setKitchenRuleParameters({ exposed_panels_enabled: 0 });
    try {
      const off = syncExposedSidePanels({
        placed: [place({ uid: "only", masterCode: "B24", placement: "base", offset: 40, width: 24 })],
        room,
        catalog: stock,
      });
      expect(panels(off.placed)).toHaveLength(0);
    } finally {
      resetKitchenRuleParameters();
    }
  });

  it("reads refrigerator, wall, and base panel sheets even when thickness is stored as the width", () => {
    const refrigerator = catalogItemToExposedPanelStock({
      id: 21, masterCode: "REP2496", description: "Refrigerator End Panel", subCategory: "Refrigerator End Panel",
      placement: "accessory", width: 0.75, depth: 24, height: 96,
    }, 140);
    const wall = catalogItemToExposedPanelStock({
      id: 22, masterCode: "WEP1542", description: "Wall End Panel", placement: "accessory", width: 0.75, depth: 15.25, height: 42,
    }, 48);
    const base = catalogItemToExposedPanelStock({
      id: 23, masterCode: "BEP2535", description: "Base end panel", placement: "accessory", width: 25.625, depth: 0.75, height: 35.25,
    }, 86);
    expect(refrigerator).toMatchObject({ panelType: "tall-fridge", stockFace: 24, price: 140 });
    expect(wall).toMatchObject({ panelType: "wall-end", stockFace: 15.25 });
    expect(base).toMatchObject({ panelType: "base-end", stockFace: 25.625 });

    const fridge = syncExposedSidePanels({
      placed: [place({ uid: "fridge", masterCode: "FRIDGE-36", placement: "appliance", offset: 40, width: 36, depth: 30, height: 70, description: "Refrigerator" })],
      room,
      catalog: [refrigerator!, wall!, base!],
    });
    expect(panels(fridge.placed).every((item) => item.masterCode === "REP2496")).toBe(true);
    expect(fridge.warnings).toEqual([]);
  });

  it("does not flag interior cabinets, fillers, or a range between cabinets in a U-shaped run", () => {
    const catalog = [
      catalogItemToExposedPanelStock({ id: 31, masterCode: "BEP2535", description: "Base end panel", width: 25.625, depth: 0.75, height: 35.25 }, 86)!,
      catalogItemToExposedPanelStock({ id: 32, masterCode: "WEP1530", description: "Wall end panel", width: 0.75, depth: 15.25, height: 42 }, 42)!,
      catalogItemToExposedPanelStock({ id: 33, masterCode: "TEP3096", description: "Tall end panel", width: 0.75, depth: 30, height: 96 }, 140)!,
    ];
    const placed = [
      place({ uid: "b18", masterCode: "B18", placement: "base", offset: 0, width: 18 }),
      place({ uid: "b24", masterCode: "B24", placement: "base", offset: 18, width: 24 }),
      place({ uid: "db", masterCode: "3DB24", placement: "base", offset: 42, width: 24 }),
      place({ uid: "bt", masterCode: "BT9", placement: "base", offset: 66, width: 9 }),
      place({ uid: "range", masterCode: "RANGE-30", placement: "appliance", offset: 75, width: 30, description: "Range" }),
      place({ uid: "filler", masterCode: "F342", placement: "base", offset: 105, width: 3, depth: 24, height: 34.5, description: "Base filler" }),
      place({ uid: "corner", masterCode: "LSB36", placement: "base", offset: 108, width: 36, depth: 24 }),
      place({ uid: "right-base", masterCode: "B24", placement: "base", offset: 24, width: 24, wall: "right" }),
      place({ uid: "w-end", masterCode: "W2142", placement: "wall", offset: 0, width: 21, height: 42 }),
      place({ uid: "w-filler", masterCode: "WFF342", placement: "wall", offset: 21, width: 3, height: 42, description: "Wall filler" }),
      place({ uid: "w-mid", masterCode: "W2742", placement: "wall", offset: 24, width: 27, height: 42 }),
      place({ uid: "w-next", masterCode: "W3030", placement: "wall", offset: 51, width: 30, height: 30 }),
      place({ uid: "dw-left", masterCode: "B18", placement: "base", offset: 0, width: 20, wall: "left" }),
      place({ uid: "dw", masterCode: "DW24", placement: "appliance", offset: 20, width: 24, description: "Dishwasher", wall: "left" }),
      place({ uid: "dw-right", masterCode: "B21", placement: "base", offset: 44, width: 21, wall: "left" }),
    ];
    const result = syncExposedSidePanels({ placed, room, catalog });
    const flagged = result.warnings.map((warning) => warning.message).join("\n");
    for (const code of ["B24", "3DB24", "BT9", "RANGE-30", "W2742", "F342", "WFF342", "DW24"]) {
      expect(flagged).not.toContain(code);
    }
    const panelFor = (uid: string, side: string) => panels(result.placed).some((item) => item.autoPlacedForUid === uid && item.autoPlacedSide === side);
    expect(panelFor("b24", "start") || panelFor("b24", "end")).toBe(false);
    expect(panelFor("db", "start") || panelFor("db", "end")).toBe(false);
    expect(panelFor("bt", "start") || panelFor("bt", "end")).toBe(false);
    expect(panelFor("w-mid", "start") || panelFor("w-mid", "end")).toBe(false);
    expect(panelFor("range", "start") || panelFor("range", "end")).toBe(false);
    expect(panelFor("dw", "start") || panelFor("dw", "end")).toBe(false);
    expect(panelFor("right-base", "start")).toBe(false);
    const sideKeys = panels(result.placed).map((item) => `${item.autoPlacedForUid}:${item.autoPlacedSide}`);
    expect(new Set(sideKeys).size).toBe(sideKeys.length);
    const again = syncExposedSidePanels({ placed: result.placed, room, catalog });
    expect(again.placed).toBe(result.placed);
  });

  it("panels only a dishwasher or refrigerator side that is actually open", () => {
    const openDishwasher = syncExposedSidePanels({
      placed: [place({ uid: "dw", masterCode: "DW24", placement: "appliance", offset: 40, width: 24, description: "Dishwasher" })],
      room,
      catalog: stock,
    });
    expect(panels(openDishwasher.placed).some((item) => item.autoPlacedReason === "dw-exposed-side")).toBe(true);

    const between = syncExposedSidePanels({
      placed: [
        place({ uid: "left", masterCode: "B24", placement: "base", offset: 16, width: 24 }),
        place({ uid: "dw", masterCode: "DW24", placement: "appliance", offset: 40, width: 24, description: "Dishwasher" }),
        place({ uid: "right", masterCode: "B24", placement: "base", offset: 64, width: 24 }),
      ],
      room,
      catalog: stock,
    });
    expect(panels(between.placed).some((item) => item.autoPlacedForUid === "dw")).toBe(false);
    expect(panels(between.placed).some((item) => item.autoPlacedForUid === "left" && item.autoPlacedSide === "end")).toBe(false);
    expect(panels(between.placed).some((item) => item.autoPlacedForUid === "right" && item.autoPlacedSide === "start")).toBe(false);
  });
});

describe("exposed side panels never push a cabinet into its neighbour", () => {
  it("keeps a B21 against the wall when jogging it would hit the fridge panel", async () => {
    const { removeOverlappingPlacements } = await import("./design");
    const b21 = place({ uid: "b21", masterCode: "B21", placement: "base", offset: 0, width: 21 });
    const fridgePanel = { ...place({ uid: "rep", masterCode: "REP3096", placement: "tall", offset: 21, width: 0.75, depth: 24, height: 96, description: "Refrigerator End Panel" }) };
    const fridge = place({ uid: "fridge", masterCode: "FRIDGE-36", placement: "appliance", offset: 22.25, width: 36, depth: 24, height: 70, description: "Refrigerator" });
    const before = [b21, fridgePanel, fridge];
    const plan = syncExposedSidePanels({ placed: before, room, catalog: stock });
    const host = plan.placed.find((item) => item.uid === "b21");
    expect(host?.wallOffset).toBe(0);
    expect(plan.warnings.some((warning) => warning.cabinetUid === "b21" && /no room/.test(warning.message))).toBe(true);
    // Nothing the engine produces is deleted by the overlap repair.
    const repaired = removeOverlappingPlacements(plan.placed, room);
    expect(repaired.rejected.map((item) => item.uid)).toEqual([]);
    expect(repaired.placed.some((item) => item.uid === "b21")).toBe(true);
  });
});

const framelessStyle: DoorStyleEndPanelInput = { boxConstruction: "standard altaeuro frameless box", distributorName: "US Cabinet Depot" };
const hickoryStyle: DoorStyleEndPanelInput = { woodSpecies: "Hickory", ourName: "Hickory skin", boxConstruction: "face frame" };
const framedStyle: DoorStyleEndPanelInput = { woodSpecies: "Maple", ourName: "White Shaker", boxConstruction: "1/2 in. plywood face frame", distributorName: "Summit", styleCode: "SW" };

function qualified(placed: PlacedCabinet[], extra: { openings?: WallOpening[]; style?: DoorStyleEndPanelInput | null; styleFor?: (cabinet: PlacedCabinet) => DoorStyleEndPanelInput | null } = {}) {
  return syncExposedSidePanels({
    placed,
    room,
    openings: extra.openings,
    catalog: stock,
    qualifiedOnly: true,
    doorStyleFor: extra.styleFor ?? (() => extra.style === undefined ? framelessStyle : extra.style),
  });
}

describe("frameless and Hickory auto panels", () => {
  it("gives a frameless U-shape panels only on open ends, and none against a wall or on interior cabinets", () => {
    const placed = [
      place({ uid: "left-a", masterCode: "B24", placement: "base", offset: 0, width: 24, wall: "left" }),
      place({ uid: "left-b", masterCode: "B24", placement: "base", offset: 24, width: 24, wall: "left" }),
      place({ uid: "left-c", masterCode: "B18", placement: "base", offset: 48, width: 18, wall: "left" }),
      place({ uid: "top-a", masterCode: "B48", placement: "base", offset: 0, width: 48, wall: "top" }),
      place({ uid: "top-b", masterCode: "B48", placement: "base", offset: 48, width: 48, wall: "top" }),
      place({ uid: "top-c", masterCode: "B48", placement: "base", offset: 96, width: 48, wall: "top" }),
      place({ uid: "right-a", masterCode: "B24", placement: "base", offset: 0, width: 24, wall: "right" }),
      place({ uid: "right-b", masterCode: "T2484", placement: "tall", offset: 24, width: 24, height: 84, wall: "right" }),
      place({ uid: "wall-a", masterCode: "W3030", placement: "wall", offset: 0, width: 30, height: 30, wall: "top" }),
      place({ uid: "wall-b", masterCode: "W3030", placement: "wall", offset: 30, width: 30, height: 30, wall: "top" }),
      place({ uid: "wall-c", masterCode: "W3030", placement: "wall", offset: 60, width: 30, height: 30, wall: "top" }),
    ];
    const result = qualified(placed);
    const panelFor = (uid: string, side: string) => panels(result.placed).find((item) => item.autoPlacedForUid === uid && item.autoPlacedSide === side);
    expect(panelFor("left-a", "start")).toBeUndefined();
    expect(panelFor("left-b", "start") ?? panelFor("left-b", "end")).toBeUndefined();
    expect(panelFor("left-c", "end")?.autoPlacedReason).toBe("open-end-of-run");
    expect(panelFor("left-c", "end")?.fieldModificationNote).toContain("Auto-added: open end of run");
    expect(panelFor("left-c", "end")?.width).toBe(0.75);
    expect(panelFor("top-a", "start") ?? panelFor("top-c", "end")).toBeUndefined();
    expect(panelFor("top-b", "start") ?? panelFor("top-b", "end")).toBeUndefined();
    expect(panelFor("right-a", "start") ?? panelFor("right-a", "end")).toBeUndefined();
    expect(panelFor("right-b", "end")?.masterCode).toBe("TEP3096");
    expect(panelFor("wall-a", "start")).toBeUndefined();
    expect(panelFor("wall-b", "start") ?? panelFor("wall-b", "end")).toBeUndefined();
    expect(panelFor("wall-c", "end")?.autoPlacedReason).toBe("open-end-of-run");
    expect(panelFor("wall-c", "end")?.masterCode).toBe("WEP1530");
    expect(panels(result.placed).every((item) => item.fieldModificationNote?.startsWith("Auto-added:"))).toBe(true);
    const again = qualified(result.placed);
    expect(again.placed).toBe(result.placed);
    const reseated = syncWallRunOffsets(result.placed, room);
    const afterReseat = qualified(reseated);
    expect(afterReseat.placed).toBe(reseated);
  });

  it("does not panel a run end that sits against a wall", () => {
    const against = qualified([
      place({ uid: "end", masterCode: "B18", placement: "base", offset: 0, width: 18 }),
    ]);
    expect(panels(against.placed).map((item) => item.autoPlacedSide)).toEqual(["end"]);
    expect(against.placed.find((item) => item.uid === "end")?.wallOffset).toBe(0);
    const bothWalls = qualified([
      place({ uid: "full", masterCode: "B144", placement: "base", offset: 0, width: 144 }),
    ]);
    expect(panels(bothWalls.placed)).toHaveLength(0);
  });

  it("panels the cabinet side that faces a window and skips that panel on a framed line", () => {
    const window: WallOpening = { uid: "win", kind: "window", side: "top", offset: 42, width: 30, sill: 42, height: 36, label: "Window" };
    const placed = [
      place({ uid: "left", masterCode: "W3030", placement: "wall", offset: 10, width: 30, height: 30, depth: 12 }),
      place({ uid: "right", masterCode: "W3030", placement: "wall", offset: 74, width: 30, height: 30, depth: 12 }),
    ];
    const frameless = qualified(placed, { openings: [window] });
    const windowPanels = panels(frameless.placed).filter((item) => item.autoPlacedReason === "window-side");
    expect(windowPanels.map((item) => `${item.autoPlacedForUid}:${item.autoPlacedSide}`).sort()).toEqual(["left:end", "right:start"]);
    expect(windowPanels.every((item) => item.fieldModificationNote?.includes("Auto-added: window side"))).toBe(true);
    const framed = qualified(placed, { openings: [window], style: framedStyle });
    expect(panels(framed.placed)).toHaveLength(0);
  });

  it("panels Hickory and a mixed frameless cabinet, and adds nothing for framed Maple", () => {
    const open = [place({ uid: "only", masterCode: "B24", placement: "base", offset: 40, width: 24 })];
    expect(panels(qualified(open, { style: hickoryStyle }).placed).map((item) => item.autoPlacedReason).sort()).toEqual(["open-end-of-run", "open-end-of-run"]);
    expect(panels(qualified(open, { style: framedStyle }).placed)).toHaveLength(0);
    const mixed = qualified([
      place({ uid: "maple", masterCode: "B24", placement: "base", offset: 10, width: 24 }),
      place({ uid: "frameless", masterCode: "B24", placement: "base", offset: 80, width: 24 }),
    ], {
      styleFor: (cabinet) => cabinet.uid === "frameless" ? framelessStyle : framedStyle,
    });
    expect(panels(mixed.placed).map((item) => item.autoPlacedForUid).sort()).toEqual(["frameless", "frameless"]);
  });

  it("panels wall cabinets on the sides that face a range or hood, and not the bases beside them", () => {
    const placed = [
      place({ uid: "base-left", masterCode: "B24", placement: "base", offset: 0, width: 24 }),
      place({ uid: "base-mid", masterCode: "B21", placement: "base", offset: 24, width: 21 }),
      place({ uid: "range", masterCode: "RANGE-30", placement: "appliance", offset: 45, width: 30, description: "Range" }),
      place({ uid: "base-right", masterCode: "B24", placement: "base", offset: 75, width: 24 }),
      place({ uid: "wall-left", masterCode: "W3030", placement: "wall", offset: 15, width: 30, height: 30, depth: 12 }),
      place({ uid: "wall-right", masterCode: "W3030", placement: "wall", offset: 75, width: 30, height: 30, depth: 12 }),
      place({ uid: "hood", masterCode: "HOOD-30", placement: "appliance", offset: 45, width: 30, depth: 12, height: 18, description: "Range Hood" }),
    ];
    const result = qualified(placed);
    const facing = panels(result.placed).filter((item) => item.autoPlacedReason === "wall-beside-range");
    expect(facing.map((item) => `${item.autoPlacedForUid}:${item.autoPlacedSide}`).sort()).toEqual(["wall-left:end", "wall-right:start"]);
    expect(facing.every((item) => item.fieldModificationNote?.includes("Auto-added: wall cabinet beside range"))).toBe(true);
    expect(panels(result.placed).some((item) => item.autoPlacedForUid === "base-mid" || item.autoPlacedForUid === "base-left" && item.autoPlacedSide === "end")).toBe(false);
    expect(panels(result.placed).some((item) => item.autoPlacedForUid === "base-right" && item.autoPlacedSide === "start")).toBe(false);
    expect(panels(result.placed).some((item) => /dw-exposed|beside-window|end of run against wall|open side/.test(item.fieldModificationNote ?? ""))).toBe(false);
  });

  it("places LSA panels from the spec sheets and does not panel framed Madison", () => {
    const lsa = {
      styleCode: "LSA",
      ourName: "Luxe Classic LSA",
      color: "LSA",
      doorStyle: "Slab",
      finish: "Luxe Classic",
      boxConstruction: "18mm plywood composite cabinet box; standard altaeuro frameless box",
      distributorName: "Frameless",
    };
    const open = [place({ uid: "only", masterCode: "B24", placement: "base", offset: 40, width: 24 })];
    const placed = panels(qualified(open, { style: lsa }).placed);
    expect(placed.map((item) => item.autoPlacedReason).sort()).toEqual(["open-end-of-run", "open-end-of-run"]);
    expect(placed.every((item) => item.masterCode === "BEP2535" && item.width === 0.75)).toBe(true);
    const madison = {
      styleCode: "SC",
      ourName: "Shaker Cinder",
      doorStyle: "Shaker",
      color: "#5A5A5A",
      boxConstruction: "1/2-inch plywood box with UV-coated matching exterior",
      distributorName: "Madison",
      overlayType: "Full overlay",
    };
    expect(panels(qualified(open, { style: madison }).placed)).toHaveLength(0);
  });

  it("panels an island back and the island's open ends", () => {
    const island = place({ uid: "isle", masterCode: "B36", placement: "base", offset: 40, width: 36, islandFace: "front" });
    island.y = 48;
    const result = qualified([island]);
    const reasons = panels(result.placed).map((item) => item.autoPlacedReason).sort();
    expect(reasons).toEqual(["island-back", "open-end-of-run", "open-end-of-run"]);
    expect(panels(result.placed).some((item) => item.fieldModificationNote?.includes("Auto-added: island back"))).toBe(true);
  });

  it("prices every order surface from the catalog and keeps the pricing key stable", () => {
    const initial = [place({ uid: "only", masterCode: "B24", placement: "base", offset: 40, width: 24 })];
    const pairsOf = (placed: readonly PlacedCabinet[]) => {
      const seen = new Set<string>();
      const rows: { cabinetId: number; styleId: number; masterCode: string }[] = [];
      for (const item of [
        ...placed.map((cabinet) => ({ cabinetId: cabinet.cabinetId, styleId: 11, masterCode: cabinet.masterCode })),
        ...stock.map((cabinet) => ({ cabinetId: cabinet.id, styleId: 11, masterCode: cabinet.masterCode })),
      ]) {
        const key = `${item.cabinetId}:${item.styleId}:${item.masterCode}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(item);
      }
      return stablePricePairKey(rows, 7);
    };
    const before = pairsOf(initial);
    let current = initial;
    const keys = [before];
    for (let pass = 0; pass < 6; pass += 1) {
      const plan = qualified(current);
      current = plan.placed;
      keys.push(pairsOf(current));
    }
    expect(new Set(keys).size).toBe(1);
    expect(qualified(current).placed).toBe(current);
    const prices = new Map(stock.map((item) => [item.id, item.price]));
    const surfaces = autoAddedOrderSurfaces({
      placed: current,
      styleId: 11,
      distributorId: 7,
      tier: "homeowner",
      styleName: "Frameless Shaker",
      unitPriceFor: (cabinet) => prices.get(cabinet.cabinetId) ?? null,
    });
    expect(surfaces.materialList.length).toBeGreaterThan(0);
    expect(surfaces.materialList.every((line) => line.unitPrice === 86 && line.autoAddedLabel.startsWith("Auto-added:"))).toBe(true);
    expect(surfaces.cart.some((line) => line.unitPrice === 0)).toBe(false);
    expect(surfaces.invoice.total).toBe(surfaces.distributorPo.total);
    expect(surfaces.invoice.total).toBeGreaterThan(0);

    const missing = syncExposedSidePanels({
      placed: initial,
      room,
      catalog: stock.map((item) => ({ ...item, price: null })),
      qualifiedOnly: true,
      doorStyleFor: () => framelessStyle,
    });
    expect(panels(missing.placed)).toHaveLength(0);
    expect(missing.warnings).toHaveLength(1);
    expect(missing.warnings[0]?.id).toBe("missing-price:base-end");
  });

  it("shows priced auto-added panels on a frameless material list and none on a framed list", () => {
    const window: WallOpening = { uid: "win", kind: "window", side: "top", offset: 78, width: 36, sill: 42, height: 36, label: "Window" };
    const layout = [
      place({ uid: "b-a", masterCode: "B24", placement: "base", offset: 0, width: 24 }),
      place({ uid: "b-b", masterCode: "B24", placement: "base", offset: 24, width: 24 }),
      place({ uid: "b-c", masterCode: "B18", placement: "base", offset: 48, width: 18 }),
      place({ uid: "w-left", masterCode: "W3030", placement: "wall", offset: 48, width: 30, height: 30, depth: 12 }),
      place({ uid: "w-right", masterCode: "W3030", placement: "wall", offset: 116, width: 28, height: 30, depth: 12 }),
    ];
    const prices = new Map<number, number>([[1, 240], [11, 86], [12, 42], [13, 140]]);
    const unitPriceFor = (cabinet: PlacedCabinet) => prices.get(cabinet.cabinetId) ?? null;
    const listFor = (styleName: string, style: DoorStyleEndPanelInput | null) => {
      const plan = qualified(layout, { openings: [window], style });
      const rows = buildMaterialsListRows({
        buildRows: plan.placed.filter((item) => item.placement !== "appliance").map((item) => ({
          sourceUids: [item.uid],
          code: item.masterCode,
          description: [item.description, item.fieldModificationNote].filter(Boolean).join(" — "),
          widthIn: item.width,
          heightIn: item.height ?? 0,
          depthIn: item.depth,
          placement: item.placement,
          color: styleName,
          qty: 1,
          unitPrice: unitPriceFor(item),
          pricingUnitPrice: unitPriceFor(item),
        })),
        pricingLines: [],
        defaultDistributorName: "Cabinet supplier",
        defaultStyleName: styleName,
      });
      return rows;
    };
    const frameless = listFor("Frameless White", framelessStyle);
    const framed = listFor("White Shaker", framedStyle);
    const autoRows = frameless.filter((row) => /Auto-added:/.test(row.description));
    expect(autoRows.length).toBeGreaterThan(0);
    expect(autoRows.every((row) => row.unitPrice != null && row.unitPrice > 0)).toBe(true);
    expect(autoRows.some((row) => row.description.includes("Auto-added: open end of run"))).toBe(true);
    expect(autoRows.some((row) => row.description.includes("Auto-added: window side"))).toBe(true);
    expect(framed.some((row) => /Auto-added:/.test(row.description))).toBe(false);
    expect(materialsListPrintHtml({ rows: frameless, title: "Materials & Parts — Frameless line", styleName: "Frameless White" })).toContain("Auto-added: open end of run");
    expect(materialsListPrintHtml({ rows: framed, title: "Materials & Parts — Framed line", styleName: "White Shaker" })).not.toContain("Auto-added:");
  });
});

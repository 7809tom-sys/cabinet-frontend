import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildDesignCabinetCartLines } from "./designCartLines";
import {
  DEFAULT_ROOM,
  countertopSurfaces,
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { islandCountertopVisibleRects } from "./islandScene";
import {
  EXPOSED_DISHWASHER_PANEL_RULE,
  applyExposedDishwasherPanelRule,
  auditDishwasherPanelCatalog,
  isLineDishwasherPanelSku,
  selectLineDishwasherPanel,
  type DishwasherPanelStock,
} from "./exposedDishwasherPanelRule";

const DWR: DishwasherPanelStock = {
  id: 9390016,
  masterCode: "BEP(DWR)3",
  description: 'Dishwasher Return Panel - 3"W x 34-1/2"H x 24"D',
  category: "Panels",
  subCategory: "Dishwasher Return Panel",
  width: 3,
  height: 34.5,
  depth: 24,
  price: 41,
};

const DWP: DishwasherPanelStock = {
  id: 88001,
  masterCode: "DWP3",
  description: "Dishwasher Panel",
  category: "Panels",
  subCategory: "Dishwasher Panel",
  width: 3,
  height: 34.5,
  depth: 24,
  price: 36,
};

const BASE_END: DishwasherPanelStock = {
  id: 15570001,
  masterCode: "BEP2535",
  description: '25-5/8" W × 35-1/4" H × 3/4" D Base End Panel',
  category: "Accessory",
  subCategory: "Base End Panel",
  width: 25.625,
  height: 35.25,
  depth: 0.75,
  price: 86,
};

function piece(room: RoomData, uid: string, wallId: string, offset: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const width = Number(extra.width ?? 24);
  const depth = Number(extra.depth ?? 24);
  const spot = wallPlacementAt(offset, width, depth, wallId as never, room, extra.peninsulaSide ?? null, false);
  return {
    uid,
    cabinetId: 10,
    masterCode: "B24",
    description: '24" Base Cabinet',
    category: "Base",
    placement: "base",
    x: spot.x,
    y: spot.y,
    width,
    depth,
    height: 34.5,
    rotation: spot.rotation,
    wallId: spot.wallId ?? wallId,
    wallOffset: spot.wallOffset ?? offset,
    peninsulaSide: spot.peninsulaSide ?? extra.peninsulaSide ?? null,
    ...extra,
  } as PlacedCabinet;
}

function dishwasher(room: RoomData, uid: string, wallId: string, offset: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return piece(room, uid, wallId, offset, {
    masterCode: "DW-24",
    description: 'Dishwasher 24"',
    category: "Appliance",
    placement: "appliance",
    mountBottom: 0,
    ...extra,
  });
}

function panels(placed: readonly PlacedCabinet[]): PlacedCabinet[] {
  return placed.filter((item) => item.uid.startsWith("auto-dw-panel:"));
}

describe("line dishwasher panel SKUs", () => {
  it("uses a dishwasher panel code and refuses a base end skin", () => {
    expect(isLineDishwasherPanelSku(DWR)).toBe(true);
    expect(isLineDishwasherPanelSku(DWP)).toBe(true);
    expect(isLineDishwasherPanelSku({ masterCode: "DWEP", description: "Dishwasher End Panel" })).toBe(true);
    expect(isLineDishwasherPanelSku({ masterCode: "DEP3", description: "Dishwasher end panel" })).toBe(true);
    expect(isLineDishwasherPanelSku(BASE_END)).toBe(false);
    expect(isLineDishwasherPanelSku({ masterCode: "WDEP1212", description: "Wall Decorative End Panel" })).toBe(false);
    expect(isLineDishwasherPanelSku({ masterCode: "REPV2496", description: "Refrigerator End Panel" })).toBe(false);
    expect(selectLineDishwasherPanel([BASE_END, DWP, { ...DWR, price: null }])?.masterCode).toBe("DWP3");
    expect(selectLineDishwasherPanel([BASE_END])).toBeNull();
    expect(selectLineDishwasherPanel([{ ...DWP, price: 0 }])).toBeNull();
  });
});

describe("exposed dishwasher panel rule", () => {
  it("names the function Auto Design should call", () => {
    expect(EXPOSED_DISHWASHER_PANEL_RULE).toBe("applyExposedDishwasherPanelRule");
  });

  it("adds the line panel at the end of a run and carries one countertop flush to its outer face", () => {
    const room = { ...DEFAULT_ROOM, width: 156 } as RoomData;
    const placed = [piece(room, "b1", "top", 0), dishwasher(room, "dw", "top", 24)];
    const first = applyExposedDishwasherPanelRule({ placed, room, catalog: [DWR], lineLabel: "Rustic Hickory" });
    const added = panels(first.placed);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ masterCode: "BEP(DWR)3", autoPlacedForUid: "dw", autoPlacedSide: "end", width: 3 });
    expect(first.warnings).toEqual([]);

    const surfaces = countertopSurfaces(first.placed, room);
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]!.width).toBeCloseTo(24 + 24 + 3, 5);
    const second = applyExposedDishwasherPanelRule({ placed: first.placed, room, catalog: [DWR], lineLabel: "Rustic Hickory" });
    expect(second.placed).toBe(first.placed);
  });

  it("does not panel a dishwasher closed by cabinets on both sides", () => {
    const room = { ...DEFAULT_ROOM, width: 156 } as RoomData;
    const placed = [piece(room, "b1", "top", 0), dishwasher(room, "dw", "top", 24), piece(room, "b2", "top", 48)];
    const result = applyExposedDishwasherPanelRule({ placed, room, catalog: [DWR] });
    expect(panels(result.placed)).toHaveLength(0);
    expect(result.placed).toBe(placed);
    expect(result.warnings).toEqual([]);
  });

  it("removes the panel when the exposed side is closed", () => {
    const room = { ...DEFAULT_ROOM, width: 180 } as RoomData;
    const open = applyExposedDishwasherPanelRule({
      placed: [piece(room, "b1", "top", 0), dishwasher(room, "dw", "top", 24)],
      room,
      catalog: [DWP],
    });
    expect(panels(open.placed)).toHaveLength(1);
    const closed = applyExposedDishwasherPanelRule({
      placed: [...open.placed, piece(room, "b2", "top", 48)],
      room,
      catalog: [DWP],
    });
    expect(panels(closed.placed)).toHaveLength(0);
  });

  it("finishes a peninsula end and keeps the countertop flush with the panel", () => {
    const room = {
      ...DEFAULT_ROOM,
      width: 144,
      depth: 120,
      peninsulaRuns: [{
        id: "pen",
        parentWall: "top",
        startOffset: 24,
        turn: 90,
        direction: "right",
        length: 48,
        height: 34.5,
        cabinetSide: "left",
      }],
    } as RoomData;
    const placed = [piece(room, "b1", "pen", 0), dishwasher(room, "dw", "pen", 24)];
    const result = applyExposedDishwasherPanelRule({ placed, room, catalog: [DWP], lineLabel: "Shaker White" });
    const added = panels(result.placed);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ masterCode: "DWP3", wallId: "pen", autoPlacedSide: "end" });
    expect(added[0]!.wallOffset).toBeCloseTo(48, 5);
    const surface = countertopSurfaces(result.placed, room).find((item) => item.peninsulaRunId === "pen");
    expect(surface).toBeTruthy();
    expect(surface!.linearInches ?? surface!.width).toBeCloseTo(24 + 24 + 3, 5);
  });

  it("finishes an island end and stops the countertop on the panel's outer face", () => {
    const room = { ...DEFAULT_ROOM, width: 180, depth: 144 } as RoomData;
    const island = { x: 40, y: 60, width: 120, depth: 24 };
    const base = piece(room, "b1", "top", 40, { islandFace: "front", islandOffset: 0, wallId: undefined, wallOffset: undefined });
    const dw = dishwasher(room, "dw", "top", 64, { islandFace: "front", islandOffset: 24, wallId: undefined, wallOffset: undefined });
    const result = applyExposedDishwasherPanelRule({
      placed: [base, dw],
      room,
      island,
      catalog: [DWR],
      lineLabel: "Rustic Hickory",
    });
    const added = panels(result.placed);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ masterCode: "BEP(DWR)3", islandFace: "front", autoPlacedSide: "end", width: 3 });
    expect(added[0]!.x).toBeCloseTo(dw.x + dw.width, 5);
    const slabs = islandCountertopVisibleRects(island, result.placed);
    expect(slabs).toHaveLength(1);
    const outer = added[0]!.x + added[0]!.width;
    expect(slabs[0]!.x + slabs[0]!.width).toBeCloseTo(outer, 5);
    expect(slabs[0]!.x).toBeLessThan(dw.x);
    expect(slabs[0]!.x + slabs[0]!.width).toBeGreaterThan(dw.x + dw.width);
    const again = applyExposedDishwasherPanelRule({ placed: result.placed, room, island, catalog: [DWR], lineLabel: "Rustic Hickory" });
    expect(again.placed).toBe(result.placed);
  });

  it("lists a note and adds nothing when the line has no priced dishwasher panel", () => {
    const room = { ...DEFAULT_ROOM, width: 156 } as RoomData;
    const placed = [piece(room, "b1", "top", 0), dishwasher(room, "dw", "top", 24)];
    const result = applyExposedDishwasherPanelRule({
      placed,
      room,
      catalog: [BASE_END],
      lineLabel: "Luxe Classic LSA",
    });
    expect(panels(result.placed)).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toMatch(/Luxe Classic LSA/);
    expect(result.warnings[0]?.message).toMatch(/no priced dishwasher panel/);
    expect(result.warnings[0]?.message).not.toMatch(/\$0/);
    const cart = buildDesignCabinetCartLines({
      placed: result.placed,
      styleId: 540005,
      distributorId: 270001,
      tier: "homeowner",
      styleNameById: new Map([[540005, "Luxe Classic LSA"]]),
      unitPriceFor: () => 86,
    });
    expect(cart.some((line) => line.masterCode === "BEP2535" || line.masterCode === "DWP3" || line.masterCode === "BEP(DWR)3")).toBe(false);
  });

  it("puts the priced panel on the cabinet list", () => {
    const room = { ...DEFAULT_ROOM, width: 156 } as RoomData;
    const placed = [piece(room, "b1", "top", 0), dishwasher(room, "dw", "top", 24)];
    const result = applyExposedDishwasherPanelRule({ placed, room, catalog: [DWP], lineLabel: "DL" });
    const cart = buildDesignCabinetCartLines({
      placed: result.placed,
      styleId: 600001,
      distributorId: 450001,
      tier: "homeowner",
      styleNameById: new Map([[600001, "White Shaker"]]),
      unitPriceFor: (cabinet) => cabinet.masterCode === "DWP3" ? 36 : 120,
    });
    expect(cart.find((line) => line.masterCode === "DWP3")).toMatchObject({ unitPrice: 36, qty: 1 });
  });
});

describe("catalog lines in this repo", () => {
  it("records the dishwasher panel each fixture line actually sells", () => {
    const real = JSON.parse(readFileSync(new URL("./__fixtures__/autoDesignRealCatalog.json", import.meta.url), "utf8")) as Record<string, { accessory?: DishwasherPanelStock[] }>;
    const matrix = JSON.parse(readFileSync(new URL("./__fixtures__/autoDesignMatrixCatalog.json", import.meta.url), "utf8")) as Record<string, { accessory?: DishwasherPanelStock[] }>;
    const merged = new Map<string, DishwasherPanelStock[]>();
    for (const [lineId, entry] of [...Object.entries(real), ...Object.entries(matrix)]) {
      merged.set(lineId, [...(merged.get(lineId) ?? []), ...(entry.accessory ?? [])]);
    }
    const audit = auditDishwasherPanelCatalog([...merged.entries()].map(([lineId, items]) => ({ lineId, items })));
    expect(audit.find((line) => line.lineId === "330011")).toMatchObject({ sku: "BEP(DWR)3", priced: false, price: null });
    expect(audit.find((line) => line.lineId === "540005")?.sku).toBeNull();
    expect(audit.every((line) => line.priced === false)).toBe(true);
    expect(audit.filter((line) => line.sku == null).map((line) => line.lineId).sort()).toEqual(
      ["330002", "330014", "330020", "510004", "540005", "540007", "540029"].sort(),
    );
  });
});

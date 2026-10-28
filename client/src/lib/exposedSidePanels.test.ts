import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet, type WallOpening } from "./design";
import { resetKitchenRuleParameters, setKitchenRuleParameters } from "./kitchenRuleParameters";
import {
  autoAddedOrderSurfaces,
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
}): PlacedCabinet {
  const depth = partial.depth ?? (partial.placement === "wall" ? 12 : 24);
  const height = partial.height ?? (partial.placement === "wall" ? 30 : partial.placement === "tall" ? 84 : 34.5);
  const spot = wallPlacementAt(partial.offset, partial.width, depth, "top", room);
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
    wallId: spot.wallId ?? "top",
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
    expect(missing.warnings[0]?.message).toMatch(/no priced panel/);
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
});

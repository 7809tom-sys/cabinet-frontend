import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM,
  bearsCountertop,
  countertopSurfaces,
  countertopSurfacePlanPolygon,
  insideCornerHoldIn,
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import {
  DISHWASHER_FORTY_FIVE_PANEL_REASON,
  DISHWASHER_RUN_END_PANEL_REASON,
  dishwasherPanelStock,
  isDishwasherItem,
  isDishwasherPanelStock,
  syncDishwasherPanels,
  type DishwasherPanelStock,
} from "./dishwasherPanelRule";
import { resetKitchenRuleParameters, setKitchenRuleParameters } from "./kitchenRuleParameters";

const DWR_STOCK: DishwasherPanelStock = {
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

function customRoom(): RoomData {
  const room = {
    ...DEFAULT_ROOM,
    width: 180,
    depth: 180,
    vertices: [
      { id: "v1", x: 0, y: 0 },
      { id: "v2", x: 60, y: 60 },
      { id: "v3", x: 60, y: 180 },
      { id: "v4", x: 0, y: 180 },
    ],
    customWalls: [
      { id: "diagonal", startVertexId: "v1", endVertexId: "v2", lockedAngle: 45 as const },
      { id: "straight", startVertexId: "v2", endVertexId: "v3" },
      { id: "return", startVertexId: "v3", endVertexId: "v4" },
      { id: "close", startVertexId: "v4", endVertexId: "v1" },
    ],
  };
  return room as RoomData;
}

function piece(
  room: RoomData,
  uid: string,
  wallId: string,
  offset: number,
  extra: Partial<PlacedCabinet> = {},
): PlacedCabinet {
  const width = Number(extra.width ?? 24);
  const depth = Number(extra.depth ?? 24);
  const spot = wallPlacementAt(offset, width, depth, wallId as never, room, null, false);
  return {
    uid,
    cabinetId: 10,
    masterCode: "B24",
    description: '24" Base Cabinet',
    category: "Base",
    subCategory: "Standard Base",
    placement: "base",
    x: spot.x,
    y: spot.y,
    width,
    depth,
    height: 34.5,
    rotation: spot.rotation,
    wallId: spot.wallId ?? wallId,
    wallOffset: spot.wallOffset ?? offset,
    ...extra,
  } as PlacedCabinet;
}

function dishwasher(room: RoomData, uid: string, wallId: string, offset: number): PlacedCabinet {
  return piece(room, uid, wallId, offset, {
    masterCode: "DW-24",
    description: 'Dishwasher 24"',
    category: "Appliance",
    subCategory: null,
    placement: "appliance",
    mountBottom: 0,
  });
}

function panels(placed: readonly PlacedCabinet[]): PlacedCabinet[] {
  return placed.filter((item) => item.autoPlacedReason === DISHWASHER_RUN_END_PANEL_REASON
    || item.autoPlacedReason === DISHWASHER_FORTY_FIVE_PANEL_REASON);
}

describe("dishwasher panel stock", () => {
  it("recognises the DWR dishwasher panel and base panel boards, never refrigerator or wall panels", () => {
    expect(isDishwasherPanelStock({ masterCode: "BEP(DWR)3", description: "Dishwasher Return Panel" })).toBe(true);
    expect(isDishwasherPanelStock({ masterCode: "DWR3", description: "3 in panel" })).toBe(true);
    expect(isDishwasherPanelStock({ masterCode: "DWP24", description: "Dishwasher Panel", subCategory: "Decorative End Panel" })).toBe(true);
    expect(isDishwasherPanelStock({ masterCode: "BP9642", description: "96 x 42 long panel" })).toBe(true);
    expect(isDishwasherPanelStock({ masterCode: "BEP2535", description: '25-5/8" Base End Panel' })).toBe(true);
    expect(isDishwasherPanelStock({ masterCode: "REPV2496", description: "Refrigerator End Panel" })).toBe(false);
    expect(isDishwasherPanelStock({ masterCode: "WEP1542", description: "Wall End Panel" })).toBe(false);
    expect(isDishwasherPanelStock({ masterCode: "TEP3096", description: "Tall end panel" })).toBe(false);
  });

  it("prefers the printed DWR family and returns null when the line sells none", () => {
    const board = { ...DWR_STOCK, id: 2, masterCode: "BEP2535", description: "Base End Panel", width: 0.75, price: 86 };
    expect(dishwasherPanelStock([board, DWR_STOCK])?.masterCode).toBe("BEP(DWR)3");
    expect(dishwasherPanelStock([])).toBeNull();
    expect(dishwasherPanelStock([{ masterCode: "REPV2496", description: "Refrigerator End Panel", id: 3, price: 120 }])).toBeNull();
  });

  it("identifies a floor dishwasher only at base height", () => {
    const room = customRoom();
    expect(isDishwasherItem(dishwasher(room, "dw", "straight", 0))).toBe(true);
    expect(isDishwasherItem(piece(room, "tall", "straight", 0, { placement: "tall", height: 84 }))).toBe(false);
    expect(isDishwasherItem(piece(room, "range", "straight", 0, {
      masterCode: "RANGE-30", description: '30" Range', category: "Appliance", placement: "appliance", height: 36, mountBottom: 0,
    }))).toBe(false);
  });
});

describe("dishwasher at the end of a run", () => {
  it("auto-places one DWR panel at the open end and repeats idempotently", () => {
    const room = { ...DEFAULT_ROOM, width: 156 } as RoomData;
    const placed = [
      piece(room, "b1", "top", 0),
      piece(room, "b2", "top", 24),
      dishwasher(room, "dw", "top", 48),
    ];
    const first = syncDishwasherPanels({ placed, room, catalog: [DWR_STOCK] });
    const dwPanels = panels(first.placed);
    expect(dwPanels).toHaveLength(1);
    expect(dwPanels[0]).toMatchObject({
      masterCode: "BEP(DWR)3",
      placement: "base",
      category: "Panels",
      subCategory: "Dishwasher Return Panel",
      autoPlacedReason: DISHWASHER_RUN_END_PANEL_REASON,
      autoPlacedForUid: "dw",
      autoPlacedSide: "end",
      width: 3,
      mountBottom: 0,
    });
    // It sits at the run end, flush with the dishwasher's finished end.
    expect(dwPanels[0]!.wallOffset).toBeCloseTo(72, 6);
    expect(first.warnings).toEqual([]);

    const second = syncDishwasherPanels({ placed: first.placed, room, catalog: [DWR_STOCK] });
    expect(panels(second.placed)).toHaveLength(1);
    // A settled plan is returned by reference, so the Designer effect cannot loop.
    expect(second.placed).toBe(first.placed);
  });

  it("carries one continuous countertop across the cabinet, the dishwasher and the panel", () => {
    const room = { ...DEFAULT_ROOM, width: 156 } as RoomData;
    const placed = [
      piece(room, "b1", "top", 0),
      dishwasher(room, "dw", "top", 24),
    ];
    const withPanel = syncDishwasherPanels({ placed, room, catalog: [DWR_STOCK] }).placed;
    const panel = panels(withPanel)[0]!;
    // The run-end panel continues the run, so it bears the same top.
    expect(bearsCountertop(panel)).toBe(true);

    const surfaces = countertopSurfaces(withPanel, room);
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]!.width).toBeCloseTo(24 + 24 + 3, 6);

    const covered = (target: { x: number; y: number }) => {
      const polygon = countertopSurfacePlanPolygon(surfaces[0]!);
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i]!;
        const b = polygon[j]!;
        if ((a.y > target.y) !== (b.y > target.y) && target.x < (b.x - a.x) * (target.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      }
      return inside;
    };
    // Over the dishwasher, over the panel, and over their shared seams.
    expect(covered({ x: 36, y: 12 })).toBe(true);
    expect(covered({ x: 48, y: 12 })).toBe(true);
    expect(covered({ x: 49.5, y: 12 })).toBe(true);
  });

  it("does not panel a dishwasher that is closed by cabinets on both sides", () => {    const room = { ...DEFAULT_ROOM, width: 156 } as RoomData;
    const placed = [
      piece(room, "b1", "top", 0),
      dishwasher(room, "dw", "top", 24),
      piece(room, "b2", "top", 48),
    ];
    const result = syncDishwasherPanels({ placed, room, catalog: [DWR_STOCK] });
    expect(panels(result.placed)).toHaveLength(0);
    expect(result.placed).toBe(placed);
  });

  it("warns instead of inventing a $0 line when the line sells no dishwasher panel", () => {
    const room = { ...DEFAULT_ROOM, width: 156 } as RoomData;
    const placed = [piece(room, "b1", "top", 0), dishwasher(room, "dw", "top", 24)];
    const result = syncDishwasherPanels({ placed, room, catalog: [] });
    expect(panels(result.placed)).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.id).toBe("missing-price:dw-panel:dw:end");
    expect(result.warnings[0]?.message).toMatch(/dishwasher panel \(DWR\)/);
    expect(result.warnings[0]?.message).toMatch(/\$0/);
  });

  it("removes its own panel when the dishwasher is no longer the run end", () => {
    const room = { ...DEFAULT_ROOM, width: 180 } as RoomData;
    const withEnd = syncDishwasherPanels({
      placed: [piece(room, "b1", "top", 0), dishwasher(room, "dw", "top", 24)],
      room,
      catalog: [DWR_STOCK],
    });
    expect(panels(withEnd.placed)).toHaveLength(1);
    const nowClosed = syncDishwasherPanels({
      placed: [...withEnd.placed, piece(room, "b2", "top", 48)],
      room,
      catalog: [DWR_STOCK],
    });
    expect(panels(nowClosed.placed)).toHaveLength(0);
  });
});

describe("dishwasher at a 45-degree turn", () => {
  const room = customRoom();
  const diagonalLength = Math.hypot(60, 60);
  const hold = insideCornerHoldIn(45, 24);
  // The dishwasher is the last cabinet before the turn, at the mandatory 11"
  // hold, with a base butted flush behind it and the next run turning at it.
  const dwStart = diagonalLength - 24 - hold;
  const angledLayout = (): PlacedCabinet[] => [
    piece(room, "d1", "diagonal", dwStart - 24),
    dishwasher(room, "dw", "diagonal", dwStart),
    piece(room, "straight", "straight", hold),
  ];

  it("auto-places one DWR panel in the fitted 45° corner slot", () => {
    const result = syncDishwasherPanels({ placed: angledLayout(), room, catalog: [DWR_STOCK] });
    const dwPanels = panels(result.placed);
    expect(dwPanels).toHaveLength(1);
    expect(dwPanels[0]).toMatchObject({
      autoPlacedReason: DISHWASHER_FORTY_FIVE_PANEL_REASON,
      autoPlacedForUid: "dw",
      autoPlacedSide: "end",
      wallId: "diagonal",
      width: 3,
    });
    expect(dwPanels[0]!.wallOffset).toBeCloseTo(diagonalLength - hold, 6);
    expect(result.warnings).toEqual([]);
  });

  it("leaves the continuous countertop over the angled dishwasher and over the miter join", () => {
    const withPanel = syncDishwasherPanels({ placed: angledLayout(), room, catalog: [DWR_STOCK] }).placed;
    const surfaces = countertopSurfaces(withPanel, room);

    // Both runs are mitered to one real 45° seam and the wall-side corner is closed.
    expect(surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ customWallId: "diagonal", customWallMiterVertexId: "v2" }),
      expect.objectContaining({ customWallId: "straight", customWallMiterVertexId: "v2" }),
      expect.objectContaining({ customWallCornerInfill: true, customWallMiterVertexId: "v2" }),
    ]));

    const covered = (target: { x: number; y: number }) => surfaces.some((surface) => {
      const polygon = countertopSurfacePlanPolygon(surface);
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i]!;
        const b = polygon[j]!;
        if ((a.y > target.y) !== (b.y > target.y) && target.x < (b.x - a.x) * (target.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      }
      return inside;
    });

    const dw = withPanel.find((item) => item.uid === "dw")!;
    // Directly above the angled dishwasher.
    expect(covered({ x: dw.x + 12, y: dw.y + 12 })).toBe(true);
    // Above the mitered joint where the two runs meet.
    expect(covered({ x: dw.x + 14, y: dw.y + 14 })).toBe(true);
    // In the wall-side pocket the 11" holds leave — closed, so no gap or break.
    expect(covered({ x: 57, y: 63 })).toBe(true);
  });
});

describe("dishwasher panels never disturb unrelated layouts", () => {
  it("returns the same array for a room with no dishwasher", () => {
    const room = { ...DEFAULT_ROOM, width: 156 } as RoomData;
    const placed = [piece(room, "b1", "top", 0), piece(room, "b2", "top", 24)];
    const result = syncDishwasherPanels({ placed, room, catalog: [DWR_STOCK] });
    expect(result.placed).toBe(placed);
    expect(result.warnings).toEqual([]);
  });

  it("drops only its own panels when the owner switch unpublishes the rule", () => {
    const room = { ...DEFAULT_ROOM, width: 156 } as RoomData;
    const userPanel = piece(room, "user-panel", "top", 72, {
      masterCode: "BEP2535",
      description: "Base End Panel",
      width: 0.75,
    });
    const placed = [piece(room, "b1", "top", 0), dishwasher(room, "dw", "top", 24), userPanel];
    const on = syncDishwasherPanels({ placed, room, catalog: [DWR_STOCK] });
    expect(panels(on.placed)).toHaveLength(1);

    setKitchenRuleParameters({ dishwasher_panel_enabled: 0 });
    try {
      const off = syncDishwasherPanels({ placed: on.placed, room, catalog: [DWR_STOCK] });
      expect(panels(off.placed)).toHaveLength(0);
      // The customer's own panel is untouched.
      expect(off.placed.some((item) => item.uid === "user-panel")).toBe(true);
    } finally {
      resetKitchenRuleParameters();
    }
  });
});

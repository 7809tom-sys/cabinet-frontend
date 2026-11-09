/**
 * Issue 353, reviewer round 2, outcomes 1, 2 and 8 (Tom, Nov 9 2026).
 *
 * 1. A REAL gap between adjoining base cabinets (the reviewer's 3-inch case) is
 *    closed with a priced filler from the line's own stock, and the cart carries
 *    that filler. A slab never floats over an empty void.
 * 2. The end of a run is trimmed on a rotated / angled slab too, not only on an
 *    axis-aligned one.
 * 8. Only a STANDALONE short upper loses its panel; an over-fridge cap and an
 *    over-range bridge keep theirs, and no panel beside an upper reaches below
 *    that upper's bottom.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM,

  countertopSurfaces,
  countertopSurfacePlanPolygon,
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { applyDesignerLayoutRules } from "./designerLayoutRules";
import { autoAddedOrderSurfaces, catalogItemToExposedPanelStock, syncExposedSidePanels } from "./exposedSidePanels";
import { buildDesignCabinetCartLines } from "./designCartLines";
import {
  isStandaloneShortUpper,
  panelFitsUpperBand,
  isApplianceSurroundUpper,
} from "./shortUpper";

const ROOM: RoomData = { ...DEFAULT_ROOM, width: 192, depth: 168, ceilingHeight: 96 };

function base(uid: string, offset: number, width = 24): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", ROOM);
  return {
    uid,
    cabinetId: 1,
    masterCode: `B${width}`,
    description: `${width}" Base Cabinet`,
    category: "Base",
    subCategory: "Standard Base",
    placement: "base",
    ...spot,
    width,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    wallId: "top",
    wallOffset: offset,
    numberOfDoors: 2,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}

const fillerStock = [
  { id: 601, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: "3", depth: "24", height: "34.5", placement: "base" },
  { id: 602, masterCode: "BF6", description: '6" Base Filler', category: "Filler", subCategory: "Filler", width: "6", depth: "24", height: "34.5", placement: "base" },
] as never[];

const runLayout = (gap: number) => ({ placed: [base("a", 0), base("b", 24 + gap)] });

describe("outcome 1: a real gap between adjoining bases is CLOSED, never spanned", () => {
  for (const gap of [1, 3, 6]) {
    it(`closes a ${gap}-inch gap with a priced catalogue filler`, () => {
      let uid = 0;
      const result = applyDesignerLayoutRules({
        placed: runLayout(gap).placed,
        room: ROOM,
        openings: [],
        fillers: fillerStock,
        makeUid: () => `g${++uid}`,
        styleId: 11,
        // The real Auto-Design path: filler is the last resort, so the automatic
        // small-gap pass is OFF and only the no-void rule may close the seam.
        allowAutoFillers: false,
      });
      const boards = result.placed.filter((item) => /filler/i.test(`${item.masterCode} ${item.subCategory ?? ""}`));
      expect(boards).toHaveLength(1);
      const board = boards[0]!;
      // A real catalog SKU, installed in the gap, matched to its neighbour.
      expect(["BF3", "BF6"]).toContain(board.masterCode);
      expect(board.width).toBeCloseTo(gap, 6);
      expect(board.wallOffset).toBeCloseTo(24, 6);
      expect(board.fillerForCabinetUid).toBe("a");
      expect(board.fillerPieceGroupId).toBeTruthy();

      // No void is left: the run's cabinets plus the board tile the whole span.
      const spans = result.placed
        .filter((item) => item.wallId === "top")
        .map((item) => ({ start: item.wallOffset ?? 0, end: (item.wallOffset ?? 0) + item.width }))
        .sort((left, right) => left.start - right.start);
      for (let index = 0; index < spans.length - 1; index += 1) {
        expect(spans[index]!.end).toBeCloseTo(spans[index + 1]!.start, 6);
      }
    });
  }

  it("runs one continuous top over the filled seam", () => {
    let uid = 0;
    const result = applyDesignerLayoutRules({
      placed: runLayout(3).placed,
      room: ROOM,
      openings: [],
      fillers: fillerStock,
      makeUid: () => `g${++uid}`,
      styleId: 11,
      allowAutoFillers: false,
    });
    const slabs = countertopSurfaces(result.placed, ROOM).filter((surface) => !surface.raisedBar && !surface.peninsulaRunId);
    expect(slabs).toHaveLength(1);
    const polygon = countertopSurfacePlanPolygon(slabs[0]!);
    expect(Math.min(...polygon.map((point) => point.x))).toBeCloseTo(0, 6);
    expect(Math.max(...polygon.map((point) => point.x))).toBeCloseTo(51, 6);
  });

  it("bills the filler on the cart", () => {
    let uid = 0;
    const result = applyDesignerLayoutRules({
      placed: runLayout(3).placed,
      room: ROOM,
      openings: [],
      fillers: fillerStock,
      makeUid: () => `g${++uid}`,
      styleId: 11,
      allowAutoFillers: false,
    });
    const lines = buildDesignCabinetCartLines({
      placed: result.placed,
      styleId: 11,
      distributorId: 7,
      tier: "homeowner",
      styleNameById: new Map([[11, "Shaker White"]]),
      unitPriceFor: (cabinet) => (cabinet.masterCode === "BF3" ? 42 : 200),
    });
    const fillerLine = lines.find((line) => line.masterCode === "BF3");
    expect(fillerLine).toBeTruthy();
    expect(fillerLine!.qty).toBe(1);
    expect(fillerLine!.unitPrice).toBe(42);
    // The cart total includes it.
    expect(lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.qty, 0)).toBe(442);
  });

  it("leaves an appliance opening and a run end alone", () => {
    // A range flush against its neighbours is an opening the top covers; it is
    // not a void to fill. (A real seam between a cabinet and an appliance is
    // still closed — that is the cabinet-to-appliance filler rule.)
    const range = base("r", 24, 30);
    range.placement = "appliance";
    range.masterCode = "RANGE-30";
    range.description = '30" Range';
    range.category = "Appliance";
    range.subCategory = "Appliance";
    range.applianceRole = "base-height";
    let uid = 0;
    const result = applyDesignerLayoutRules({
      placed: [base("a", 0), range, base("c", 54)],
      room: ROOM,
      openings: [],
      fillers: fillerStock,
      makeUid: () => `g${++uid}`,
      styleId: 11,
      allowAutoFillers: false,
    });
    const boards = result.placed.filter((item) => /filler/i.test(`${item.masterCode} ${item.subCategory ?? ""}`));
    expect(boards.map((board) => [board.masterCode, board.wallOffset])).toEqual([]);
  });
});

describe("outcome 2: an angled or rotated slab also stops at the cabinets", () => {
  it("keeps a rotated base's top on that base's own contour, with no AABB corner", () => {
    const spot = wallPlacementAt(40, 24, 24, "top", ROOM);
    const rotated = {
      ...base("rot", 40),
      ...spot,
      rotation: 45,
      width: 24,
      depth: 24,
      wallId: "top",
      wallOffset: 40,
    } as PlacedCabinet;
    const surfaces = countertopSurfaces([rotated], ROOM);
    expect(surfaces).toHaveLength(1);
    const polygon = countertopSurfacePlanPolygon(surfaces[0]!);
    // Every vertex is on the cabinet's own rotated body, so the slab area equals
    // the cabinet width × finished depth instead of the larger bounding square.
    const area = Math.abs(polygon.reduce((sum, point, index) => {
      const next = polygon[(index + 1) % polygon.length]!;
      return sum + point.x * next.y - next.x * point.y;
    }, 0)) / 2;
    expect(area).toBeCloseTo(24 * (24 + 1.5), 6);
    // And it is genuinely rotated: the outline is a diamond, not an axis box.
    const xs = polygon.map((point) => Math.round(point.x * 100) / 100);
    expect(new Set(xs).size).toBeGreaterThan(2);
  });

  it("still keeps the front overhang and the finished depth", () => {
    const rotated = { ...base("rot2", 30), rotation: 45 } as PlacedCabinet;
    const surfaces = countertopSurfaces([rotated], ROOM);
    const polygon = countertopSurfacePlanPolygon(surfaces[0]!);
    const diagonal = Math.hypot(polygon[1]!.x - polygon[0]!.x, polygon[1]!.y - polygon[0]!.y);
    expect(diagonal).toBeCloseTo(24, 6); // the run width along the rotated edge
    const depthEdge = Math.hypot(polygon[2]!.x - polygon[1]!.x, polygon[2]!.y - polygon[1]!.y);
    expect(depthEdge).toBeCloseTo(25.5, 6);
  });
});

describe("outcome 8: only a standalone short upper loses its end panel", () => {
  function wallUpper(uid: string, offset: number, width: number, height: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
    const spot = wallPlacementAt(offset, width, 13.5, "top", ROOM);
    return {
      uid,
      cabinetId: 1,
      masterCode: `W${width}${height}`,
      description: "Wall cabinet",
      category: "Wall",
      subCategory: "Standard Wall",
      placement: "wall",
      ...spot,
      width,
      depth: 13.5,
      height,
      rotation: spot.rotation,
      wallId: "top",
      wallOffset: offset,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      constructionMethod: "frameless",
      ...extra,
    } as PlacedCabinet;
  }

  const panelStock = [
    { id: 201, masterCode: "WEP1523", description: "Wall end panel", category: "Accessory", subCategory: "End panel", width: "0.75", depth: "15.25", height: "22.625" },
    { id: 202, masterCode: "WEP1530", description: "Wall end panel", category: "Accessory", subCategory: "End panel", width: "0.75", depth: "15.25", height: "30.25" },
  ];
  const stock = panelStock.flatMap((item) => {
    const converted = catalogItemToExposedPanelStock(item, 120);
    return converted ? [converted] : [];
  });

  it("classifies an over-range bridge and an over-fridge cap as appliance surrounds", () => {
    expect(isApplianceSurroundUpper(wallUpper("bridge", 0, 30, 24, { overRangeMicrowaveBridge: true }))).toBe(true);
    expect(isApplianceSurroundUpper(wallUpper("cap", 0, 36, 22.625, { refrigeratorAssemblyRole: "bridge" }))).toBe(true);
    expect(isApplianceSurroundUpper(wallUpper("plain", 0, 30, 24))).toBe(false);
    // A short upper standing over its range is an appliance surround even
    // without the explicit bridge flag.
    const range = base("r", 0, 30);
    range.placement = "appliance";
    range.masterCode = "RANGE-30";
    range.description = '30" Range';
    expect(isStandaloneShortUpper(wallUpper("over-range", 0, 30, 24), ROOM, [range])).toBe(false);
  });

  it("gives a standalone 24-inch upper no panel, but keeps a bridge's panel", () => {
    const lone = wallUpper("lone", 40, 30, 24);
    const bridge = wallUpper("bridge", 100, 30, 24, { overRangeMicrowaveBridge: true });
    const result = syncExposedSidePanels({
      placed: [lone, bridge],
      room: ROOM,
      catalog: stock,
      qualifiedOnly: true,
      doorStyleFor: () => ({ ourName: "AltaEuro Luxe", isFrameless: true } as never),
      priceFor: () => 120,
      pricesReady: true,
    });
    const panels = result.placed.filter((item) => item.autoPlacedReason);
    expect(panels.some((panel) => panel.autoPlacedForUid === "lone")).toBe(false);
    expect(panels.some((panel) => panel.autoPlacedForUid === "bridge")).toBe(true);
  });

  it("never lets a panel beside an upper reach below that upper's bottom", () => {
    const upper = wallUpper("upper", 40, 30, 30);
    expect(panelFitsUpperBand({ upperBottomIn: 54, upperHeightIn: 30, panelBottomIn: 0, panelHeightIn: 96 }))
      .toEqual({ bottomIn: 54, heightIn: 30 });
    // A board that would stick out below the bottom is clamped to the band.
    expect(panelFitsUpperBand({ upperBottomIn: 72, upperHeightIn: 24, panelBottomIn: 0, panelHeightIn: 96 }))
      .toEqual({ bottomIn: 72, heightIn: 24 });
    // Nothing left after clamping is refused outright.
    expect(panelFitsUpperBand({ upperBottomIn: 72, upperHeightIn: 24, panelBottomIn: 0, panelHeightIn: 60 })).toBeNull();

    const result = syncExposedSidePanels({
      placed: [upper],
      room: ROOM,
      catalog: stock,
      qualifiedOnly: true,
      doorStyleFor: () => ({ ourName: "AltaEuro Luxe", isFrameless: true } as never),
      priceFor: () => 120,
      pricesReady: true,
    });
    for (const panel of result.placed.filter((item) => item.autoPlacedReason)) {
      const panelHeight = Number(panel.height) || 0;
      expect(panelHeight).toBeLessThanOrEqual(30 + 0.01);
    }
  });

  it("bills nothing for a standalone short upper's side", () => {
    const lone = wallUpper("lone", 40, 30, 24);
    const result = syncExposedSidePanels({
      placed: [lone],
      room: ROOM,
      catalog: stock,
      qualifiedOnly: true,
      doorStyleFor: () => ({ ourName: "AltaEuro Luxe", isFrameless: true } as never),
      priceFor: () => 120,
      pricesReady: true,
    });
    const prices = new Map(stock.map((item) => [item.id, item.price]));
    const surfaces = autoAddedOrderSurfaces({
      placed: result.placed,
      styleId: 11,
      distributorId: 7,
      tier: "homeowner",
      styleName: "Frameless White",
      unitPriceFor: (cabinet) => prices.get(cabinet.cabinetId) ?? null,
    });
    expect(surfaces.materialList).toEqual([]);
    expect(surfaces.invoice.total).toBe(0);
  });
});

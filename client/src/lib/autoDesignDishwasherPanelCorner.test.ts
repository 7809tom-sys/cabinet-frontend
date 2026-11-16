/**
 * Tom, Nov 16 2026 (8:35 AM CT, plan screenshot; 8:56 AM CT, by voice; 3D view
 * of the dishwasher at the end of Wall 1 against the 45° turn to the sink wall):
 * "always should have a dishwasher panel when its exposed plus we got to connect
 * with the other wall". Auto Design now runs the dishwasher-panel step inside
 * the build; at a 45° turn the next wall's cabinets slide up to the 3″ wiggle
 * room to make room for the panel, and the corner closes against the panel.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { measuredAngledWallTransition } from "./angledWallFiller";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { isDishwasherItem, isDishwasherPanelPlacement, syncDishwasherPanels, type DishwasherPanelStock } from "./dishwasherPanelRule";
import {
  cabinetPlanBodiesIntersect,
  isFillerItem,
  wallLength,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const STYLE = "330011";
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const ACCESSORIES = REAL[STYLE]!.accessory as DesignCabinet[];
const FILLERS = ACCESSORIES.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));
const PANEL_ROWS = ACCESSORIES.filter((row) => /dishwasher/i.test(`${row.description} ${row.subCategory}`));
const PANEL_STOCK: DishwasherPanelStock[] = PANEL_ROWS.map((row) => ({ ...(row as unknown as DishwasherPanelStock), price: 100 }));

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

/**
 * Tom's plan view: Wall 1 (fridge, bases, dishwasher at its end), a 45° wall
 * with the sink, the range wall (B12 / 30″ range / B12), a second 45° wall and
 * the bottom wall.
 */
function tomsRoom(): RoomData {
  return {
    width: 204, depth: 210, ceilingHeight: 96, openWallPath: true,
    vertices: [
      { id: "v1", x: 0, y: 0 }, { id: "v2", x: 138, y: 0 }, { id: "v3", x: 204, y: 66 },
      { id: "v4", x: 204, y: 144 }, { id: "v5", x: 138, y: 210 }, { id: "v6", x: 40, y: 210 },
    ],
    customWalls: [
      { id: "top", label: "Wall 1", startVertexId: "v1", endVertexId: "v2" },
      { id: "angTR", label: "Wall 2", startVertexId: "v2", endVertexId: "v3", lockedAngle: 45 },
      { id: "right", label: "Wall 3", startVertexId: "v3", endVertexId: "v4" },
      { id: "angBR", label: "Wall 4", startVertexId: "v4", endVertexId: "v5", lockedAngle: 45 },
      { id: "bottom", label: "Wall 5", startVertexId: "v5", endVertexId: "v6" },
    ],
  } as RoomData;
}

function build(sinkCenter: number, extra: Partial<Parameters<typeof runAutoDesignLayout>[0]> = {}): AutoDesignLayoutSuccess {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "u-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 2", centerOffsetIn: sinkCenter }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 3", centerOffsetIn: 39 },
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 },
      // The dishwasher ends Wall 1 at the 11″ corner hold, as in Tom's 3D view.
      dishwasher: { wallLabel: "Wall 1", centerOffsetIn: 115 },
      tallCabinets: null, overRangeAnswer: "open",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    } as AutoDesignInputs,
    room: tomsRoom(), openings: [],
    baseCatalog: BASES, wallCatalog: WALLS, fillers: FILLERS,
    panelCatalog: PANEL_ROWS,
    appliancePalette: [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70)],
    refrigeratorCaps: WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
    refrigeratorEndPanels: ACCESSORIES.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`)),
    styleId: Number(STYLE), makeUid: () => `dwc-${++uid}`,
    ...extra,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

function spanOn(item: PlacedCabinet, room: RoomData) {
  const start = wallRunOffset(item, item.wallId!, room);
  return { start, end: start + wallRunSpan(item, item.wallId!, room) };
}

function cornerPieces(placed: readonly PlacedCabinet[], panelUid: string) {
  return placed.filter((item) => item.fillerTransitionKind === "front-miter-pair"
    && (item.fillerTransitionNeighborUid === panelUid || item.fillerForCabinetUid === panelUid
      || placed.some((other) => other.uid === item.fillerTransitionNeighborUid && other.fillerTransitionNeighborUid === panelUid)));
}

describe("Auto Design: dishwasher panel at the 45° corner of Wall 1 (Tom, Nov 16)", () => {
  const room = tomsRoom();

  it("places the panel with no conflict and closes the corner against it (sink base 12″ from the corner)", () => {
    const result = build(30);
    const dishwasher = result.placed.find(isDishwasherItem)!;
    expect(dishwasher.wallId).toBe("top");
    const panel = result.placed.find((item) => isDishwasherPanelPlacement(item) && item.autoPlacedForUid === dishwasher.uid && item.autoPlacedSide === "end");
    expect(panel?.masterCode).toBe(PANEL_ROWS[0]!.masterCode);
    expect(panel?.width).toBe(3);
    expect(spanOn(panel!, room).start).toBeCloseTo(spanOn(dishwasher, room).end, 3);
    // No cabinet had to move.
    expect(result.notes.some((note) => /so the dishwasher panel fits/.test(note))).toBe(false);
    // The sink-wall cabinet gets one real filler cut to the miter point, named against the panel.
    const board = result.placed.find((item) => item.fillerTransitionKind === "front-miter-pair" && item.fillerTransitionNeighborUid === panel!.uid);
    expect(board?.wallId).toBe("angTR");
    expect(FILLERS.some((row) => row.masterCode === board!.masterCode)).toBe(true);
    expect(board!.width).toBeGreaterThan(0.5);
    expect(board!.width).toBeLessThanOrEqual(Number(FILLERS.find((row) => row.masterCode === board!.masterCode)!.width));
    // The base corner of Wall 1 / Wall 2 is no longer reported open, and the bogus
    // "28⅛″" measurement from the cabinet behind the dishwasher is gone.
    expect(result.reviewFindings.some((finding) => finding.code === "angled-base-corner-open" && /top and angTR|angTR and top/.test(finding.title))).toBe(false);
    for (const item of result.placed) {
      if (item.wallId !== "top" || item.placement !== "base" || isFillerItem(item) || item.fillerPieceGroupId) continue;
      expect(measuredAngledWallTransition(item, room, result.placed)).toBeNull();
    }
  });

  it("slides the sink-wall cabinets ⅜″ (within 3″) when the panel would bump them (sink base 11″ from the corner)", () => {
    const result = build(29);
    const panel = result.placed.find(isDishwasherPanelPlacement)!;
    expect(panel.autoPlacedReason).toBe("dw-forty-five-turn-panel");
    const sinkBase = result.placed.find((item) => item.wallId === "angTR" && /^SB/.test(item.masterCode))!;
    expect(spanOn(sinkBase, room).start).toBeCloseTo(11.375, 3);
    expect(result.notes.some((note) => /^SB36 on angTR slid ⅜" away from the 45° corner/.test(note))).toBe(true);
    // The upper over the sink base moved with it, so uppers still match the bases.
    const bridge = result.placed.find((item) => item.wallId === "angTR" && item.placement === "wall" && Math.abs(spanOn(item, room).start - 11.375) < 0.01);
    expect(bridge).toBeTruthy();
    // The basin moved with its base.
    expect(result.sinks[0]?.cabinetUid).toBe(sinkBase.uid);
    expect(cabinetPlanBodiesIntersect(panel, sinkBase)).toBe(false);
    const board = result.placed.find((item) => item.fillerTransitionKind === "front-miter-pair" && item.fillerTransitionNeighborUid === panel.uid);
    expect(board?.wallId).toBe("angTR");
    expect(result.reviewFindings.some((finding) => /top and angTR|angTR and top/.test(finding.title) && finding.code === "angled-base-corner-open")).toBe(false);
  });

  it("closes the corner with the ordinary two-piece pair when the panel clears the miter line", () => {
    const result = build(30, {
      input: {
        layoutType: "u-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
        sink: { wallLabel: "Wall 2", centerOffsetIn: 30 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
        stove: { wallLabel: "Wall 3", centerOffsetIn: 39 },
        refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 },
        dishwasher: { wallLabel: "Wall 1", centerOffsetIn: 110 },
        tallCabinets: null, overRangeAnswer: "open",
        kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      } as AutoDesignInputs,
    });
    const panel = result.placed.find(isDishwasherPanelPlacement)!;
    const pieces = result.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair"
      && (item.fillerForCabinetUid === panel.uid || item.fillerTransitionNeighborUid === panel.uid));
    expect(new Set(pieces.map((piece) => piece.wallId))).toEqual(new Set(["top", "angTR"]));
    expect(result.reviewFindings.some((finding) => /top and angTR|angTR and top/.test(finding.title) && finding.code === "angled-base-corner-open")).toBe(false);
  });

  it("keeps the other angled corners exactly as PR 433 closes them", () => {
    const result = build(30);
    const pairs = (wallA: string, wallB: string, layer: "base" | "wall") => result.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair"
      && item.placement === layer && (item.wallId === wallA || item.wallId === wallB)
      && [wallA, wallB].includes(result.placed.find((other) => other.uid === item.fillerTransitionNeighborUid)?.wallId ?? ""));
    expect(pairs("right", "angBR", "base")).toHaveLength(2);
    expect(pairs("right", "angBR", "wall")).toHaveLength(2);
  });

  it("the Designer's later sync keeps the build's panel (no duplicate, no removal, nothing moved)", () => {
    for (const sinkCenter of [29, 30]) {
      const result = build(sinkCenter);
      const synced = syncDishwasherPanels({ placed: result.placed, room, catalog: PANEL_STOCK });
      expect(synced.placed).toBe(result.placed);
      expect(synced.warnings).toEqual([]);
      expect(synced.placed.filter(isDishwasherPanelPlacement)).toHaveLength(result.placed.filter(isDishwasherPanelPlacement).length);
    }
  });

  it("names a line with no priced dishwasher panel instead of placing one", () => {
    const result = build(30, { dishwasherPanelPriceFor: () => null });
    expect(result.placed.some(isDishwasherPanelPlacement)).toBe(false);
    expect(result.reviewFindings.some((finding) => finding.code === "dishwasher-panel-sku-missing")).toBe(true);
    const noRows = build(30, { panelCatalog: [] });
    expect(noRows.placed.some(isDishwasherPanelPlacement)).toBe(false);
    expect(noRows.reviewFindings.some((finding) => finding.code === "dishwasher-panel-sku-missing")).toBe(true);
  });
});

describe("syncDishwasherPanels 45° wiggle room (Tom, Nov 16, 8:56 AM CT)", () => {
  const room = tomsRoom();
  const row = (code: string, layer: "base" | "wall" | "appliance") => (layer === "appliance"
    ? appliance(code, 24, 24, 34.5)
    : [...BASES, ...WALLS].find((candidate) => candidate.masterCode === code)!);
  const seat = (uid: string, code: string, wallId: string, along: number, layer: "base" | "wall" | "appliance" = "base"): PlacedCabinet => {
    const source = row(code, layer);
    const width = Number(source.width);
    const depth = Number(source.depth);
    return {
      ...(source as unknown as PlacedCabinet), uid, cabinetId: source.id, placement: layer,
      width, depth, height: Number(source.height),
      ...wallPlacementAt(along, width, depth, wallId as WallSide, room), wallId, wallOffset: along,
      mountBottom: layer === "wall" ? 54 : 0,
    } as PlacedCabinet;
  };
  // Dishwasher ending Wall 1 at the 11″ hold (127 of 138).
  const dishwasher = seat("dw", "DW-24", "top", 103, "appliance");
  const leftNeighbor = seat("b-left", "B24", "top", 79);
  const panelOf = (placed: readonly PlacedCabinet[]) => placed.find((item) => item.autoPlacedReason === "dw-forty-five-turn-panel");

  it("no conflict: nothing moves", () => {
    const next = seat("n", "B15", "angTR", 12);
    const plan = syncDishwasherPanels({ placed: [leftNeighbor, dishwasher, next], room, catalog: PANEL_STOCK, angledShiftLimitIn: 3 });
    expect(panelOf(plan.placed)).toBeTruthy();
    expect(plan.moves ?? []).toEqual([]);
    expect(plan.warnings).toEqual([]);
  });

  it("conflict within 3″: the next wall's cabinet (and the one butted behind it, and its upper) slide just far enough", () => {
    const next = seat("n", "B15", "angTR", 11);
    const behind = seat("n2", "B12", "angTR", 26);
    const upper = seat("u", "W-15-30", "angTR", 11, "wall");
    const plan = syncDishwasherPanels({ placed: [leftNeighbor, dishwasher, next, behind, upper], room, catalog: PANEL_STOCK, angledShiftLimitIn: 3 });
    const panel = panelOf(plan.placed)!;
    expect(panel).toBeTruthy();
    expect(plan.warnings).toEqual([]);
    const moved = new Map((plan.moves ?? []).map((move) => [move.uid, move.deltaIn]));
    expect([...moved.keys()].sort()).toEqual(["n", "n2", "u"]);
    const delta = moved.get("n")!;
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(3);
    const after = plan.placed.find((item) => item.uid === "n")!;
    expect(spanOn(after, room).start).toBeCloseTo(11 + delta, 3);
    expect(cabinetPlanBodiesIntersect(panel, after)).toBe(false);
    // One step less would still bump: the slide is the smallest that clears.
    const lessShift = { ...after, ...wallPlacementAt(11 + delta - 0.125, after.width, after.depth, "angTR" as WallSide, room), wallOffset: 11 + delta - 0.125 };
    expect(cabinetPlanBodiesIntersect(panel, lessShift)).toBe(true);
    // The Designer (no wiggle) then keeps it as is.
    const designer = syncDishwasherPanels({ placed: plan.placed, room, catalog: PANEL_STOCK });
    expect(designer.placed).toBe(plan.placed);
  });

  it("conflict needing more than 3″: gives up with a visible warning and moves nothing", () => {
    // A box seated 8″ from the vertex (inside the hold) would have to move ~3⅜″.
    const next = seat("n", "B15", "angTR", 8);
    const plan = syncDishwasherPanels({ placed: [leftNeighbor, dishwasher, next], room, catalog: PANEL_STOCK, angledShiftLimitIn: 3 });
    expect(panelOf(plan.placed)).toBeUndefined();
    expect(plan.moves ?? []).toEqual([]);
    expect(plan.placed.find((item) => item.uid === "n")!.wallOffset).toBe(8);
    expect(plan.warnings.map((warning) => warning.id)).toEqual(["no-room:dw-panel:dw:end"]);
    expect(plan.warnings[0]!.message).toMatch(/could not slide out of the way within the 3" wiggle room/);
  });

  it("a cabinet with no room to slide (run butted to the far end of the wall) gives up with a warning", () => {
    const len = wallLength("angTR" as WallSide, room);
    const next = seat("n", "B36", "angTR", 11);
    const fill: PlacedCabinet[] = [next];
    let at = 47;
    let index = 0;
    while (at + 36 <= len - 0.01) { fill.push(seat(`f${index++}`, "B36", "angTR", at)); at += 36; }
    const lastWidth = len - at;
    const tail = { ...seat("tail", "B12", "angTR", at), width: lastWidth };
    const plan = syncDishwasherPanels({ placed: [leftNeighbor, dishwasher, ...fill, tail], room, catalog: PANEL_STOCK, angledShiftLimitIn: 3 });
    expect(panelOf(plan.placed)).toBeUndefined();
    expect(plan.warnings.some((warning) => warning.id === "no-room:dw-panel:dw:end")).toBe(true);
  });
});

/**
 * Tom, Nov 16 2026 (8:17 AM CT): a filler against a refrigerator panel is the
 * last resort. A cabinet from the live catalog goes beside the panel whenever
 * one fits; only the small leftover no cabinet can take (about 2″, never over
 * the 3″ cap) is closed with a board against the panel.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { runAutoDesignLayout } from "./autoDesignLayout";
import { FRIDGE_PANEL_CORNER_TARGET_IN, fridgePanelCornerSlideOptions, type FridgePanelCornerState } from "./autoDesignFridgeCornerSlide";
import { fillGapsUnderOneAndAHalf } from "./subOneAndHalfFiller";
import { fillerRuleViolation, isAllowedPanelFiller, removeIllegalFillers } from "./fillerPlacementRule";
import {
  isFillerItem,
  isRefrigeratorEndPanel,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
const fillerStock = [{
  id: 3, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler",
  width: "3", height: "34.5", depth: "24", catalogImageUrl: null,
}];

function box(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode" | "width">, along: number, depth = 24): PlacedCabinet {
  const spot = wallPlacementAt(along, partial.width, depth, "top", room);
  return {
    cabinetId: 1, description: partial.masterCode, category: "Base", subCategory: "Base",
    placement: "base", height: 34.5, numberOfDoors: 1, numberOfDrawers: 0,
    ...partial, ...spot, depth, rotation: spot.rotation, wallId: spot.wallId, wallOffset: spot.wallOffset,
  } as PlacedCabinet;
}

function fridgeBay(panelAt: number) {
  const panel = box({
    uid: "panel", masterCode: "REPV2496", width: 0.75, placement: "tall", height: 96,
    refrigeratorAssemblyRole: "left-panel", refrigeratorAssemblyId: "fridge",
    customProfile: "refrigerator-end-panel",
  }, panelAt);
  const fridge = box({ uid: "fridge", masterCode: "FRIDGE-36", width: 36, placement: "appliance", category: "Appliance" }, panelAt + 0.75);
  return { panel, fridge };
}

describe("filler against a refrigerator panel (last resort)", () => {
  it("closes a ~2 in leftover between a cabinet and the panel with a filler and keeps it", () => {
    const cabinet = box({ uid: "cab", masterCode: "B24", width: 24 }, 0);
    const { panel, fridge } = fridgeBay(26);
    const fridgeX = fridge.x;
    const result = fillGapsUnderOneAndAHalf({
      placed: [cabinet, panel, fridge], room, fillers: fillerStock, makeUid: () => "fill-2", styleId: 1,
    });
    const filler = result.placed.find((item) => item.uid === "fill-2");
    expect(filler?.width).toBeCloseTo(2, 2);
    expect(result.placed.find((item) => item.uid === "fridge")?.x).toBe(fridgeX);
    expect(fillerRuleViolation({ filler: filler!, placed: result.placed, room, openings: [] })).toBeNull();
    const kept = removeIllegalFillers({ placed: result.placed, room });
    expect(kept.placed.some((item) => item.uid === "fill-2")).toBe(true);
  });

  it("never boards a gap a cabinet could take, and strips a wide board cut against the panel", () => {
    const cabinet = box({ uid: "cab", masterCode: "B24", width: 24 }, 0);
    const { panel, fridge } = fridgeBay(33); // 9″ open: a 9″ cabinet fits
    const result = fillGapsUnderOneAndAHalf({
      placed: [cabinet, panel, fridge], room, fillers: fillerStock, makeUid: () => "fill-9", styleId: 1,
    });
    expect(result.placed.some((item) => item.uid === "fill-9")).toBe(false);
    const wide = box({ uid: "wide", masterCode: "BF6", width: 4.25, category: "Filler", subCategory: "Filler" }, 28.75);
    expect(isAllowedPanelFiller(wide)).toBe(false);
    const placed = [cabinet, wide, panel, fridge];
    expect(fillerRuleViolation({ filler: wide, placed, room, openings: [] })?.code).toBe("against-refrigerator-panel");
    expect(removeIllegalFillers({ placed, room }).placed.some((item) => item.uid === "wide")).toBe(false);
  });

  it("still fills only under 1.5 in between a refrigerator and its own panel", () => {
    const { panel, fridge } = fridgeBay(10);
    const movedFridge = box({ ...fridge, uid: "fridge" }, 12.75);
    const result = fillGapsUnderOneAndAHalf({
      placed: [panel, movedFridge], room, fillers: fillerStock, makeUid: () => "fill-pf", styleId: 1,
    });
    expect(result.placed.some((item) => item.uid === "fill-pf")).toBe(false);
  });
});

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const BASES = REAL["330011"]!.base as DesignCabinet[];
const WALLS = REAL["330011"]!.wall as DesignCabinet[];
const ACCESSORIES = REAL["330011"]!.accessory as DesignCabinet[];
const FILLERS = ACCESSORIES.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return { id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance", width: String(width), depth: String(depth), height: String(height), placement: "appliance" } as DesignCabinet;
}

/** Tom's angled room (Nov 16 2026): two 45° walls, the fridge on Wall 4 (angR). */
function angledRoom(): RoomData {
  return {
    width: 216, depth: 168, ceilingHeight: 96, openWallPath: true,
    vertices: [
      { id: "v1", x: 0, y: 168 }, { id: "v2", x: 0, y: 48 }, { id: "v3", x: 48, y: 0 },
      { id: "v4", x: 168, y: 0 }, { id: "v5", x: 216, y: 48 }, { id: "v6", x: 216, y: 168 },
    ],
    customWalls: [
      { id: "left", label: "Wall 1", startVertexId: "v1", endVertexId: "v2" },
      { id: "angL", label: "Wall 2", startVertexId: "v2", endVertexId: "v3", lockedAngle: 45 },
      { id: "back", label: "Wall 3", startVertexId: "v3", endVertexId: "v4" },
      { id: "angR", label: "Wall 4", startVertexId: "v4", endVertexId: "v5", lockedAngle: 45 },
      { id: "right", label: "Wall 5", startVertexId: "v5", endVertexId: "v6" },
    ],
  } as RoomData;
}

function buildAngled() {
  const r = angledRoom();
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "u-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 3", centerOffsetIn: 60 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 1", centerOffsetIn: 60 },
      refrigerator: { wallLabel: "Wall 4", centerOffsetIn: 34 },
      dishwasher: null, skipDishwasher: true, tallCabinets: null,
      overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    } as never,
    room: r, openings: [], baseCatalog: BASES, wallCatalog: WALLS, fillers: FILLERS,
    appliancePalette: [appliance("RANGE-30", 30, 25, 36), appliance("FRIDGE-36", 36, 30, 70), appliance("OTR-30", 30, 15, 17)],
    refrigeratorCaps: WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
    refrigeratorEndPanels: ACCESSORIES.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`)),
    styleId: 330011, makeUid: () => `u${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  const span = (item: PlacedCabinet) => {
    const start = wallRunOffset(item, item.wallId!, r);
    return { start, end: start + wallRunSpan(item, item.wallId!, r) };
  };
  return { room: r, result, span };
}

describe("angled fridge corner (back ↔ angR, Tom's room)", () => {
  const { result, span } = buildAngled();
  const onAngR = result.placed.filter((item) => item.wallId === "angR");
  const panel = onAngR
    .filter((item) => isRefrigeratorEndPanel(item))
    .sort((left, right) => span(left).start - span(right).start)[0]!;

  it("seats a live-catalog upper beside the panel and closes the upper corner cabinet-to-cabinet", () => {
    const upper = onAngR.find((item) => item.placement === "wall" && !isFillerItem(item)
      && Math.abs(span(item).end - span(panel).start) < 0.05);
    expect(upper).toBeDefined();
    expect(WALLS.some((row) => row.masterCode === upper!.masterCode)).toBe(true);
    // No straight board against the panel in the uppers: the cabinet took the space.
    expect(onAngR.some((item) => item.placement === "wall" && isFillerItem(item) && !item.fillerTransitionKind
      && Math.abs(span(item).end - span(panel).start) < 0.05)).toBe(false);
    const pair = result.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair" && item.placement === "wall"
      && (item.fillerForCabinetUid === upper!.uid || item.fillerTransitionNeighborUid === upper!.uid));
    expect(pair).toHaveLength(2);
  });

  it("closes the base corner with the miter pair against the panel when no base fits", () => {
    const pair = result.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair" && item.placement === "base"
      && (item.fillerTransitionNeighborUid === panel.uid || item.fillerForCabinetUid === panel.uid));
    expect(pair).toHaveLength(1);
    const panelSide = result.placed.find((item) => item.fillerTransitionKind === "front-miter-pair" && item.wallId === "angR" && item.placement === "base");
    expect(panelSide).toBeDefined();
    expect(Math.abs(span(panelSide!).end - span(panel).start)).toBeLessThan(0.05);
    expect(FILLERS.some((row) => row.masterCode === panelSide!.masterCode)).toBe(true);
  });

  it("drops both angled-corner-open warnings and keeps the other two corners closed", () => {
    const codes = (result.reviewFindings ?? []).map((finding) => finding.code);
    expect(codes).not.toContain("angled-upper-corner-open");
    expect(codes).not.toContain("angled-base-corner-open");
    const miters = result.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair");
    expect(miters.filter((item) => item.placement === "base")).toHaveLength(6);
    expect(miters.filter((item) => item.placement === "wall")).toHaveLength(6);
  });
});

describe("wiggle room before a wide fridge-panel corner filler (Tom, Nov 16 8:41 AM CT)", () => {
  const { result, span } = buildAngled();
  const onAngR = result.placed.filter((item) => item.wallId === "angR");
  const fridge = onAngR.find((item) => item.masterCode === "FRIDGE-36")!;
  const panel = onAngR.filter((item) => isRefrigeratorEndPanel(item)).sort((left, right) => span(left).start - span(right).start)[0]!;
  const piece = onAngR.find((item) => item.fillerTransitionKind === "front-miter-pair" && item.placement === "base")!;

  it("slides the refrigerator the most it can without losing the upper beside the panel, and says why", () => {
    // Measured at center 34 (16 → 52). The upper beside the panel (W0930) still
    // fits only up to a ¼″ slide toward the corner; a longer slide opens the
    // upper corner, and a slide away runs into the far corner clearance.
    expect(span(fridge).start).toBeCloseTo(15.75, 2);
    expect(span(panel).start).toBeCloseTo(14.5, 2);
    expect(piece.width).toBeCloseTo(4.56, 2);
    expect(Math.abs(span(piece).end - span(panel).start)).toBeLessThan(0.05);
    const upper = onAngR.find((item) => item.placement === "wall" && !isFillerItem(item) && Math.abs(span(item).end - span(panel).start) < 0.05);
    expect(upper?.masterCode).toBe("W0930");
    expect(result.notes.some((note) => /refrigerator slid 0\.25″ toward the 45° corner/.test(note))).toBe(true);
  });

  it("leaves the cabinets on the other wall alone: the miter line is fixed by the corner", () => {
    const back = result.placed.filter((item) => item.wallId === "back" && item.placement === "base" && !isFillerItem(item));
    const last = back.sort((left, right) => span(right).end - span(left).end)[0]!;
    expect(last.masterCode).toBe("B12");
    expect(span(last).start).toBeCloseTo(97, 2);
    expect(span(last).end).toBeCloseTo(109, 2);
  });
});

describe("fridgePanelCornerSlideOptions", () => {
  const panel = { uid: "p", masterCode: "REPV2496", width: 0.75, depth: 24, height: 96, placement: "tall" } as PlacedCabinet;
  const state = (over: Partial<FridgePanelCornerState>): FridgePanelCornerState => ({
    vertexKey: "v", wallId: "w", neighborWallId: "n", panel, panelGapIn: 14.75,
    basePiece: { uid: "f", width: 4.81, placement: "base", fillerTransitionKind: "front-miter-pair" } as PlacedCabinet,
    baseCabinetBesidePanel: null, upperBesidePanel: null, ...over,
  });

  it("asks for a cabinet first when the smallest base fits inside the wiggle cap", () => {
    const options = fridgePanelCornerSlideOptions(state({}), { smallestBaseWidthIn: 6, capIn: 3 });
    expect(options[0]).toEqual({ panelDeltaIn: 2.25, goal: "cabinet" });
    expect(options[1]).toEqual({ panelDeltaIn: -2.75, goal: "smaller-filler" });
  });

  it("never asks for a slide past the cap, and stops at about 2 in", () => {
    const options = fridgePanelCornerSlideOptions(state({}), { smallestBaseWidthIn: 12, capIn: 3 });
    expect(options.every((option) => option.goal === "smaller-filler")).toBe(true);
    expect(Math.min(...options.map((option) => option.panelDeltaIn))).toBeGreaterThanOrEqual(-(4.81 - FRIDGE_PANEL_CORNER_TARGET_IN));
  });

  it("only offers slides that still fit a stock upper beside the panel", () => {
    const upper = { uid: "u", masterCode: "W0930", width: 9, depth: 12, height: 30, placement: "wall" } as PlacedCabinet;
    const options = fridgePanelCornerSlideOptions(state({ upperBesidePanel: upper }), { smallestBaseWidthIn: 12, capIn: 3, upperWidthsIn: [9, 12, 15] });
    expect(options.map((option) => option.panelDeltaIn)).toEqual([-0.25, -0.125]);
  });

  it("does nothing when the board is already about 2 in or there is none", () => {
    expect(fridgePanelCornerSlideOptions(state({ basePiece: { uid: "f", width: 2, placement: "base" } as PlacedCabinet }), { smallestBaseWidthIn: 6, capIn: 3 })).toEqual([]);
    expect(fridgePanelCornerSlideOptions(state({ basePiece: null }), { smallestBaseWidthIn: 6, capIn: 3 })).toEqual([]);
  });
});

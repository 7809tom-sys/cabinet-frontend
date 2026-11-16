/**
 * Tom, Nov 16 2026 (voice go 4:38 PM CT): at a 45° corner a base-height
 * dishwasher joins the corner like a base cabinet, carries its panel in the
 * corner construction, and moves only as far as needed (and says so) when it
 * was measured inside the corner's filler space. No bare strip is left.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { measuredAngledWallTransition } from "./angledWallFiller";
import {
  DISHWASHER_PANEL_FORTY_FIVE_FRONT_MITER_IN,
  isDishwasherItem,
  isDishwasherPanelPlacement,
  syncDishwasherPanels,
} from "./dishwasherPanelRule";
import {
  wallLength,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
  type WallSide,
} from "./design";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const STYLE = "330011";
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const ACCESSORIES = REAL[STYLE]!.accessory as DesignCabinet[];
const FILLERS = ACCESSORIES.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));
const DWR = ACCESSORIES.filter((row) => /DWR|dishwasher return/i.test(`${row.masterCode} ${row.description}`));

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

/** Tom's five-wall kitchen: fridge wall, 45° sink wall, range wall, 45° wall, last wall. */
function tomsFiveWallRoom(): RoomData {
  const L = 138;
  return {
    width: 204, depth: 210, ceilingHeight: 96, openWallPath: true,
    vertices: [
      { id: "v1", x: 0, y: 0 }, { id: "v2", x: L, y: 0 }, { id: "v3", x: L + 66, y: 66 },
      { id: "v4", x: L + 66, y: 144 }, { id: "v5", x: L, y: 210 }, { id: "v6", x: 40, y: 210 },
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

const sinkWindow: WallOpening = { uid: "tom-sink-window", kind: "window", label: "Window 36\"", side: "angTR", offset: 20, width: 36, height: 42, sill: 42 };

function input(extra: Partial<AutoDesignInputs> = {}): AutoDesignInputs {
  return {
    layoutType: "u-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 2", centerOffsetIn: 36 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 3", centerOffsetIn: 39 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 },
    // The dishwasher measured at the sink/range 45° corner: it ends 8⅞″ from the vertex.
    dishwasher: { wallLabel: "Wall 2", centerOffsetIn: 70.34 }, dishwasherSide: "right", skipDishwasher: false,
    tallCabinets: null, overRangeAnswer: "open", kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    ...extra,
  } as AutoDesignInputs;
}

function build(room: RoomData, inputs: AutoDesignInputs, withDishwasher = true): AutoDesignLayoutSuccess {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: inputs, room, openings: [sinkWindow], baseCatalog: BASES, wallCatalog: WALLS, fillers: [...FILLERS, ...DWR],
    appliancePalette: [appliance("RANGE-30", 30, 25, 36), ...(withDishwasher ? [appliance("DW-24", 24, 24, 34.5)] : []), appliance("FRIDGE-36", 36, 30, 70)],
    refrigeratorCaps: WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
    refrigeratorEndPanels: ACCESSORIES.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`)),
    panelCatalog: ACCESSORIES.filter((row) => /end panel|DWR|WEP|BEP/i.test(`${row.masterCode} ${row.description}`)),
    styleId: Number(STYLE), makeUid: () => `dw45-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

const span = (item: PlacedCabinet, room: RoomData) => {
  const start = wallRunOffset(item, item.wallId!, room);
  return { start, end: start + wallRunSpan(item, item.wallId!, room) };
};

function expectClosedDishwasherCorner(result: AutoDesignLayoutSuccess, room: RoomData) {
  const len = wallLength("angTR" as WallSide, room);
  const dishwasher = result.placed.find(isDishwasherItem)!;
  const dw = span(dishwasher, room);
  // Moved 3″ (the smallest move that tiles exactly: B12 → BT9), ending 11⅞″ from the corner.
  expect(dw.end).toBeCloseTo(81.5, 2);
  expect(len - dw.end).toBeCloseTo(11.84, 1);
  const between = result.placed.filter((item) => item.wallId === "angTR" && item.placement === "base" && !item.fillerTransitionKind
    && span(item, room).start >= 48.4 && span(item, room).end <= dw.start + 0.05);
  expect(between.map((item) => item.masterCode)).toEqual(["BT9"]);
  expect(span(between[0]!, room).end).toBeCloseTo(dw.start, 2); // no bare strip
  // The panel sits on the dishwasher's corner end, cut to the front miter line.
  const panel = result.placed.find(isDishwasherPanelPlacement)!;
  expect(panel).toBeTruthy();
  expect(panel.wallId).toBe("angTR");
  expect(span(panel, room).start).toBeCloseTo(dw.end, 2);
  expect(len - span(panel, room).end).toBeCloseTo(DISHWASHER_PANEL_FORTY_FIVE_FRONT_MITER_IN, 2);
  expect(panel.width).toBeLessThan(3);
  // One 22.5° board from the range-wall cabinet meets the panel at the miter point.
  const boards = result.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair" && item.fillerTransitionNeighborUid === panel.uid);
  expect(boards).toHaveLength(1);
  expect(boards[0]!.wallId).toBe("right");
  expect(boards[0]!.fillerMiterAngle).toBe(22.5);
  expect(span(boards[0]!, room).start).toBeCloseTo(DISHWASHER_PANEL_FORTY_FIVE_FRONT_MITER_IN, 2);
  // Nothing reports this corner open, and the move is on the report with its reason.
  expect(result.reviewFindings.some((f) => f.code === "angled-base-corner-open" && /angTR/.test(f.title) && /right/.test(f.title))).toBe(false);
  const moved = result.reviewFindings.find((f) => f.code === "dishwasher-moved-for-45-corner");
  expect(moved?.title).toMatch(/moved 3/);
  expect(moved?.detail).toMatch(/8⅞/);
  // The Designer's own panel sync re-derives the same panel (stable on reload).
  const sync = syncDishwasherPanels({ placed: result.placed, room, catalog: DWR.map((row) => ({ ...row, price: 100 })) });
  expect(sync.placed).toBe(result.placed);
  expect(sync.warnings).toEqual([]);
}

describe("dishwasher at a 45° corner (Tom, Nov 16 2026)", () => {
  it("a base-height dishwasher is measured as a base for the 45° pair", () => {
    const room = tomsFiveWallRoom();
    const along = 93.34 - 11.84 - 24;
    const spot = wallPlacementAt(along, 24, 24, "angTR" as WallSide, room);
    const dishwasher = { uid: "dw", masterCode: "DW-24", description: "DW-24", category: "Appliance", subCategory: "Appliance", placement: "appliance", applianceRole: "base-height", ...spot, width: 24, depth: 24, height: 34.5, mountBottom: 0 } as PlacedCabinet;
    const neighborSpot = wallPlacementAt(11.75, 12, 24, "right" as WallSide, room);
    const neighbor = { uid: "b12", masterCode: "B12", description: "B12", category: "Base", subCategory: "Base", placement: "base", ...neighborSpot, width: 12, depth: 24, height: 34.5, mountBottom: 0 } as PlacedCabinet;
    const measured = measuredAngledWallTransition(dishwasher, room, [dishwasher, neighbor]);
    expect(measured?.neighborUid).toBe("b12");
    expect(measured?.ownerFrontCutIn).toBeGreaterThan(0.5);
  });

  it("closes Tom's five-wall corner with the panel and one miter board, no setup answers", () => {
    const room = tomsFiveWallRoom();
    expectClosedDishwasherCorner(build(room, input()), room);
  });

  it("closes the same corner when the setup answers are passed", () => {
    const room = tomsFiveWallRoom();
    expectClosedDishwasherCorner(build(room, input({ intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: ["glass-uppers", "dishwasher"] } as never })), room);
  });

  it("falls back to the ordinary 22.5° pair against the dishwasher when the line sells no dishwasher panel", () => {
    const room = tomsFiveWallRoom();
    let uid = 0;
    const noDwr = ACCESSORIES.filter((row) => !/DWR|dishwasher/i.test(`${row.masterCode} ${row.description}`));
    const result = runAutoDesignLayout({
      input: input(), room, openings: [sinkWindow], baseCatalog: BASES, wallCatalog: WALLS, fillers: FILLERS,
      appliancePalette: [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70)],
      refrigeratorCaps: WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
      refrigeratorEndPanels: noDwr.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`)),
      panelCatalog: noDwr.filter((row) => /end panel|WEP|BEP/i.test(`${row.masterCode} ${row.description}`)),
      styleId: Number(STYLE), makeUid: () => `nodwr-${++uid}`,
    });
    if (!result.ok) throw new Error(result.message);
    const dishwasher = result.placed.find(isDishwasherItem)!;
    expect(result.placed.some(isDishwasherPanelPlacement)).toBe(false);
    const pair = result.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair"
      && [item.fillerForCabinetUid, item.fillerTransitionNeighborUid].includes(dishwasher.uid));
    expect(pair).toHaveLength(2);
    expect(result.reviewFindings.some((f) => f.code === "dishwasher-panel-sku-missing")).toBe(true);
    expect(result.reviewFindings.some((f) => f.code === "angled-base-corner-open" && /angTR/.test(f.title) && /right/.test(f.title))).toBe(false);
  });

  it("leaves a build without a dishwasher alone", () => {
    const room = tomsFiveWallRoom();
    const result = build(room, input({ skipDishwasher: true, dishwasherSide: "none", dishwasher: undefined }), false);
    expect(result.placed.some(isDishwasherPanelPlacement)).toBe(false);
    expect(result.reviewFindings.some((f) => f.ruleId === "dishwasher-forty-five-corner")).toBe(false);
  });
});

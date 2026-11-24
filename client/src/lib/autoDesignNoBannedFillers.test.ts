/**
 * PERMANENT / HIGH-PRIORITY rule (Tom, owner voice, Nov 24 2026, 11:58 AM CT): fluted fillers and
 * BFF fillers are never used in any generated Auto Design plan. Line 330011 sells BFF3, BFF6,
 * WFF342, WFF396 and WFF642 next to the plain F342 / F396 / F642 / BF6 boards, so every plan here
 * would have picked a BFF before the ban. Each plan must contain zero BFF, WFF or "fluted" pieces.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { enforceAutoDesignFillerBan, isBannedPlacedAutoDesignFiller } from "./autoDesignBannedFillerGuard";
import { catalogFillerForGap, isBannedAutoDesignFiller } from "./catalogFiller";
import { appliancesForRoom, applianceAsDesignCabinet, isFillerItem, wallPlacementAt, type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening } from "./design";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] };
const PACK = (realCatalog as unknown as Record<string, Pack>)["330011"]!;

const banned = (item: { masterCode?: string | null; description?: string | null }) =>
  /^(?:BFF|WFF)/i.test(String(item.masterCode ?? "")) || /\bfluted\b/i.test(String(item.description ?? ""));

function rectRoom(width: number, depth: number): RoomData {
  return { width, depth, ceilingHeight: 96 } as RoomData;
}

/** Tom's five-wall kitchen with two 45° walls (same room as autoDesignFortyFiveCornerFillers.test.ts). */
function fiveWallRoom(): RoomData {
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

function intake(budget: boolean) {
  return {
    ...emptyAutoDesignIntake(), construction: "new", preferences: budget ? ["budget-friendly"] : [], islandOrPeninsula: "none",
    canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true },
  };
}

function buildDemo(opts: { room: RoomData; openings?: WallOpening[]; budget?: boolean; input: Record<string, unknown> }): AutoDesignLayoutSuccess {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      sinkBaseWidthIn: 36, sinkBaseKind: "regular", dishwasherSide: "right", skipDishwasher: false,
      overRangeAnswer: "microwave-bridge", kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: intake(Boolean(opts.budget)),
      ...opts.input,
    } as never,
    room: opts.room, openings: opts.openings ?? [], baseCatalog: PACK.base, wallCatalog: PACK.wall, fillers: PACK.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(PACK.wall, []),
    refrigeratorEndPanels: PACK.accessory.filter((row) => /^REP/.test(row.masterCode)),
    tallCatalog: [], panelCatalog: PACK.accessory,
    styleId: 330011, makeUid: () => `ban-${++uid}`,
  } as never);
  if (!result.ok) throw new Error(result.message);
  return result;
}

const sinkWindow45: WallOpening = {
  uid: "w45", kind: "window", label: "Window 36\"", side: "angTR", offset: 20, width: 36, height: 42, sill: 42,
} as WallOpening;

const DEMO_PLANS: Record<string, () => AutoDesignLayoutSuccess> = {
  "L 144x120 standard (blind corner)": () => buildDemo({ room: rectRoom(144, 120), input: {
    layoutType: "l-shape", refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
    stove: { wallLabel: "Wall 1", centerOffsetIn: 72 }, sink: { wallLabel: "Wall 2", centerOffsetIn: 72 } } }),
  "L 144x120 budget (economy corner)": () => buildDemo({ room: rectRoom(144, 120), budget: true, input: {
    layoutType: "l-shape", refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
    stove: { wallLabel: "Wall 1", centerOffsetIn: 75 }, sink: { wallLabel: "Wall 2", centerOffsetIn: 70 } } }),
  "U 144x120 standard": () => buildDemo({ room: rectRoom(144, 120), input: {
    layoutType: "u-shape", refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 108 }, refrigeratorWidthIn: 36,
    stove: { wallLabel: "Wall 2", centerOffsetIn: 60 }, sink: { wallLabel: "Wall 3", centerOffsetIn: 60 } } }),
  "five-wall 45° U standard (sink on 45° wall, DW toward the corner)": () => buildDemo({ room: fiveWallRoom(), openings: [sinkWindow45], input: {
    layoutType: "u-shape", sink: { wallLabel: "Wall 2", centerOffsetIn: 36 }, stove: { wallLabel: "Wall 3", centerOffsetIn: 39 },
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, dishwasher: { wallLabel: "Wall 2", centerOffsetIn: 70.34 } } }),
  "five-wall 45° U budget": () => buildDemo({ room: fiveWallRoom(), openings: [sinkWindow45], budget: true, input: {
    layoutType: "u-shape", sink: { wallLabel: "Wall 2", centerOffsetIn: 36 }, stove: { wallLabel: "Wall 3", centerOffsetIn: 39 },
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, dishwasher: { wallLabel: "Wall 2", centerOffsetIn: 70.34 } } }),
};

describe("no BFF or fluted filler in any generated plan (Tom, owner voice, Nov 24 2026, 11:58 AM CT)", () => {
  it("the predicate bans BFF, WFF, fluted descriptions and overlays, and keeps the plain boards", () => {
    for (const code of ["BFF3", "BFF6", "WFF342", "WFF396", "WFF642"]) expect(isBannedAutoDesignFiller({ masterCode: code })).toBe(true);
    expect(isBannedAutoDesignFiller({ masterCode: "X9", description: "6\" x 30\" Fluted Filler" })).toBe(true);
    expect(isBannedAutoDesignFiller({ masterCode: "FOL630", description: "Filler Overlay" })).toBe(true);
    for (const code of ["F342", "F396", "F642", "BF6", "BF-3", "WF342"]) expect(isBannedAutoDesignFiller({ masterCode: code, description: "Filler" })).toBe(false);
  });

  it("the shared picker gives 330011's plain boards: F342 at 3 in (base and wall), BF6 at 6 in base, F642 at 6 in wall", () => {
    expect(catalogFillerForGap(PACK.accessory, 3, "base")?.masterCode).toBe("F342");
    expect(catalogFillerForGap(PACK.accessory, 1.75, "base")?.masterCode).toBe("F342");
    expect(catalogFillerForGap(PACK.accessory, 3, "wall")?.masterCode).toBe("F342");
    expect(catalogFillerForGap(PACK.accessory, 6, "base")?.masterCode).toBe("BF6");
    expect(catalogFillerForGap(PACK.accessory, 6, "wall")?.masterCode).toBe("F642");
  });

  it.each(Object.keys(DEMO_PLANS))("%s: zero BFF / WFF / fluted pieces and no note naming one", (name) => {
    const plan = DEMO_PLANS[name]!();
    const hits = plan.placed.filter(banned);
    expect(hits.map((item) => `${item.masterCode} ${item.wallId}`)).toEqual([]);
    expect(plan.notes.filter((note) => /\b(?:BFF|WFF)\d/.test(note) && !/^No fluted or BFF fillers/.test(note))).toEqual([]);
    // Fillers are still placed where the plan needs them, as plain boards.
    expect(plan.placed.some((item) => isFillerItem(item) || /^(?:F|BF)\d/.test(item.masterCode))).toBe(true);
  }, 60_000);

  it("the end-of-generation guard swaps a slipped BFF/WFF for the plain board, keeps its spot and miter, and keeps manual pieces", () => {
    const room = rectRoom(144, 120);
    const bff = PACK.accessory.find((row) => row.masterCode === "BFF3")!;
    const wff = PACK.accessory.find((row) => row.masterCode === "WFF342")!;
    const slipped = (uid: string, row: DesignCabinet, placement: "base" | "wall", along: number, extra: Partial<PlacedCabinet> = {}) => ({
      uid, cabinetId: row.id, masterCode: row.masterCode, description: row.description, category: row.category, subCategory: row.subCategory,
      placement, ...wallPlacementAt(along, 1.75, placement === "wall" ? 12 : 24, "top", room), width: 1.75, depth: 24, height: 34.5,
      fillerPieceGroupId: `g-${uid}`, ...extra,
    } as PlacedCabinet);
    const placed = [
      slipped("a", bff, "base", 10, { description: `${bff.masterCode} — A front filler cut to 1-3/4" with 22.5° miter (forms 45° turn)`, fillerTransitionStockWidthIn: 3 } as Partial<PlacedCabinet>),
      slipped("b", wff, "wall", 40),
      slipped("manual", bff, "base", 80),
    ];
    const out = enforceAutoDesignFillerBan(placed, PACK.accessory, new Set(["manual"]));
    const byUid = new Map(out.placed.map((item) => [item.uid, item]));
    expect(byUid.get("a")!.masterCode).toBe("F342");
    expect(byUid.get("a")!.description).toMatch(/F342 .*22\.5° miter/);
    expect(byUid.get("a")!.x).toBe(placed[0]!.x);
    expect(byUid.get("b")!.masterCode).toBe("F342");
    expect(byUid.get("manual")!.masterCode).toBe("BFF3");
    expect(out.notes).toHaveLength(2);
    expect(out.placed.filter((item) => item.uid !== "manual").some(isBannedPlacedAutoDesignFiller)).toBe(false);
  });

  it("drops a banned piece with a note when the line sells no plain filler", () => {
    const room = rectRoom(144, 120);
    const onlyBanned = PACK.accessory.filter((row) => /^(?:BFF|WFF)/.test(row.masterCode));
    const piece = { uid: "x", cabinetId: 1, masterCode: "BFF3", description: "Fluted Base Filler", category: "Filler", subCategory: "Filler",
      placement: "base", ...wallPlacementAt(10, 3, 24, "top", room), width: 3, depth: 24, height: 34.5, fillerPieceGroupId: "g" } as PlacedCabinet;
    const out = enforceAutoDesignFillerBan([piece], onlyBanned);
    expect(out.placed).toEqual([]);
    expect(out.dropped).toEqual([{ uid: "x", masterCode: "BFF3" }]);
    expect(out.notes[0]).toMatch(/removed .*left open for review/);
  });
});

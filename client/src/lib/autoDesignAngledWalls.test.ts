/**
 * Issue 312: a 45° wall is a real run, and a corner cabinet is only for a true
 * 90° corner. Issue 313: ordinary fillers are not stacked; a run closes with
 * stock widths and at most one board per end. The angled miter pair stays.
 */
import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout } from "./autoDesignLayout";
import {
  cabinetWall,
  isCornerCabinet,
  isFillerItem,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";

type StylePack = {
  base: DesignCabinet[];
  wall: DesignCabinet[];
  accessory: DesignCabinet[];
  surround: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] };
};

const catalog = catalogFixture as unknown as Record<string, StylePack>;
const STYLE = "330014";

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

const PALETTE = [
  appliance("RANGE-30", 30, 25, 36),
  appliance("DW-24", 24, 24, 34.5),
  appliance("FRIDGE-36", 36, 30, 70),
];

/** Straight run meeting a 45° wall. No 90° corner anywhere in the kitchen. */
function angledRoom(): RoomData {
  return {
    width: 220,
    depth: 140,
    ceilingHeight: 96,
    openWallPath: true,
    vertices: [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 144, y: 0 },
      { id: "c", x: 204, y: 60 },
    ],
    customWalls: [
      { id: "straight", label: "Wall 1", startVertexId: "a", endVertexId: "b" },
      { id: "angled", label: "Wall 2", startVertexId: "b", endVertexId: "c", lockedAngle: 45 },
    ],
  } as RoomData;
}

const FILLER_STOCK = [
  { id: 9001, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: "3", height: "34.5", depth: "24", placement: "accessory" },
  { id: 9002, masterCode: "WF3", description: '3" Wall Filler', category: "Filler", subCategory: "Filler", width: "3", height: "30", depth: "12", placement: "accessory" },
] as unknown as DesignCabinet[];

function build(room: RoomData, layout: "l-shape" | "u-shape", sinkCenter: number, rangeCenter: number, rangeWall: "Wall 1" | "Wall 2" = "Wall 1") {
  const pack = catalog[STYLE]!;
  let uid = 0;
  return runAutoDesignLayout({
    input: {
      layoutType: layout, originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: sinkCenter }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: rangeWall, centerOffsetIn: rangeCenter },
      dishwasher: null, skipDishwasher: true,
      refrigerator: null,
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    },
    room, openings: [],
    baseCatalog: pack.base, wallCatalog: pack.wall,
    fillers: [...pack.accessory, ...FILLER_STOCK],
    appliancePalette: PALETTE,
    refrigeratorCaps: pack.surround.deepAbove ?? [],
    refrigeratorEndPanels: pack.surround.endPanels ?? [],
    styleId: Number(STYLE), makeUid: () => `angled-${++uid}`,
  });
}

function isCornerPiece(item: PlacedCabinet): boolean {
  return isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null);
}

function coveredBases(placed: readonly PlacedCabinet[], room: RoomData, wallId: string): number {
  return placed
    .filter((item) => item.placement === "base" && !isFillerItem(item) && !isCornerPiece(item) && cabinetWall(item, room) === wallId)
    .reduce((sum, item) => sum + item.width, 0);
}

describe("Auto-Design on a 45° wall (issues 312 and 313)", () => {
  it("fills the angled wall with straight cabinets and does not invent a corner cabinet", () => {
    const room = angledRoom();
    const result = build(room, "l-shape", 36, 78);
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.seatedCorners).toEqual([]);
    expect(result.placed.filter(isCornerPiece).map((item) => item.masterCode)).toEqual([]);
    expect(result.cornerSlots).toEqual([]);
    // The diagonal run is cabineted, not left empty. The 11" hold at the join
    // stays clear for the angled filler.
    expect(coveredBases(result.placed, room, "angled")).toBeGreaterThan(36);
    // The range wall beside the angle is filled past the range, not left bare.
    expect(coveredBases(result.placed, room, "straight")).toBeGreaterThan(60);
    const miters = result.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair");
    expect(miters.length).toBeGreaterThanOrEqual(2);
    expect(miters.every((item) => item.fillerMiterAngle === 22.5)).toBe(true);
  });

  it("does not stack ordinary fillers on the angled kitchen", () => {
    const room = angledRoom();
    const result = build(room, "l-shape", 36, 78);
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    const ordinary = result.placed.filter((item) => isFillerItem(item)
      && item.fillerTransitionKind == null
      && item.integratedWallBlindFiller !== true);
    const groups = new Map<string, PlacedCabinet[]>();
    for (const filler of ordinary) {
      const wall = cabinetWall(filler, room);
      const key = `${wall}/${filler.placement}`;
      groups.set(key, [...(groups.get(key) ?? []), filler]);
    }
    for (const [key, fillers] of groups) {
      expect(fillers.length, key).toBeLessThanOrEqual(2);
      const spans = fillers
        .map((item) => {
          const wall = cabinetWall(item, room);
          const start = wallRunOffset(item, wall, room);
          return { start, end: start + wallRunSpan(item, wall, room) };
        })
        .sort((left, right) => left.start - right.start);
      for (let index = 1; index < spans.length; index += 1) {
        expect(spans[index]!.start - spans[index - 1]!.end, key).toBeGreaterThan(1);
      }
    }
  });

  it("still seats a corner cabinet when the walls meet at 90 degrees", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
    // Range on the return wall, clear of the corner, so the 90° corner can take a cabinet.
    const result = build(room, "l-shape", 72, 60, "Wall 2");
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.seatedCorners.length).toBeGreaterThan(0);
    expect(result.placed.some(isCornerPiece)).toBe(true);
    expect(result.placed.some((item) => item.fillerTransitionKind === "front-miter-pair")).toBe(false);
  });
});

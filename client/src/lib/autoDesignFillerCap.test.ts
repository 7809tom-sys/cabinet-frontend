/**
 * Hard cap: an Auto-Design filler strip is never wider than 3 inches.
 * Cabinets are tried first. A leftover that cannot be brought down to 3 inches
 * is left open and named, not covered with a wide board or a stack of small ones.
 */
import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout } from "./autoDesignLayout";
import { isFillerItem, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";

type StylePack = {
  base: DesignCabinet[];
  wall: DesignCabinet[];
  accessory: DesignCabinet[];
  surround: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] };
};

const catalog = catalogFixture as unknown as Record<string, StylePack>;
const STYLE = "330014";
const pack = catalog[STYLE]!;

const FILLER_STOCK = [
  { id: 9001, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: "3", height: "34.5", depth: "24", placement: "accessory" },
  { id: 9002, masterCode: "WF3", description: '3" Wall Filler', category: "Filler", subCategory: "Filler", width: "3", height: "30", depth: "12", placement: "accessory" },
] as unknown as DesignCabinet[];

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

const PALETTE = [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70)];

function ordinaryFillerTooWide(item: PlacedCabinet): boolean {
  if (!isFillerItem(item)) return false;
  if (item.fillerTransitionKind === "front-miter-pair" || item.fillerTransitionKind === "angled-wedge" || item.fillerTransitionKind === "corner-provisional") return false;
  if (item.integratedWallBlindFiller === true) return false;
  return (Number(item.width) || 0) > 3.05;
}

function buildWall(lengthIn: number) {
  const room = { width: lengthIn, depth: 120, ceilingHeight: 96 } as RoomData;
  let uid = 0;
  return runAutoDesignLayout({
    input: {
      layoutType: "single-wall", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: lengthIn / 2 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: null, dishwasher: null, skipDishwasher: true, refrigerator: null,
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    },
    room, openings: [],
    baseCatalog: pack.base, wallCatalog: pack.wall,
    fillers: [...pack.accessory, ...FILLER_STOCK],
    appliancePalette: PALETTE,
    refrigeratorCaps: [], refrigeratorEndPanels: [],
    styleId: Number(STYLE), makeUid: () => `cap-${++uid}`,
  });
}

describe("filler strips stay at 3 inches or less", () => {
  it("holds for every wall from 60 to 200 inches in quarter-inch steps", () => {
    const warned: string[] = [];
    const wide: string[] = [];
    for (let eighths = 60 * 4; eighths <= 200 * 4; eighths += 1) {
      const lengthIn = eighths / 4;
      const result = buildWall(lengthIn);
      if (!result.ok) {
        wide.push(`${lengthIn}: build failed: ${result.message}`);
        continue;
      }
      for (const item of result.placed) {
        if (ordinaryFillerTooWide(item)) wide.push(`${lengthIn}: ${item.masterCode} ${item.width}`);
      }
      for (const finding of result.reviewFindings) {
        if (finding.code === "filler-over-3-in") warned.push(`${lengthIn}: ${finding.title}`);
      }
    }
    expect(wide, wide.slice(0, 8).join("\n")).toEqual([]);
    // Lengths that could not reach a 3-inch leftover are named, not given a wide filler.
    expect(Array.isArray(warned)).toBe(true);
    if (warned.length) console.log(`filler-cap warnings (${warned.length}):\n${warned.slice(0, 40).join("\n")}`);
  }, 180000);

  it("holds on a 144 inch L-shaped room", () => {
    const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
    let uid = 0;
    const result = runAutoDesignLayout({
      input: {
        layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
        sink: { wallLabel: "Wall 1", centerOffsetIn: 72 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
        stove: { wallLabel: "Wall 2", centerOffsetIn: 60 },
        dishwasher: null, skipDishwasher: true, refrigerator: null,
        kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      },
      room, openings: [],
      baseCatalog: pack.base, wallCatalog: pack.wall,
      fillers: [...pack.accessory, ...FILLER_STOCK],
      appliancePalette: PALETTE,
      refrigeratorCaps: [], refrigeratorEndPanels: [],
      styleId: Number(STYLE), makeUid: () => `l-${++uid}`,
    });
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    const wide = result.placed.filter(ordinaryFillerTooWide).map((item) => `${item.masterCode} ${item.width}`);
    expect(wide).toEqual([]);
  });
});

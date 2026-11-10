/**
 * Owner rule, measured on a real Auto-Design build: one filler per run, closing
 * a front-face gap only, and never a board on a refrigerator end panel.
 */
import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "./autoDesignLayout";
import { fillerRuleViolation } from "./fillerPlacementRule";
import {
  cabinetWall,
  isFillerItem,
  isRefrigeratorEndPanel,
  wallRunOffset,
  wallRunSpan,
  type AutoDesignLayoutType,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";

type StylePack = {
  name: string;
  base: DesignCabinet[];
  wall: DesignCabinet[];
  accessory: DesignCabinet[];
  surround: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] };
};

const catalog = catalogFixture as unknown as Record<string, StylePack>;

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
  appliance("HOOD-30", 30, 18, 18),
];

type Case = {
  styleId: string;
  layout: AutoDesignLayoutType;
  room: { width: number; depth: number };
  sinkCenter: number;
  rangeWall: "Wall 1" | "Wall 2" | "Wall 3";
  rangeCenter: number;
  fridgeWall: "Wall 1" | "Wall 2" | "Wall 3";
  fridgeCenter: number;
};

/** The reported layout family: a 36-inch sink window, a range, and a panelled refrigerator. */
const CASES: Case[] = [
  {
    styleId: "330014", layout: "l-shape", room: { width: 144, depth: 120 },
    sinkCenter: 72, rangeWall: "Wall 2", rangeCenter: 60, fridgeWall: "Wall 1", fridgeCenter: 60,
  },
  {
    styleId: "540005", layout: "u-shape", room: { width: 144, depth: 120 },
    sinkCenter: 72, rangeWall: "Wall 2", rangeCenter: 60, fridgeWall: "Wall 1", fridgeCenter: 108,
  },
  {
    styleId: "540029", layout: "galley", room: { width: 132, depth: 108 },
    sinkCenter: 66, rangeWall: "Wall 1", rangeCenter: 66, fridgeWall: "Wall 1", fridgeCenter: 24,
  },
];

function build(spec: Case) {
  const room = { width: spec.room.width, depth: spec.room.depth, ceilingHeight: 96 } as RoomData;
  const pack = catalog[spec.styleId]!;
  let uid = 0;
  return runAutoDesignLayout({
    input: {
      layoutType: spec.layout, originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 3", centerOffsetIn: spec.sinkCenter }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      sinkWindowCenter: true,
      stove: { wallLabel: spec.rangeWall, centerOffsetIn: spec.rangeCenter }, dishwasher: null, dishwasherSide: "right",
      refrigerator: { wallLabel: spec.fridgeWall, centerOffsetIn: spec.fridgeCenter }, refrigeratorWidthIn: 36,
      refrigeratorPanels: "both", refrigeratorEnclosure: "cabinet-above",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    },
    room, openings: [],
    baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory, appliancePalette: PALETTE,
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround.endPanels ?? [],
    styleId: Number(spec.styleId), makeUid: () => `m-${++uid}`,
  });
}

function panels(placed: readonly PlacedCabinet[]): PlacedCabinet[] {
  return placed.filter(isRefrigeratorEndPanel);
}

function spanOn(item: PlacedCabinet, room: RoomData) {
  const wall = cabinetWall(item, room);
  const start = wallRunOffset(item, wall, room);
  return { wall, start, end: start + wallRunSpan(item, wall, room) };
}

describe("Auto-Design fillers obey the front-face rule", () => {
  for (const spec of CASES) {
    it(`${spec.layout} ${spec.styleId}: no filler touches a refrigerator end panel`, () => {
      const result = build(spec);
      expect(result.ok, result.ok ? "" : result.message).toBe(true);
      if (!result.ok) return;
      const room = { width: spec.room.width, depth: spec.room.depth, ceilingHeight: 96 } as RoomData;
      const boardPanels = panels(result.placed);
      expect(boardPanels.length).toBeGreaterThan(0);
      for (const filler of result.placed.filter(isFillerItem)) {
        const board = spanOn(filler, room);
        for (const panel of boardPanels) {
          const slab = spanOn(panel, room);
          if (slab.wall !== board.wall) continue;
          const overlap = Math.min(board.end, slab.end) - Math.max(board.start, slab.start);
          expect(overlap, `${filler.masterCode} overlaps ${panel.masterCode}`).toBeLessThanOrEqual(0.02);
        }
      }
    });

    it(`${spec.layout} ${spec.styleId}: every filler is legal under the front-face rule`, () => {
      const result = build(spec);
      if (!result.ok) return;
      const room = { width: spec.room.width, depth: spec.room.depth, ceilingHeight: 96 } as RoomData;
      for (const filler of result.placed.filter(isFillerItem)) {
        const violation = fillerRuleViolation({
          filler, placed: result.placed, room, openings: result.openings,
        });
        expect(violation, `${filler.masterCode}: ${violation?.detail ?? ""}`).toBeNull();
      }
    });

    it(`${spec.layout} ${spec.styleId}: no run carries more than one board`, () => {
      const result = build(spec);
      if (!result.ok) return;
      const room = { width: spec.room.width, depth: spec.room.depth, ceilingHeight: 96 } as RoomData;
      const counts = new Map<string, number>();
      for (const filler of result.placed.filter(isFillerItem)) {
        const wall = cabinetWall(filler, room);
        const key = `${wall}/${filler.placement}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      // The seam a range leaves beside a corner and the sink-window shoulder are
      // separate runs, so a U can legitimately carry one board per run.
      for (const [key, count] of counts) expect(count, key).toBeLessThanOrEqual(1);
    });
  }
});

/**
 * Owner request (Tom, Nov 11 2026): Auto-Design can build a kitchen with no
 * dishwasher. The run that would have held it is filled with regular base
 * cabinets, and fillers follow the rules already in the build. No dishwasher
 * panel is added, the refrigerator stays put, an L or U still gets its corner
 * wall cabinet, and the cabinet over the refrigerator stays flush with the bay.
 */
import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs, AutoDesignLayoutType, WallLabel } from "./autoDesignAutoBuild";
import {
  cabinetFrontIn,
  cabinetWall,
  isCornerCabinet,
  isFillerItem,
  isPanelItem,
  isRefrigerator,
  isSinkBaseCabinet,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { isDishwasherItem, isDishwasherPanelPlacement, syncDishwasherPanels } from "./dishwasherPanelRule";
import { refrigeratorBayFaceIn } from "./refrigeratorBridgeDepth";

type StylePack = {
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
];

const DWR = {
  id: 77001,
  masterCode: "BEP(DWR)3",
  description: "Dishwasher Return Panel",
  category: "Panel",
  subCategory: "Dishwasher Panel",
  width: 3,
  height: 34.5,
  depth: 24,
  price: 86,
};

type Spec = {
  id: string;
  styleId: string;
  layout: AutoDesignLayoutType;
  room: { width: number; depth: number };
  sinkWall: WallLabel;
  sinkCenter: number;
  rangeWall: WallLabel;
  rangeCenter: number;
  fridgeWall: WallLabel;
  fridgeCenter: number;
};

const CASES: Spec[] = [
  {
    id: "single-wall",
    styleId: "330014",
    layout: "single-wall",
    room: { width: 180, depth: 120 },
    sinkWall: "Wall 1",
    sinkCenter: 48,
    rangeWall: "Wall 1",
    rangeCenter: 120,
    fridgeWall: "Wall 1",
    fridgeCenter: 156,
  },
  {
    id: "l-shape",
    styleId: "330014",
    layout: "l-shape",
    room: { width: 144, depth: 120 },
    sinkWall: "Wall 3",
    sinkCenter: 72,
    rangeWall: "Wall 2",
    rangeCenter: 60,
    fridgeWall: "Wall 1",
    fridgeCenter: 60,
  },
  {
    id: "u-shape",
    styleId: "540005",
    layout: "u-shape",
    room: { width: 144, depth: 120 },
    sinkWall: "Wall 3",
    sinkCenter: 72,
    rangeWall: "Wall 2",
    rangeCenter: 60,
    fridgeWall: "Wall 1",
    fridgeCenter: 108,
  },
];

function roomOf(spec: Spec): RoomData {
  return { width: spec.room.width, depth: spec.room.depth, ceilingHeight: 96 } as RoomData;
}

function build(spec: Spec, dishwasherSide: "right" | "none"): AutoDesignLayoutSuccess | { ok: false; message: string } {
  const room = roomOf(spec);
  const pack = catalog[spec.styleId]!;
  let uid = 0;
  const input: AutoDesignInputs = {
    layoutType: spec.layout,
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    sink: { wallLabel: spec.sinkWall, centerOffsetIn: spec.sinkCenter },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    stove: { wallLabel: spec.rangeWall, centerOffsetIn: spec.rangeCenter },
    dishwasher: null,
    dishwasherSide,
    skipDishwasher: dishwasherSide === "none",
    refrigerator: { wallLabel: spec.fridgeWall, centerOffsetIn: spec.fridgeCenter },
    refrigeratorWidthIn: 36,
    refrigeratorPanels: "both",
    refrigeratorEnclosure: "cabinet-above",
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
  };
  return runAutoDesignLayout({
    input,
    room,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: [...pack.accessory, DWR as unknown as DesignCabinet],
    appliancePalette: PALETTE,
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround.endPanels ?? [],
    panelCatalog: [...pack.accessory, DWR as unknown as DesignCabinet],
    styleId: Number(spec.styleId),
    makeUid: () => `${spec.id}-${dishwasherSide}-${++uid}`,
  });
}

function spanOf(item: PlacedCabinet, room: RoomData) {
  const wall = cabinetWall(item, room);
  const start = wallRunOffset(item, wall, room);
  return { wall, start, end: start + wallRunSpan(item, wall, room) };
}

/** Gaps left inside [from, to] after the given spans are removed. */
function uncoveredGaps(spans: Array<{ start: number; end: number }>, from: number, to: number): number[] {
  const clipped = spans
    .map((span) => ({ start: Math.max(span.start, from), end: Math.min(span.end, to) }))
    .filter((span) => span.end - span.start > 0.05)
    .sort((a, b) => a.start - b.start);
  const gaps: number[] = [];
  let cursor = from;
  for (const span of clipped) {
    if (span.start > cursor + 0.05) gaps.push(span.start - cursor);
    cursor = Math.max(cursor, span.end);
  }
  if (to > cursor + 0.05) gaps.push(to - cursor);
  return gaps;
}

function overlapIn(spans: Array<{ start: number; end: number }>, from: number, to: number): number {
  const width = to - from;
  return width - uncoveredGaps(spans, from, to).reduce((sum, gap) => sum + gap, 0);
}

describe("Auto-Design with no dishwasher", () => {
  for (const spec of CASES) {
    it(`${spec.id}: fills the dishwasher run with base cabinets and adds no dishwasher panel`, () => {
      const room = roomOf(spec);
      const withDishwasher = build(spec, "right");
      const without = build(spec, "none");
      expect(withDishwasher.ok, withDishwasher.ok ? "" : withDishwasher.message).toBe(true);
      expect(without.ok, without.ok ? "" : without.message).toBe(true);
      if (!withDishwasher.ok || !without.ok) return;

      const dishwasher = withDishwasher.placed.find((item) => isDishwasherItem(item));
      expect(dishwasher, "the comparison kitchen places a dishwasher").toBeTruthy();
      if (!dishwasher) return;
      const opening = spanOf(dishwasher, room);

      expect(without.placed.some((item) => isDishwasherItem(item))).toBe(false);
      expect(without.placed.some((item) => isDishwasherPanelPlacement(item))).toBe(false);
      expect(without.placed.some((item) => /DWR|dishwasher panel/i.test(`${item.masterCode} ${item.description ?? ""}`))).toBe(false);

      const paneled = syncDishwasherPanels({ placed: without.placed, room, catalog: [DWR] });
      expect(paneled.placed).toBe(without.placed);
      expect(paneled.warnings).toEqual([]);
      expect(paneled.placed.some((item) => isDishwasherPanelPlacement(item))).toBe(false);

      const onWall = without.placed.filter((item) => cabinetWall(item, room) === opening.wall);
      const regularBases = onWall.filter((item) => (
        item.placement === "base"
        && !isFillerItem(item)
        && !isPanelItem(item)
        && !isSinkBaseCabinet(item)
        && !isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null)
      ));
      const runFill = onWall.filter((item) => (
        item.placement !== "wall"
        && !isDishwasherItem(item)
        && !isDishwasherPanelPlacement(item)
        && (item.placement === "base" || isFillerItem(item) || isPanelItem(item))
      ));
      const covers = runFill.map((item) => spanOf(item, room));
      const gaps = uncoveredGaps(covers, opening.start, opening.end);
      const nearby = onWall
        .map((item) => {
          const span = spanOf(item, room);
          return `${item.masterCode}/${item.placement} ${span.start.toFixed(2)}-${span.end.toFixed(2)}`;
        })
        .join(" | ");
      expect(gaps.every((gap) => gap < 1.5), `open gaps in the dishwasher span ${opening.start.toFixed(2)}-${opening.end.toFixed(2)}: ${gaps.join(", ")}\n${nearby}`).toBe(true);
      expect(overlapIn(regularBases.map((item) => spanOf(item, room)), opening.start, opening.end)).toBeGreaterThan(9);

      const fridgeWith = withDishwasher.placed.find((item) => isRefrigerator(item));
      const fridgeWithout = without.placed.find((item) => isRefrigerator(item));
      expect(fridgeWith && fridgeWithout).toBeTruthy();
      if (!fridgeWith || !fridgeWithout) return;
      const fridgeWall = cabinetWall(fridgeWith, room);
      expect(cabinetWall(fridgeWithout, room)).toBe(fridgeWall);
      expect(wallRunOffset(fridgeWithout, fridgeWall, room)).toBeCloseTo(wallRunOffset(fridgeWith, fridgeWall, room), 1);

      const bridge = without.placed.find((item) => item.refrigeratorAssemblyRole === "bridge");
      const bay = refrigeratorBayFaceIn(without.placed, fridgeWithout.uid, room);
      expect(bridge && bay).toBeTruthy();
      if (!bridge || !bay) return;
      expect(cabinetFrontIn(bridge, bay.wallId, room)).toBeCloseTo(bay.faceIn, 2);

      if (spec.layout === "l-shape" || spec.layout === "u-shape") {
        const cornerWall = without.placed.some((item) => (
          item.placement === "wall"
          && isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null)
        ));
        expect(cornerWall, `${spec.layout} keeps a corner wall cabinet`).toBe(true);
      }
    });
  }
});

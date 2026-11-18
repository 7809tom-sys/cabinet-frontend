/**
 * Tom, voice, Nov 18 2026, 4:49 PM CT (U-shaped maple kitchen, line 390009, the
 * five-piece shaker): every door and drawer front uses the line's one door style,
 * no drawer fronts or drawer-style uppers in an upper run, and drawer banks only
 * where the drawer rule puts them (beside the range). Fixture: the live public
 * catalog rows for style 390009 (design.placeableCabinets +
 * design.surroundForFridge, read-only).
 */
import { describe, expect, it } from "vitest";
import live from "@/lib/__fixtures__/live390009.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "@/lib/autoDesignLayout";
import { emptyAutoDesignIntake } from "@/lib/autoDesignFifteenRules";
import { autoDesignStandardUpperRows } from "@/lib/autoDesignWallCabinets";
import {
  appliancesForRoom, applianceAsDesignCabinet, cabinetWall, effectiveStyleId, isRangeOrOven, wallRunOffset, wallRunSpan,
  type DesignCabinet, type RoomData,
} from "@/lib/design";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall: DesignCabinet[]; surround: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const pack = live as unknown as Pack;

function build() {
  let uid = 0;
  const room = { width: 192, depth: 144, ceilingHeight: 96, openWallPath: false } as RoomData;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "u-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 96 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 72 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
      dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] }, sinkWindowCenter: { wallLabel: "Wall 1", centerOffsetIn: 96 },
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: ["crown-molding", "dishwasher"], islandOrPeninsula: "none", canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } },
    } as never,
    room, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround.deepAbove ?? []), refrigeratorEndPanels: pack.surround.endPanels ?? [],
    tallCatalog: pack.tall, panelCatalog: [...pack.accessory, ...(pack.surround.endPanels ?? [])], styleId: 390009, makeUid: () => `d-${++uid}`,
  } as never);
  if (!result.ok) throw new Error(result.message);
  return { result, room };
}

describe("Auto Design 390009 shaker kitchen: one door style, no drawer uppers, drawer banks by the range", () => {
  it("stamps every cabinet with the line's single door style (390009)", () => {
    const { result } = build();
    const cabinets = result.placed.filter((item) => item.placement === "base" || item.placement === "wall" || item.placement === "tall");
    expect(cabinets.length).toBeGreaterThan(10);
    expect(new Set(cabinets.map((item) => effectiveStyleId(item, 390009)))).toEqual(new Set([390009]));
  });

  it("never tiles a wall cabinet with a drawer into an upper run, and the plan has no drawer upper", () => {
    expect(pack.wall.some((row) => /^WD\d/.test(row.masterCode) && (row.numberOfDrawers ?? 0) > 0)).toBe(true);
    for (const height of [30, 36, 42, 48, 54, 60]) {
      expect(autoDesignStandardUpperRows(pack.wall, height).filter((row) => (row.numberOfDrawers ?? 0) > 0 || /^WD\d/.test(row.masterCode))).toEqual([]);
    }
    const { result } = build();
    expect(result.placed.filter((item) => item.placement === "wall" && (item.numberOfDrawers ?? 0) > 0)).toEqual([]);
  });

  it("keeps drawer banks to the range sides (the drawer rule); every other base is a door base", () => {
    const { result, room } = build();
    const range = result.placed.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description))!;
    const wall = cabinetWall(range, room);
    const rs = wallRunOffset(range, wall, room);
    const re = rs + wallRunSpan(range, wall, room);
    const banks = result.placed.filter((item) => item.placement === "base" && /^\d?DB\d/i.test(item.masterCode));
    expect(banks.length).toBeGreaterThan(0);
    for (const bank of banks) {
      expect(cabinetWall(bank, room)).toBe(wall);
      const s = wallRunOffset(bank, wall, room);
      const e = s + wallRunSpan(bank, wall, room);
      expect(Math.abs(e - rs) <= 0.1 || Math.abs(s - re) <= 0.1, `${bank.masterCode} at ${s}`).toBe(true);
    }
  });
});

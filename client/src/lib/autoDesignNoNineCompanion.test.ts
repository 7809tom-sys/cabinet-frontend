import { describe, expect, it } from "vitest";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { autoDesignCornerFamily } from "./autoDesignCornerStage";
import {
  appliancesForRoom, applianceAsDesignCabinet, isCornerCabinet, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

/**
 * Tom, Nov 18 2026 (voice 10:27 AM CT): the 9 in companion beside a lazy Susan
 * corner (PR #421) is removed. Nothing reserves the space beside the corner, so
 * the normal base fill and gap passes own it. On the 192 x 144 U-shape with the
 * Aero Solstice line, no BT9 / SPB9 is auto-placed and the base segments beside
 * the range and after the sink are filled (or reported), not left blank.
 */
const LIVE = live as unknown as {
  base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall: DesignCabinet[];
  surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] };
};

function runAeroUShape(): { result: AutoDesignLayoutSuccess; room: RoomData } {
  const room = { width: 192, depth: 144, ceilingHeight: 108, openWallPath: false } as RoomData;
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "u-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 96 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 72 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
      dishwasherSide: "right", skipDishwasher: true, tallCabinets: null, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      designQuestionDoorStyleId: 390019, designQuestionDoorStyleName: "Aero Solstice",
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: [], islandOrPeninsula: "none" },
    } as never,
    room, openings: [], baseCatalog: LIVE.base, wallCatalog: LIVE.wall, fillers: LIVE.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(LIVE.wall, LIVE.surround.deepAbove ?? []),
    refrigeratorEndPanels: LIVE.surround.endPanels ?? [], tallCatalog: LIVE.tall, panelCatalog: LIVE.accessory,
    styleId: 390019, makeUid: () => `nine-${++uid}`,
  } as never);
  if (!result.ok) throw new Error(result.message);
  return { result, room };
}

const span = (item: PlacedCabinet, room: RoomData) => {
  const wall = item.wallId ?? "";
  const start = wallRunOffset(item, wall, room);
  return { start, end: start + wallRunSpan(item, wall, room) };
};

describe("Auto Design: no 9 in companion beside a lazy Susan (Aero, 192 x 144 U)", () => {
  const { result, room } = runAeroUShape();
  const placed = result.placed;
  const bases = (wall: string) => placed
    .filter((item) => item.wallId === wall && (item.placement === "base" || item.placement === "appliance" || item.placement === "tall"))
    .map((item) => ({ item, ...span(item, room) }))
    .sort((a, b) => a.start - b.start);

  it("seats lazy Susan corners and places no BT9 / SPB9 companion beside them", () => {
    const corners = placed.filter((item) => item.placement === "base" && isCornerCabinet(item.masterCode, item.description, item.cornerType ?? null));
    expect(corners.length).toBeGreaterThan(0);
    expect(corners.some((item) => autoDesignCornerFamily(item as never) === "lazy-susan")).toBe(true);
    expect(placed.filter((item) => item.placement !== "wall" && /^(BT9|SPB9)$/i.test(item.masterCode))).toEqual([]);
    expect(result.notes.some((note) => /\(9 in\) is placed beside the lazy Susan|9 in .* seated again beside the lazy Susan/.test(note))).toBe(false);
  });

  it("fills the 21 in base segments beside the range and the run after the sink", () => {
    const right = bases("right");
    const range = right.find((entry) => /RANGE/i.test(entry.item.masterCode))!;
    expect(range).toBeTruthy();
    // Both sides of the range butt a base cabinet (no blank 21 in pocket).
    expect(right.some((entry) => entry.item.placement === "base" && Math.abs(entry.end - range.start) <= 0.3)).toBe(true);
    expect(right.some((entry) => entry.item.placement === "base" && Math.abs(entry.start - range.end) <= 0.3)).toBe(true);
    const top = bases("top");
    const sink = top.find((entry) => /^SB/i.test(entry.item.masterCode))!;
    expect(sink).toBeTruthy();
    const afterSink = top.find((entry) => entry.item.placement === "base" && Math.abs(entry.start - sink.end) <= 0.3);
    expect(afterSink, "a base cabinet follows the sink base").toBeTruthy();
    // Every base wall runs from wall to corner with no open stretch wider than a filler.
    for (const wall of ["top", "right", "bottom"]) {
      const row = bases(wall).filter((entry) => entry.item.placement !== "tall");
      for (let i = 1; i < row.length; i += 1) {
        expect(row[i]!.start - row[i - 1]!.end, `${wall} gap after ${row[i - 1]!.item.masterCode}`).toBeLessThanOrEqual(3.05);
      }
    }
  });
});

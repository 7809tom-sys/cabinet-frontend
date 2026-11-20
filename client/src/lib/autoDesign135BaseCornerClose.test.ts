/**
 * Tom, Nov 20 2026 (owner voice, 4:09 / 4:33 PM CT): the 135° base corner
 * between the sink wall and the range wall must close. The 23¼" stock ask was
 * a measurement that jumped over the dishwasher. After the corner can close,
 * the range-left B12 grows to B15/B18 when that fits flush, with no leftover
 * filler. The countertop keeps a 45° seam and still breaks at the range.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { runAutoDesignLayout } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { measuredAngledWallTransition } from "./angledWallFiller";
import {
  bearsCountertop,
  countertopSurfaces,
  isRangeOrOven,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type RoomData,
  type WallOpening,
} from "./design";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const STYLE = "330011";
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const ACCESSORIES = REAL[STYLE]!.accessory as DesignCabinet[];
const FILLERS = ACCESSORIES.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

function wallBuilderFiveWallRoom(): RoomData {
  const L = 138;
  return {
    width: 204, depth: 210, ceilingHeight: 96, openWallPath: true,
    vertices: [
      { id: "v1", x: 0, y: 0 }, { id: "v2", x: L, y: 0 }, { id: "v3", x: L + 66, y: 66 },
      { id: "v4", x: L + 66, y: 144 }, { id: "v5", x: L, y: 210 }, { id: "v6", x: 40, y: 210 },
    ],
    customWalls: [
      { id: "cw_k6x_1", label: "Wall 1", startVertexId: "v1", endVertexId: "v2" },
      { id: "cw_k6x_2", label: "Wall 2", startVertexId: "v2", endVertexId: "v3", lockedAngle: 45 },
      { id: "cw_k6x_3", label: "Wall 3", startVertexId: "v3", endVertexId: "v4" },
      { id: "cw_k6x_4", label: "Wall 4", startVertexId: "v4", endVertexId: "v5", lockedAngle: 45 },
      { id: "cw_k6x_5", label: "Wall 5", startVertexId: "v5", endVertexId: "v6" },
    ],
  } as RoomData;
}

describe("135° base corner close (Tom, Nov 20 2026)", () => {
  it("closes the sink-to-range 135° corner without a 23¼-inch stock ask, grows the range-left base when that fits, and keeps the countertop split at the range", () => {
    const room = wallBuilderFiveWallRoom();
    const openings = [{
      uid: "tom-sink-window", kind: "window", label: "Window 36\"", side: "cw_k6x_2",
      offset: 20, width: 36, height: 42, sill: 42,
    } as WallOpening];
    let uid = 0;
    const result = runAutoDesignLayout({
      input: {
        layoutType: "u-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
        sink: { wallLabel: "Wall 2", centerOffsetIn: 36 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
        stove: { wallLabel: "Wall 3", centerOffsetIn: 39 },
        refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 },
        dishwasher: { wallLabel: "Wall 2", centerOffsetIn: 70.34 }, dishwasherSide: "right", skipDishwasher: false,
        tallCabinets: null, overRangeAnswer: "microwave-bridge",
        kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
        intake: { ...emptyAutoDesignIntake(), construction: "new", islandOrPeninsula: "none", preferences: ["glass-uppers", "dishwasher"] },
      } as AutoDesignInputs,
      room,
      openings,
      baseCatalog: BASES, wallCatalog: WALLS, fillers: FILLERS,
      appliancePalette: [
        appliance("RANGE-30", 30, 25, 36),
        appliance("DW-24", 24, 24, 34.5),
        appliance("FRIDGE-36", 36, 30, 70),
        appliance("MW-30", 30, 15, 16),
      ],
      refrigeratorCaps: WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
      refrigeratorEndPanels: ACCESSORIES.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`)),
      panelCatalog: ACCESSORIES.filter((row) => /end panel|DWR|WEP|BEP/i.test(`${row.masterCode} ${row.description}`)),
      styleId: Number(STYLE), makeUid: () => `b135-${++uid}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stockAsk = result.reviewFindings.filter((finding) => (
      finding.code === "angled-base-corner-open"
      && /cw_k6x_2/i.test(`${finding.title} ${finding.detail}`)
      && /cw_k6x_3/i.test(`${finding.title} ${finding.detail}`)
    ));
    expect(stockAsk.some((finding) => /23\s*¼|23\.25|23 1\/4/.test(`${finding.title} ${finding.detail}`))).toBe(false);

    for (const item of result.placed) {
      if (item.placement !== "base" || item.fillerPieceGroupId) continue;
      const measured = measuredAngledWallTransition(item, room, result.placed);
      if (!measured) continue;
      expect(measured.requiredStockWidthIn, `${item.masterCode} ${item.uid} jumped a far cabinet`).toBeLessThan(12);
    }

    const range = result.placed.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description) && item.wallId === "cw_k6x_3");
    expect(range).toBeTruthy();
    const rangeStart = wallRunOffset(range!, "cw_k6x_3", room);
    const left = result.placed
      .filter((item) => item.placement === "base" && !item.fillerPieceGroupId && item.wallId === "cw_k6x_3")
      .map((item) => ({ item, start: wallRunOffset(item, "cw_k6x_3", room), end: wallRunOffset(item, "cw_k6x_3", room) + wallRunSpan(item, "cw_k6x_3", room) }))
      .filter((row) => row.end <= rangeStart + 0.2)
      .sort((a, b) => b.end - a.end)[0];
    expect(left, "a base should stand immediately left of the range").toBeTruthy();
    expect(rangeStart - left!.end).toBeLessThan(0.2);
    expect(["B12", "B15", "B18"]).toContain(left!.item.masterCode);
    expect(left!.start).toBeGreaterThanOrEqual(9.9 - 0.2);

    expect(bearsCountertop(range!)).toBe(false);
    const tops = countertopSurfaces(result.placed, { room });
    expect(tops.length).toBeGreaterThan(0);
    const rangeStartAlong = rangeStart;
    const rangeEndAlong = rangeStart + wallRunSpan(range!, "cw_k6x_3", room);
    const rangeBearing = result.placed.filter((item) => {
      if (item.uid === range!.uid) return false;
      if (item.wallId !== "cw_k6x_3") return false;
      if (!bearsCountertop(item)) return false;
      const start = wallRunOffset(item, "cw_k6x_3", room);
      const end = start + wallRunSpan(item, "cw_k6x_3", room);
      return start < rangeEndAlong - 0.2 && end > rangeStartAlong + 0.2;
    });
    expect(rangeBearing, "the countertop must still break at the freestanding range").toEqual([]);
  });
});

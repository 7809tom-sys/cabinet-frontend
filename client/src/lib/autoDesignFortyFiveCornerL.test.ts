/**
 * Tom, Nov 16 2026 (voice 12:14–12:15 PM CT) — the 45° corner in a two-wall L:
 *  - the corner is recognized with the manual Designer's tolerance (44.7° counts);
 *  - the first base beside the 3″ filler sits where a hand drop snaps it;
 *  - the countertop fills the angled corner exactly as for the hand-placed run;
 *  - the corner cabinet is sized from the sink anchor on that wall, from real
 *    stock widths, leaving at most a small filler away from the corner.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { measuredAngledWallTransition } from "./angledWallFiller";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import {
  cabinetPlacementCollisionDetail,
  isFillerItem,
  wallLength,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
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


import { countertopSurfaces, freeSegmentsOnWall, magneticAvailableWallStart, measuredWallCountertopMiterSurfaces, wallPlacementAt } from "./design";
import { fortyFiveCornerSeat } from "./autoDesignFortyFiveCornerSeat";
function lRoom(turnDeg = 45): RoomData {
  const a = (-90 + turnDeg) * Math.PI / 180; // left wall runs up (-y); turn toward +x
  const v3 = { x: 120 * Math.cos(a), y: 96 + 120 * Math.sin(a) };
  return { width: 200, depth: 200, ceilingHeight: 96, openWallPath: true,
    vertices: [{ id: "v1", x: 0, y: 192 }, { id: "v2", x: 0, y: 96 }, { id: "v3", ...v3 }],
    customWalls: [
      { id: "left", label: "Wall 1", startVertexId: "v1", endVertexId: "v2" },
      { id: "ang", label: "Wall 2", startVertexId: "v2", endVertexId: "v3", lockedAngle: 45 },
    ] } as RoomData;
}
function build(room: RoomData, sinkCenter: number, dw: boolean) {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 2", centerOffsetIn: sinkCenter }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 1", centerOffsetIn: 40 },
      refrigerator: null,
      dishwasher: dw ? { side: "right" } : null, skipDishwasher: !dw, tallCabinets: null,
      overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    } as unknown as AutoDesignInputs,
    room, openings: [],
    baseCatalog: BASES, wallCatalog: WALLS, fillers: FILLERS,
    appliancePalette: [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70)],
    refrigeratorCaps: [], refrigeratorEndPanels: [],
    styleId: Number(STYLE), makeUid: () => `l-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

function cornerBase(result: AutoDesignLayoutSuccess, room: RoomData) {
  const seat = fortyFiveCornerSeat(room, "ang", "start", "base")!;
  const boxes = result.placed
    .filter((item) => item.wallId === "ang" && item.placement === "base" && !isFillerItem(item) && !item.fillerPieceGroupId)
    .map((item) => ({ item, start: wallRunOffset(item, "ang", room) }))
    .sort((left, right) => left.start - right.start);
  return { seat, first: boxes[0]! };
}

describe("45° L corner (Tom, Nov 16 2026)", () => {
  it("sizes the corner cabinet from the sink position, from real stock widths, starting at the 3″ filler end", () => {
    const widths: number[] = [];
    for (const sinkCenter of [40, 46, 52]) {
      const room = lRoom();
      const result = build(room, sinkCenter, false);
      const { seat, first } = cornerBase(result, room);
      expect(first.start).toBeCloseTo(seat.cabinetSetbackIn, 2);
      expect(BASES.some((row) => row.masterCode === first.item.masterCode)).toBe(true);
      widths.push(Number(first.item.width));
      // Between the corner cabinet and the sink base: at most one small filler, never against the corner.
      const sink = result.placed.find((item) => item.wallId === "ang" && /^SB/.test(item.masterCode))!;
      const between = result.placed.filter((item) => item.wallId === "ang" && item.placement === "base" && isFillerItem(item)
        && item.fillerTransitionKind !== "front-miter-pair"
        && wallRunOffset(item, "ang", room) >= first.start && wallRunOffset(item, "ang", room) < wallRunOffset(sink, "ang", room));
      expect(between.length).toBeLessThanOrEqual(1);
      for (const filler of between) expect(Number(filler.width)).toBeLessThanOrEqual(3);
    }
    // Moving the sink away from the corner widens the corner cabinet.
    expect(widths).toEqual([9, 12, 18]);
  });

  it("closes the L corner with the 3″ miter pair on both walls", () => {
    const room = lRoom();
    const result = build(room, 52, false);
    const pair = result.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair" && item.placement === "base");
    expect(pair.map((item) => item.wallId).sort()).toEqual(["ang", "left"]);
    for (const piece of pair) expect(Number(piece.fillerTransitionStockWidthIn)).toBe(3);
    expect(result.reviewFindings.some((finding) => finding.code === "angled-base-corner-open")).toBe(false);
  });

  it("recognizes a slightly-off 44.7° corner the way the manual Designer does", () => {
    const room = lRoom(44.7);
    expect(fortyFiveCornerSeat(room, "ang", "start", "base")).not.toBeNull();
    const result = build(room, 40, false);
    const { seat, first } = cornerBase(result, room);
    expect(first.start).toBeCloseTo(seat.cabinetSetbackIn, 2);
    expect(result.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair" && item.placement === "base")).toHaveLength(2);
  });

  it("puts the corner cabinet exactly where a hand drop beside the filler snaps it", () => {
    const room = lRoom();
    const result = build(room, 52, false);
    const { first } = cornerBase(result, room);
    const others = result.placed.filter((item) => item.uid !== first.item.uid);
    const segments = freeSegmentsOnWall("ang" as WallSide, room, others, [], 9, 0, "base", false, first.item, first.item.depth);
    // A hand drop a little away from the filler end snaps against it.
    const snapped = magneticAvailableWallStart(segments, first.start + 1.5, Number(first.item.width));
    expect(snapped).not.toBeNull();
    expect(snapped!).toBeCloseTo(first.start, 3);
    const handPlaced = [...others, { ...first.item, ...wallPlacementAt(snapped!, Number(first.item.width), first.item.depth, "ang" as WallSide, room) }];
    // Same countertop pieces for the Auto Design run and the hand-placed run, including the angled-corner fill.
    expect(measuredWallCountertopMiterSurfaces(result.placed, room)).toHaveLength(1);
    expect(JSON.stringify(countertopSurfaces(handPlaced, room))).toBe(JSON.stringify(countertopSurfaces(result.placed, room)));
  });
});

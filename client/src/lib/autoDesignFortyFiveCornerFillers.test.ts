/**
 * Tom, Nov 16 2026 (voice, 11:53 AM CT): at every 45° corner (135° interior)
 * place a 135° angled filler that runs 3″ out from the corner along EACH wall,
 * then build the rest of the cabinetry from the end of each filler. This
 * replaces the 24″ inside-corner square that was reserved at every shared
 * vertex and never given back, which left the fridge-side bases ~25¾″ short of
 * the sink run in his five-wall kitchen. 90° corners keep the square.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { FORTY_FIVE_CORNER_FILLER_IN, fortyFiveCornerSeat } from "./autoDesignFortyFiveCornerSeat";
import { autoDesignInsideCornerReservations, INSIDE_CORNER_SQUARE_IN } from "./autoDesignCornerDecision";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import {
  isFillerItem,
  wallLength,
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
const TAN_22_5 = Math.tan(Math.PI / 8);
const BASE_SETBACK = (24 - 0.75) * TAN_22_5 + 3; // ≈ 12.63″
const UPPER_SETBACK = (12 - 0.75) * TAN_22_5 + 3; // ≈ 7.66″

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

/** Plain 90° L: two walls meeting square. */
function squareRoom(): RoomData {
  return {
    width: 144, depth: 120, ceilingHeight: 96, openWallPath: true,
    vertices: [{ id: "a", x: 0, y: 120 }, { id: "b", x: 0, y: 0 }, { id: "c", x: 144, y: 0 }],
    customWalls: [
      { id: "w1", label: "Wall 1", startVertexId: "a", endVertexId: "b" },
      { id: "w2", label: "Wall 2", startVertexId: "b", endVertexId: "c" },
    ],
  } as RoomData;
}

const sinkWindow: WallOpening = {
  uid: "tom-sink-window", kind: "window", label: "Window 36\"", side: "angTR", offset: 20, width: 36, height: 42, sill: 42,
} as WallOpening;

function build(fillers: DesignCabinet[] = FILLERS, extra: Partial<AutoDesignInputs> = {}): AutoDesignLayoutSuccess {
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
      ...extra,
    } as AutoDesignInputs,
    room: tomsFiveWallRoom(), openings: [sinkWindow],
    baseCatalog: BASES, wallCatalog: WALLS, fillers,
    appliancePalette: [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70)],
    refrigeratorCaps: WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
    refrigeratorEndPanels: ACCESSORIES.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`)),
    panelCatalog: ACCESSORIES.filter((row) => /end panel|DWR|WEP|BEP/i.test(`${row.masterCode} ${row.description}`)),
    styleId: Number(STYLE), makeUid: () => `fortyfive-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

function span(item: PlacedCabinet, room: RoomData) {
  const start = wallRunOffset(item, item.wallId!, room);
  return { start, end: start + wallRunSpan(item, item.wallId!, room) };
}

function cornerEndBase(placed: readonly PlacedCabinet[], room: RoomData, wallId: string, at: "start" | "end") {
  const len = wallLength(wallId as WallSide, room);
  return placed
    .filter((item) => item.wallId === wallId && item.placement === "base" && !isFillerItem(item) && !item.fillerPieceGroupId)
    .map((item) => ({ item, gap: at === "start" ? span(item, room).start : len - span(item, room).end }))
    .sort((left, right) => left.gap - right.gap)[0]!;
}

describe("45° corner seat geometry", () => {
  const room = tomsFiveWallRoom();

  it("puts the first base 3″ of filler stock past the miter at a 135° corner", () => {
    const seat = fortyFiveCornerSeat(room, "top", "end", "base");
    expect(seat).not.toBeNull();
    expect(seat!.fillerIn).toBe(FORTY_FIVE_CORNER_FILLER_IN);
    expect(seat!.frontMiterIn).toBeCloseTo(24 * TAN_22_5, 3);
    expect(seat!.cabinetSetbackIn).toBeCloseTo(BASE_SETBACK, 3);
    expect(seat!.cornerUnitIn).toBe(0);
  });

  it("uses the 12″ upper depth for the wall layer", () => {
    expect(fortyFiveCornerSeat(room, "angTR", "start", "wall")!.cabinetSetbackIn).toBeCloseTo(UPPER_SETBACK, 3);
  });

  it("leaves room for a future 45° angle corner cabinet without changing today's seat", () => {
    const seat = fortyFiveCornerSeat(room, "top", "end", "base", { cornerUnitIn: 12 });
    expect(seat!.cabinetSetbackIn).toBeCloseTo(BASE_SETBACK + 12, 3);
  });

  it("is not a 45° seat at a 90° corner or an open wall end", () => {
    expect(fortyFiveCornerSeat(squareRoom(), "w1", "end", "base")).toBeNull();
    expect(fortyFiveCornerSeat(room, "top", "start", "base")).toBeNull();
  });
});

describe("inside-corner reservations", () => {
  it("reserves only the 3″ filler seat at a 45° join", () => {
    const room = tomsFiveWallRoom();
    const reserved = autoDesignInsideCornerReservations(room, ["top", "angTR", "right"]);
    const topEnd = reserved.find((span) => span.wallId === "top")!;
    expect(topEnd.end).toBeCloseTo(138, 3);
    expect(topEnd.end - topEnd.start).toBeCloseTo(BASE_SETBACK, 3);
    for (const span of reserved) expect(span.end - span.start).toBeLessThan(INSIDE_CORNER_SQUARE_IN - 1);
  });

  it("keeps the full 24″ square at a 90° corner", () => {
    const reserved = autoDesignInsideCornerReservations(squareRoom(), ["w1", "w2"]);
    expect(reserved).toHaveLength(2);
    for (const span of reserved) expect(span.end - span.start).toBeCloseTo(INSIDE_CORNER_SQUARE_IN, 3);
  });
});

describe("Tom's five-wall kitchen (line 330011)", () => {
  it("closes the fridge-run / sink-run base corner with a 3″ BFF3 pair, cabinets starting at the filler end", () => {
    const result = build();
    const room = tomsFiveWallRoom();
    const fridgeRun = cornerEndBase(result.placed, room, "top", "end");
    // Before: B36 stopped 25¾″ from the corner. Now the run ends where the 3″ board ends.
    expect(fridgeRun.gap).toBeCloseTo(BASE_SETBACK, 1);
    const pair = result.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair" && item.placement === "base"
      && (item.wallId === "top" || item.wallId === "angTR"));
    expect(pair).toHaveLength(2);
    for (const piece of pair) {
      expect(piece.masterCode).toBe("BFF3");
      expect(piece.fillerMiterAngle).toBe(22.5);
      expect(piece.fillerTransitionStockWidthIn).toBe(3);
      expect(piece.width).toBeLessThanOrEqual(3);
    }
    // Each board sits between a cabinet and the miter of the other board: never at an open end.
    const owners = new Set(pair.map((piece) => piece.fillerForCabinetUid));
    expect(owners.size).toBe(2);
    expect(result.reviewFindings.some((finding) => finding.code === "angled-base-corner-open"
      && /top and angTR|angTR and top/.test(finding.title))).toBe(false);
  });

  it("puts the run's leftover at the fridge end of the run, not against the 45° corner", () => {
    const result = build();
    const room = tomsFiveWallRoom();
    const fridgeRun = cornerEndBase(result.placed, room, "top", "end");
    const between = result.placed.filter((item) => item.wallId === "top" && item.placement === "base" && isFillerItem(item)
      && !item.fillerTransitionKind && span(item, room).start >= span(fridgeRun.item, room).end - 0.05);
    expect(between).toHaveLength(0);
  });

  it("emits a visible warning and fakes no part when the line has no filler that can make 3″", () => {
    // Only the source-described wall filler: nothing a base may be cut from.
    const noBaseFillers = FILLERS.filter((row) => /\bwall\s+filler\b/i.test(row.description ?? ""));
    expect(noBaseFillers.length).toBeGreaterThan(0);
    const result = build(noBaseFillers);
    const basePairs = result.placed.filter((item) => item.fillerTransitionKind === "front-miter-pair" && item.placement === "base");
    expect(basePairs).toHaveLength(0);
    expect(result.reviewFindings.some((finding) => finding.code === "angled-base-corner-open"
      && /top and angTR|angTR and top/.test(finding.title))).toBe(true);
  });

  it("keeps the dishwasher-at-the-turn corner as it is on main (handled on the dishwasher-panel branch)", () => {
    const result = build();
    expect(result.reviewFindings.some((finding) => finding.code === "angled-base-corner-open"
      && /angTR and right|right and angTR/.test(finding.title))).toBe(true);
  });
});

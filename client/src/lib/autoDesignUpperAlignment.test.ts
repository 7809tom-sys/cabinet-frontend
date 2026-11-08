/**
 * Owner rule: the wall cabinets line up with the base cabinets under them.
 *
 * Regression source: the 3D right run of the reported U-shaped kitchen. The
 * uppers above the dishwasher and the sink stopped well short of where the base
 * run finished at the tall pantry, leaving a bare stretch of wall above counter,
 * and a stray upper sat over bare wall past the end of the run.
 *
 * These tests hold the rule from both ends: the pure coverage helpers, and the
 * finished Auto-Design build (where a filler, a tall box or a corner leg has
 * already moved by the time the uppers tile).
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import ovenRows from "./__fixtures__/ovenCabinetRows.json";
import { DEFAULT_ROOM, cabinetWall, wallPlacementAt, wallRunFrame, wallRunOffset, wallRunSpan, type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening } from "./design";
import { buildAutoDesignWallCabinets } from "./autoDesignWallCabinets";
import {
  cornerLegSpanOnWall,
  deliberateUpperBays,
  upperAlignableSpan,
  upperCoverageGaps,
  upperFloorCoverage,
  uppersOutsideRun,
  widestUpperWithin,
  MIN_UPPER_GAP_IN,
} from "./autoDesignUpperAlignment";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const STYLE = "330011";
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const FILLERS = (REAL[STYLE]!.accessory as DesignCabinet[]).filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));
const TALL = ovenRows as unknown as DesignCabinet[];

const ROOM = { width: 168, depth: 132, ceilingHeight: 96 } as RoomData;

function placedCabinet(input: {
  uid: string;
  code: string;
  width: number;
  wall: "top" | "right" | "bottom";
  along: number;
  placement: "base" | "appliance" | "tall" | "wall";
  depth?: number;
  height?: number;
  description?: string;
  subCategory?: string;
}): PlacedCabinet {
  const depth = input.depth ?? (input.placement === "wall" ? 12 : 24);
  const spot = wallPlacementAt(input.along, input.width, depth, input.wall, ROOM);
  return {
    uid: input.uid,
    cabinetId: input.placement === "appliance" ? 0 : 1,
    masterCode: input.code,
    description: input.description ?? `${input.width} inch cabinet`,
    category: input.placement === "appliance" ? "Appliance" : "Base",
    subCategory: input.subCategory ?? "Base Cabinet",
    placement: input.placement,
    x: spot.x, y: spot.y, rotation: spot.rotation,
    width: input.width,
    depth,
    height: input.height ?? (input.placement === "wall" ? 30 : input.placement === "tall" ? 90 : 34.5),
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    ...(input.placement === "wall" ? { mountBottom: 54 } : {}),
  } as PlacedCabinet;
}

describe("floor coverage the uppers must line up with", () => {
  it("reads the base run, not the last filler, as the end of the line", () => {
    const base = placedCabinet({ uid: "b1", code: "B36", width: 36, wall: "right", along: 0, placement: "base" });
    const filler = placedCabinet({
      uid: "f1", code: "WFF342", width: 1.25, wall: "right", along: 36, placement: "wall",
      description: "3 inch wall filler cut to 1 1/4", subCategory: "Filler",
    });
    const coverage = upperFloorCoverage([base, filler], ROOM, "right");
    expect(coverage).toEqual([{ start: 0, end: 36 }]);
    expect(upperAlignableSpan([base, filler], ROOM, "right")).toEqual({ start: 0, end: 36 });
  });

  it("counts a tall box as the boundary of the run and a corner leg on its return wall", () => {
    const base = placedCabinet({ uid: "b1", code: "B24", width: 24, wall: "right", along: 36, placement: "base" });
    const pantry = placedCabinet({ uid: "t1", code: "UOC3390", width: 33, wall: "right", along: 60, placement: "tall", description: "33x90 Oven Pantry", subCategory: "Oven Tower" });
    expect(upperAlignableSpan([base, pantry], ROOM, "right")).toEqual({ start: 36, end: 93 });
    // A seated corner at the top/right vertex reaches 24 inches along the right wall.
    const corner = placedCabinet({
      uid: "lsb", code: "LSB36", width: 36, wall: "top", along: 0, placement: "base",
      description: "36 inch Lazy Susan Corner Base", subCategory: "Lazy Susan",
    });
    const cornered = { ...corner, cornerType: "lazy-susan" } as PlacedCabinet;
    const rightCoverage = upperFloorCoverage([cornered], ROOM, "right");
    expect(rightCoverage).toEqual([{ start: 0, end: 24 }]);
  });

  it("puts the return-wall leg at the vertex the corner really owns, not the far end", () => {
    // REGRESSION: the corner's own along-wall offset was compared against the
    // RETURN wall's frame, so a corner seated at the top/right vertex wrote its
    // leg at the far end of the right wall — coverage where no corner stands, and
    // none where it does.
    const topLeft = placedCabinet({
      uid: "lsb-top", code: "LSB36", width: 36, wall: "top", along: 0, placement: "base",
      description: "36 inch Lazy Susan Corner Base", subCategory: "Lazy Susan",
    });
    const bottomRight = placedCabinet({
      uid: "lsb-bottom", code: "LSB36", width: 36, wall: "bottom", along: 132, placement: "base",
      description: "36 inch Lazy Susan Corner Base", subCategory: "Lazy Susan",
    });
    const left = { ...topLeft, cornerType: "lazy-susan" } as PlacedCabinet;
    const right = { ...bottomRight, cornerType: "lazy-susan" } as PlacedCabinet;
    // Top-left vertex: leg opens at the start of the left wall.
    expect(cornerLegSpanOnWall(left, "left", ROOM)).toEqual({ start: 0, end: 24 });
    // Bottom-right vertex: the bottom wall's run end is at 168, the right wall's at 132.
    expect(cornerLegSpanOnWall(right, "right", ROOM)).toEqual({ start: 108, end: 132 });
    expect(cornerLegSpanOnWall(right, "bottom", ROOM)).toEqual({ start: 132, end: 168 });
  });

  it("names a wall cabinet that hangs entirely over bare wall, and keeps the one over counter", () => {
    const base = placedCabinet({ uid: "b1", code: "B36", width: 36, wall: "top", along: 0, placement: "base" });
    const overBase = placedCabinet({ uid: "w1", code: "W3630", width: 36, wall: "top", along: 0, placement: "wall" });
    const stray = placedCabinet({ uid: "w2", code: "W1230", width: 12, wall: "top", along: 60, placement: "wall" });
    expect(uppersOutsideRun({ placed: [base, overBase], room: ROOM, wallId: "top" })).toEqual([]);
    expect(uppersOutsideRun({ placed: [base, overBase, stray], room: ROOM, wallId: "top" }).map((item) => item.uid)).toEqual(["w2"]);
  });

  it("reports an opening with counter below it, and never the deliberate bays", () => {
    const sink = placedCabinet({
      uid: "sb", code: "SB36", width: 36, wall: "top", along: 12, placement: "base",
      description: '36" Sink Base', subCategory: "Sink Base",
    });
    const base = placedCabinet({ uid: "b1", code: "B48", width: 48, wall: "top", along: 48, placement: "base" });
    // No upper at all: the sink base and the 48 inch run beside it both have counter.
    expect(upperCoverageGaps({ placed: [sink, base], room: ROOM, wallId: "top" })).toEqual([{ start: 12, end: 96 }]);
    // A cover over the whole run resolves it.
    const upper = placedCabinet({ uid: "w1", code: "W8430", width: 84, wall: "top", along: 12, placement: "wall" });
    expect(upperCoverageGaps({ placed: [sink, base, upper], room: ROOM, wallId: "top" })).toEqual([]);
    // A window over the sink is a deliberate bay, not a defect: the sink base and
    // the window's own 3 inch clearance each side read as "expected open".
    const window: WallOpening = { uid: "win", kind: "window", label: "Sink window", side: "top", offset: 12, width: 36, height: 36, sill: 42 };
    expect(deliberateUpperBays([sink], ROOM, "top", [window])).toEqual([{ start: 9, end: 51 }]);
    // The gap that remains is only the sink base's own span, which a window covers.
    expect(upperCoverageGaps({ placed: [sink], room: ROOM, wallId: "top", openings: [window] })).toEqual([]);
    expect(upperCoverageGaps({ placed: [sink], room: ROOM, wallId: "top" })).toEqual([{ start: 12, end: 48 }]);
  });

  it("never asks for an upper over the range or over the refrigerator", () => {
    const range = placedCabinet({
      uid: "range", code: "RANGE-30", width: 30, wall: "right", along: 48, placement: "appliance",
      depth: 25, height: 36, description: '30" Gas Range', subCategory: "Appliance",
    });
    const fridge = placedCabinet({
      uid: "fridge", code: "FRIDGE-36", width: 36, wall: "right", along: 0, placement: "appliance",
      depth: 30, height: 70, description: '36" Refrigerator', subCategory: "Appliance",
    });
    expect(upperCoverageGaps({ placed: [range, fridge], room: ROOM, wallId: "right" })).toEqual([]);
    expect(deliberateUpperBays([range, fridge], ROOM, "right").map((bay) => [bay.start, bay.end])).toEqual([[0, 36], [48, 78]]);
  });

  it("only offers an upper width that stops at the run end instead of overhanging it", () => {
    expect(widestUpperWithin([12, 18, 24, 30, 36], 21)).toBe(18);
    expect(widestUpperWithin([12, 18, 24], 6)).toBeNull();
    expect(MIN_UPPER_GAP_IN).toBe(9);
  });
});

function upperStage(placed: readonly PlacedCabinet[], openings: readonly WallOpening[] = []) {
  return buildAutoDesignWallCabinets({
    placed: [...placed],
    room: ROOM,
    openings: [...openings],
    catalog: WALLS,
    wallCabinetHeightIn: 30,
    styleId: 330011,
    makeUid: (() => { let n = 0; return () => `up-${++n}`; })(),
    catalogFillers: FILLERS,
    closeSeams: true,
  });
}

describe("the built upper run lines up with the bases under it", () => {
  it("drops a stray upper that stands over bare wall past the end of the run", () => {
    const base = placedCabinet({ uid: "b1", code: "B36", width: 36, wall: "top", along: 0, placement: "base" });
    const stray = placedCabinet({ uid: "stray", code: "W1230", width: 12, wall: "top", along: 108, placement: "wall" });
    const result = upperStage([base, stray]);
    expect(result.placed.some((item) => item.uid === "stray")).toBe(false);
    expect(result.skipped.join(" ")).toMatch(/no base cabinet, corner or tall box stands under it/i);
    const runEnd = Math.max(...result.additions.map((item) => wallRunOffset(item, "top", ROOM) + wallRunSpan(item, "top", ROOM)));
    // Nothing the pass added hangs past the 36 inch base.
    expect(runEnd).toBeLessThanOrEqual(36 + 0.05);
  });

  it("closes an opening left over counter with real wall cabinets, never filler", () => {
    const base = placedCabinet({ uid: "b1", code: "B48", width: 48, wall: "top", along: 0, placement: "base" });
    const result = upperStage([base]);
    expect(upperCoverageGaps({ placed: result.placed, room: ROOM, wallId: "top" })).toEqual([]);
    const overRun = result.additions.filter((item) => item.placement === "wall");
    expect(overRun.length).toBeGreaterThan(0);
    expect(overRun.every((item) => item.cabinetId > 0)).toBe(true);
    expect(overRun.some((item) => /filler|scribe/i.test(`${item.masterCode} ${item.description ?? ""}`))).toBe(false);
  });

  it("ends the run where the base run ends when a tall box takes the last span", () => {
    const base = placedCabinet({ uid: "b1", code: "B36", width: 36, wall: "top", along: 0, placement: "base" });
    const pantry = placedCabinet({
      uid: "t1", code: "UOC3390", width: 33, wall: "top", along: 36, placement: "tall",
      description: "33x90 Oven Pantry", subCategory: "Oven Tower",
    });
    const result = upperStage([base, pantry]);
    const uppers = result.additions.filter((item) => item.placement === "wall" && !item.fillerPieceGroupId);
    expect(uppers.length).toBeGreaterThan(0);
    // No ordinary upper is seated over the tall box's own span.
    for (const upper of uppers) {
      const start = wallRunOffset(upper, "top", ROOM);
      const end = start + wallRunSpan(upper, "top", ROOM);
      expect(end).toBeLessThanOrEqual(36 + 0.05);
    }
  });

  it("keeps the alignment gates: ceiling, window clearance and no collision", () => {
    const base = placedCabinet({ uid: "b1", code: "B48", width: 48, wall: "top", along: 0, placement: "base" });
    // A wall that stops below a 30 inch upper's top line (54 + 30 = 84).
    const shortRoom: RoomData = { ...ROOM, ceilingHeight: 84 };
    const result = buildAutoDesignWallCabinets({
      placed: [base], room: shortRoom, openings: [], catalog: WALLS, wallCabinetHeightIn: 30,
      styleId: 330011, makeUid: (() => { let n = 0; return () => `c-${++n}`; })(), catalogFillers: FILLERS, closeSeams: true,
    });
    // 84 is the model's minimum ceiling and a 54 + 30 upper tops exactly on it, so
    // the uppers seat. A wall override below that top line is what blocks them.
    expect(result.additions.filter((item) => item.placement === "wall").length).toBeGreaterThan(0);
    const tooLow: RoomData = { ...ROOM, wallCeilings: { top: { high: 84, low: 84 } }, ceilingHeight: 84 };
    const blocked = buildAutoDesignWallCabinets({
      placed: [base], room: { ...tooLow, ceilingHeight: 84 }, openings: [], catalog: WALLS, wallCabinetHeightIn: 42,
      styleId: 330011, makeUid: (() => { let n = 0; return () => `d-${++n}`; })(), catalogFillers: FILLERS, closeSeams: true,
    });
    // A 42 inch upper at the 54 inch datum tops at 96, over an 84 inch wall.
    expect(blocked.additions.filter((item) => item.placement === "wall")).toEqual([]);
  });
});

function buildKitchen(overrides: Partial<AutoDesignInputs> = {}): AutoDesignLayoutSuccess {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "u-shape",
      originCorner: "left",
      runDirection: "right",
      wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 3", centerOffsetIn: 30 },
      sinkBaseWidthIn: 36,
      sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 60 },
      skipDishwasher: false,
      dishwasher: null,
      dishwasherSide: "right",
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 30 },
      refrigeratorWidthIn: 36,
      tallCabinets: null,
      ...overrides,
    } as AutoDesignInputs,
    room: { width: 168, depth: 132, ceilingHeight: 96, openWallPath: false } as RoomData,
    openings: [],
    baseCatalog: BASES,
    wallCatalog: WALLS,
    fillers: FILLERS,
    appliancePalette: [
      { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", height: "36", depth: "25", placement: "appliance" } as DesignCabinet,
      { id: 0, masterCode: "DW-24", description: '24" Dishwasher', category: "Appliance", subCategory: "Appliance", width: "24", height: "34.5", depth: "24", placement: "appliance" } as DesignCabinet,
      { id: 0, masterCode: "FRIDGE-36", description: '36" Refrigerator', category: "Appliance", subCategory: "Appliance", width: "36", height: "70", depth: "30", placement: "appliance" } as DesignCabinet,
    ],
    refrigeratorCaps: WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
    refrigeratorEndPanels: (REAL[STYLE]!.accessory as DesignCabinet[]).filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`)),
    tallCatalog: TALL,
    styleId: 330011,
    makeUid: () => `k-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

describe("the finished kitchen has no upper off its base run", () => {
  it("keeps every wall cabinet over real floor coverage on every built wall", () => {
    const room = { width: 168, depth: 132, ceilingHeight: 96, openWallPath: false } as RoomData;
    for (const sinkCenter of [18, 30, 36, 48]) {
      const result = buildKitchen({ sink: { wallLabel: "Wall 3", centerOffsetIn: sinkCenter } });
      for (const wall of ["top", "right", "bottom"] as const) {
        const strays = uppersOutsideRun({ placed: result.placed, room, wallId: wall })
          // A hood hangs at its own datum, and the refrigerator assembly's own 3 inch
          // clearance fillers are flat stock, not ordinary wall cabinets.
          .filter((item) => !/hood/i.test(item.masterCode))
          .filter((item) => !item.fillerPieceGroupId && !/filler|scribe/i.test(`${item.masterCode} ${item.description ?? ""}`));
        expect(strays.map((item) => item.masterCode), `wall ${wall} sink ${sinkCenter}`).toEqual([]);
      }
    }
  });

  it("leaves no opening with counter below it outside the deliberate bays", () => {
    const room = { width: 168, depth: 132, ceilingHeight: 96, openWallPath: false } as RoomData;
    const result = buildKitchen();
    for (const wall of ["top", "right", "bottom"] as const) {
      expect(upperCoverageGaps({ placed: result.placed, room, wallId: wall, openings: result.openings }), `wall ${wall}`).toEqual([]);
    }
  });

  it("runs the uppers from the same start to the same end as the base run on each wall", () => {
    const room = { width: 168, depth: 132, ceilingHeight: 96, openWallPath: false } as RoomData;
    const result = buildKitchen();
    for (const wall of ["top", "right", "bottom"] as const) {
      const alignable = upperAlignableSpan(result.placed, room, wall);
      if (!alignable) continue;
      const uppers = result.placed
        .filter((item) => cabinetWall(item, room) === wall
          && item.placement === "wall"
          && !/hood/i.test(item.masterCode)
          && (item as { overRangeMicrowaveBridge?: boolean }).overRangeMicrowaveBridge !== true)
        .map((item) => wallRunOffset(item, wall, room));
      if (!uppers.length) continue;
      // The upper run begins at the first real floor box on the wall.
      expect(Math.min(...uppers), `wall ${wall} start`).toBeCloseTo(alignable.start, 1);
    }
  });
});

/**
 * Budget friendly standing rules (Tom, Nov 19 2026, voice call bf67).
 *  1. Countertop runs all the way back to the wall at an inside corner.
 *  2. No refrigerator end panels; the cabinet over the refrigerator is 12 in deep.
 *  3. The run re-flows for the shifted refrigerator (slides flush to a free wall end, stock widths, no sliver).
 *  4. An empty inside upper corner gets the line's diagonal corner wall cabinet.
 *  5. All of it applies automatically when Budget friendly is picked, with a report line each, and
 *     none of it changes a build that did not pick Budget friendly.
 */
import { describe, expect, it } from "vitest";
import aero from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { BUDGET_REFRIGERATOR_CAP_DEPTH_IN, pickAutoDesignRefrigeratorCap } from "./autoDesignRefrigeratorBay";
import {
  appliancesForRoom, applianceAsDesignCabinet, cabinetWall, countertopSurfaces, isRefrigerator, wallPlacementAt, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall?: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const pack = aero as unknown as Pack;
const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function build(opts: { budget: boolean; fridgeCenter?: number; stoveCenter?: number; sinkCenter?: number; wall?: DesignCabinet[] }) {
  let uid = 0;
  const wall = opts.wall ?? pack.wall;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: opts.fridgeCenter ?? 22 }, refrigeratorWidthIn: 36,
      stove: { wallLabel: "Wall 1", centerOffsetIn: opts.stoveCenter ?? 105 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: opts.sinkCenter ?? 70 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      dishwasherSide: "none", skipDishwasher: true, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: {
        ...emptyAutoDesignIntake(), construction: "new", preferences: opts.budget ? ["budget-friendly"] : [], islandOrPeninsula: "none",
        canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true },
      },
    } as never,
    room: ROOM, openings: [], baseCatalog: pack.base, wallCatalog: wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])],
    styleId: 390019, makeUid: () => `b-${++uid}`,
  } as never) as unknown as {
    ok: boolean; message?: string; placed: PlacedCabinet[]; notes: string[]; skippedUppers: string[];
  };
  if (!result.ok) throw new Error(result.message ?? "build failed");
  return result;
}

const bridgeOf = (placed: PlacedCabinet[]) => placed.find((item) => item.refrigeratorAssemblyRole === "bridge");
const fridgeOf = (placed: PlacedCabinet[]) => placed.find((item) => isRefrigerator(item))!;
const panelsOf = (placed: PlacedCabinet[]) => placed.filter((item) => /^REP/i.test(item.masterCode) || item.refrigeratorAssemblyRole === "left-panel" || item.refrigeratorAssemblyRole === "right-panel");

describe("Budget friendly: no refrigerator end panels, 12-inch cabinet above", () => {
  const budget = build({ budget: true });
  const normal = build({ budget: false });

  it("outside budget mode the bay is unchanged: two REPV panels, a 24-deep cabinet, the 24-in clamp note", () => {
    expect(panelsOf(normal.placed)).toHaveLength(2);
    expect(bridgeOf(normal.placed)!.depth).toBe(24);
    expect(bridgeOf(normal.placed)!.masterCode).toBe("W361224");
    expect(Number(fridgeOf(normal.placed).depth)).toBe(24);
    expect(normal.notes.some((note) => note.includes('stays inside its end panels'))).toBe(true);
    expect(normal.notes.some((note) => note.startsWith("Budget friendly"))).toBe(false);
  });

  it("budget mode places no refrigerator end panel at all", () => {
    expect(panelsOf(budget.placed)).toHaveLength(0);
    expect(budget.placed.some((item) => item.subCategory === "Refrigerator End Panel")).toBe(false);
    expect(budget.notes.some((note) => note.includes("stays inside its end panels"))).toBe(false);
    expect(budget.notes.some((note) => note.includes("no refrigerator end panels"))).toBe(true);
  });

  it("the cabinet over the refrigerator is a real 12-inch-deep SKU of the line, centered on the appliance, against the wall", () => {
    const bridge = bridgeOf(budget.placed)!;
    expect(bridge.depth).toBe(BUDGET_REFRIGERATOR_CAP_DEPTH_IN);
    expect(bridge.masterCode).toBe("W3612");
    expect(pack.wall.some((row) => row.masterCode === bridge.masterCode)).toBe(true);
    const fridge = fridgeOf(budget.placed);
    const wall = cabinetWall(fridge, ROOM);
    expect(wallRunOffset(bridge, wall, ROOM)).toBeCloseTo(wallRunOffset(fridge, wall, ROOM), 2);
    expect(wallRunSpan(bridge, wall, ROOM)).toBeCloseTo(wallRunSpan(fridge, wall, ROOM), 2);
    // Not pulled forward flush with the appliance: no 24-in panel plane exists.
    expect(bridge.depthPositionAdjusted).not.toBe(true);
    expect(Number(bridge.y)).toBeCloseTo(0, 2);
    expect(budget.notes.some((note) => note.includes("W3612 above the refrigerator is 12″ deep"))).toBe(true);
  });

  it("budget mode keeps the appliance at its own depth (no 24-in clamp) and stamps panels off", () => {
    expect(Number(fridgeOf(budget.placed).depth)).toBe(30);
    expect(fridgeOf(budget.placed).refrigeratorPanelMode).toBe("none");
  });

  it("when the line has no 12-deep box at the width, it uses the closest real option and says so", () => {
    const caps = pack.wall.filter((row) => !(Math.abs(Number(row.width) - 36) < 0.01 && Math.abs(Number(row.depth) - 12) < 0.01));
    const pick = pickAutoDesignRefrigeratorCap(caps, 70, 30, 96, false, 36, BUDGET_REFRIGERATOR_CAP_DEPTH_IN);
    expect(pick).not.toBeNull();
    expect(pack.wall.some((row) => row.masterCode === pick!.cabinet.masterCode)).toBe(true);
    expect(pick!.substitutionNote).toContain("36x12 not in line");
    // The default (non-budget) pick is still the 24-deep box.
    expect(pickAutoDesignRefrigeratorCap(pack.wall, 70, 30, 96, false, 36)!.cabinet.depth).toBe("24.000");
  });
});

describe("Budget friendly: the run re-flows for the shifted refrigerator", () => {
  it("a refrigerator a few inches off the free wall end slides flush to it, so no filler is left beside it", () => {
    const budget = build({ budget: true, fridgeCenter: 22 });
    const fridge = fridgeOf(budget.placed);
    expect(wallRunOffset(fridge, "top", ROOM)).toBeCloseTo(0, 2);
    expect(budget.notes.some((note) => note.includes("refrigerator slid 4″ flush to the wall end"))).toBe(true);
    const fillersAtEnd = budget.placed.filter((item) => item.placement === "base" && cabinetWall(item, ROOM) === "top"
      && /filler/i.test(`${item.description}`) && wallRunOffset(item, "top", ROOM) < 5);
    expect(fillersAtEnd).toHaveLength(0);
    // The run next to the refrigerator starts exactly at its face (no panel, no clearance board).
    const next = budget.placed.filter((item) => item.placement === "base" && cabinetWall(item, ROOM) === "top" && !isRefrigerator(item))
      .sort((a, b) => wallRunOffset(a, "top", ROOM) - wallRunOffset(b, "top", ROOM))[0]!;
    expect(wallRunOffset(next, "top", ROOM)).toBeCloseTo(36, 2);
  });

  it("outside budget mode the refrigerator is never slid", () => {
    const normal = build({ budget: false, fridgeCenter: 22 });
    expect(wallRunOffset(fridgeOf(normal.placed), "top", ROOM)).toBeCloseTo(4, 2);
    expect(normal.notes.some((note) => note.includes("flush to the wall end (no end panels)"))).toBe(false);
  });

  it("a refrigerator that already sits flush, or far from the wall end, is left where it was measured", () => {
    const far = build({ budget: true, fridgeCenter: 40 });
    expect(wallRunOffset(fridgeOf(far.placed), "top", ROOM)).toBeCloseTo(22, 2);
    expect(far.notes.some((note) => note.includes("flush to the wall end (no end panels)"))).toBe(false);
  });
});

describe("Budget friendly: diagonal corner wall cabinet in an empty upper corner", () => {
  it("seats the line's diagonal corner wall cabinet at the open corner, ahead of the straight uppers", () => {
    const budget = build({ budget: true });
    const diagonal = budget.placed.find((item) => item.placement === "wall" && /^DCW/.test(item.masterCode));
    expect(diagonal).toBeTruthy();
    expect(pack.wall.some((row) => row.masterCode === diagonal!.masterCode)).toBe(true);
    expect(budget.skippedUppers.some((reason) => reason.includes("Upper runs do not meet"))).toBe(false);
    expect(budget.notes.some((note) => note.includes("diagonal corner wall cabinet DCW2430 seated"))).toBe(true);
    // Nothing overlaps it on either wall.
    const overlaps = budget.placed.filter((item) => item.uid !== diagonal!.uid && item.placement === "wall" && !/filler|spacer/i.test(item.description ?? "")
      && Math.abs(Number(item.x) - Number(diagonal!.x)) < 24 && Math.abs(Number(item.y) - Number(diagonal!.y)) < 24 && cabinetWall(item, ROOM) === cabinetWall(diagonal!, ROOM)
      && wallRunOffset(item, cabinetWall(item, ROOM), ROOM) < wallRunOffset(diagonal!, cabinetWall(item, ROOM), ROOM) + wallRunSpan(diagonal!, cabinetWall(item, ROOM), ROOM) - 0.1
      && wallRunOffset(item, cabinetWall(item, ROOM), ROOM) + wallRunSpan(item, cabinetWall(item, ROOM), ROOM) > wallRunOffset(diagonal!, cabinetWall(item, ROOM), ROOM) + 0.1);
    expect(overlaps).toHaveLength(0);
  });

  it("without budget mode the existing behavior is kept: no diagonal is added by this rule", () => {
    const normal = build({ budget: false });
    expect(normal.placed.some((item) => item.placement === "wall" && /^DCW/.test(item.masterCode))).toBe(false);
  });

  it("a line with no diagonal corner wall cabinet is reported, not invented", () => {
    const withoutDiagonals = pack.wall.filter((row) => !/^DCW|^WER|^WBC/.test(row.masterCode));
    const budget = build({ budget: true, wall: withoutDiagonals });
    expect(budget.placed.some((item) => /^DCW/.test(item.masterCode))).toBe(false);
    expect(budget.skippedUppers.some((reason) => reason.includes("this line sells no diagonal corner wall cabinet"))
      || budget.skippedUppers.some((reason) => reason.includes("Upper runs do not meet"))).toBe(true);
  });
});

describe("Countertop runs all the way back to the wall at an inside corner", () => {
  const cab = (o: Partial<PlacedCabinet>): PlacedCabinet => ({
    uid: "u", cabinetId: 1, masterCode: "B-36", description: "Base", placement: "base",
    x: 0, y: 0, width: 36, depth: 24, rotation: 0, height: 34.5, ...o,
  } as PlacedCabinet);
  const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
  const run = (wallId: string, offs: number[], w: number, prefix: string) => offs.map((o, i) => {
    const spot = wallPlacementAt(o, w, 24, wallId as never, room);
    return cab({ uid: `${prefix}${i}`, width: w, ...spot, wallId, wallOffset: o });
  });

  it("fills the open corner out to both walls when the top-wall run ends at a range short of the corner", () => {
    const top = [...run("top", [0], 36, "t"), ...run("top", [36], 36, "u"), ...run("top", [72], 18, "v")];
    const range = cab({ uid: "range", masterCode: "RANGE-30", description: "30 range", placement: "appliance", width: 30, depth: 25, height: 36, ...wallPlacementAt(90, 30, 25, "top", room), wallId: "top", wallOffset: 90 });
    const right = run("right", [25, 61], 36, "r");
    const fill = countertopSurfaces([...top, range, ...right], room, null).find((surface) => surface.cabinetRunId?.startsWith("corner-fill"));
    expect(fill).toBeTruthy();
    // Back to the top wall (y = 0) and the right wall (x = 144).
    expect(fill!.y).toBeCloseTo(0, 1);
    expect(fill!.x + fill!.width).toBeCloseTo(144, 1);
    // Stops at the range, never over it.
    expect(fill!.x).toBeGreaterThanOrEqual(120 - 0.1);
  });

  it("still fills the whole square when both runs reach the corner (previous behavior)", () => {
    const top = run("top", [72], 36, "t");
    const right = run("right", [10], 36, "r");
    const fill = countertopSurfaces([...top, ...right], room, null).find((surface) => surface.cabinetRunId?.startsWith("corner-fill"));
    expect(fill).toBeTruthy();
    expect(fill!.width).toBeCloseTo(25.5, 1);
  });

  it("a Budget friendly build reports the corner top it added", () => {
    const budget = build({ budget: true });
    expect(budget.notes.some((note) => note.includes("the countertop runs all the way back to the wall"))).toBe(true);
  });
});

describe("Budget friendly: no spacer between cabinets (Tom, Nov 19 2026, 6:33 AM CT)", () => {
  const pieceRe = /filler|scribe|skin|spacer|end panel/i;
  const isSpacerPiece = (item: PlacedCabinet) => item.category === "Filler" || item.category === "Panels" || item.subCategory === "End panel" || item.subCategory === "Filler"
    || /^(WSV|BSV|USV|REP|F\d)/i.test(item.masterCode) || pieceRe.test(`${item.description ?? ""} ${item.subCategory ?? ""}`);
  const wallRun = (placed: PlacedCabinet[], wallId: string) => placed.filter((item) => item.placement === "wall" && cabinetWall(item, ROOM) === wallId && !/^DCW/.test(item.masterCode))
    .sort((a, b) => wallRunOffset(a, wallId as never, ROOM) - wallRunOffset(b, wallId as never, ROOM));

  it("the 144x120 L budget build places no spacer, filler or end panel anywhere, and the top-wall uppers touch with no gap", () => {
    const budget = build({ budget: true });
    expect(budget.placed.filter(isSpacerPiece).map((item) => item.masterCode)).toEqual([]);
    expect(budget.placed.some((item) => item.masterCode === "WSV30")).toBe(false);
    const top = wallRun(budget.placed, "top");
    expect(top.map((item) => item.masterCode)).toEqual(["W3612", "W2130", "W2130", "W1230", "W3012"]);
    let edge = 0;
    for (const item of top) {
      expect(wallRunOffset(item, "top", ROOM)).toBeCloseTo(edge, 2);
      edge += wallRunSpan(item, "top", ROOM);
    }
    expect(edge).toBeCloseTo(120, 2);
    // Every SKU is a real row of the line; nothing invented or renamed.
    for (const item of top) expect(pack.wall.some((row) => row.masterCode === item.masterCode)).toBe(true);
  });

  it("budget mode reports the spacer was skipped and where the leftover went", () => {
    const budget = build({ budget: true });
    const line = budget.notes.find((note) => note.startsWith("Budget friendly: spacer skipped."));
    expect(line).toBeTruthy();
    expect(line).toMatch(/leftover/);
  });

  it("a Budget build keeps the right wall as before (W3612 over the fridge-side run, W3330 at the end)", () => {
    const right = wallRun(build({ budget: true }).placed, "right");
    expect(right.map((item) => item.masterCode)).toEqual(["W2730", "W3612", "W3330"]);
  });

  it("outside budget mode nothing changes: the 3/4 in WSV30 end panel and the W3630 + W1230 uppers are still placed, no spacer report", () => {
    const normal = build({ budget: false });
    const top = wallRun(normal.placed, "top");
    expect(top.map((item) => item.masterCode)).toEqual(["W361224", "W3630", "W1230", "WSV30", "W3012"]);
    expect(wallRunOffset(top[3]!, "top", ROOM)).toBeCloseTo(89.25, 2);
    expect(normal.notes.some((note) => note.includes("spacer skipped"))).toBe(false);
  });
});

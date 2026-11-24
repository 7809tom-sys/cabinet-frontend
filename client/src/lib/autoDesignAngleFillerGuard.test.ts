import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { enforceCornerFillersAtEveryAngle, MIN_CORNER_BOARD_IN } from "./autoDesignAngleFillerGuard";
import { isBannedAutoDesignFiller } from "./catalogFiller";
import { autoDesignCorners } from "./autoDesignWallList";
import {
  appliancesForRoom, applianceAsDesignCabinet, isFillerItem, wallPlacementAt, wallRunFrame, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening, type WallSide,
} from "./design";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] };
const PACK = (realCatalog as unknown as Record<string, Pack>)["330011"]!;

function fiveWall(): RoomData {
  const L = 138;
  return { width: 204, depth: 210, ceilingHeight: 96, openWallPath: true,
    vertices: [{ id: "v1", x: 0, y: 0 }, { id: "v2", x: L, y: 0 }, { id: "v3", x: L + 66, y: 66 }, { id: "v4", x: L + 66, y: 144 }, { id: "v5", x: L, y: 210 }, { id: "v6", x: 40, y: 210 }],
    customWalls: [
      { id: "top", label: "Wall 1", startVertexId: "v1", endVertexId: "v2" },
      { id: "angTR", label: "Wall 2", startVertexId: "v2", endVertexId: "v3", lockedAngle: 45 },
      { id: "right", label: "Wall 3", startVertexId: "v3", endVertexId: "v4" },
      { id: "angBR", label: "Wall 4", startVertexId: "v4", endVertexId: "v5", lockedAngle: 45 },
      { id: "bottom", label: "Wall 5", startVertexId: "v5", endVertexId: "v6" },
    ] } as RoomData;
}
function chamferL(): RoomData {
  return { width: 150, depth: 144, ceilingHeight: 96, openWallPath: true,
    vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 120, y: 0 }, { id: "c", x: 150, y: 30 }, { id: "d", x: 150, y: 144 }],
    customWalls: [
      { id: "w1", label: "Wall 1", startVertexId: "a", endVertexId: "b" },
      { id: "w2", label: "Wall 2", startVertexId: "b", endVertexId: "c", lockedAngle: 45 },
      { id: "w3", label: "Wall 3", startVertexId: "c", endVertexId: "d" },
    ] } as RoomData;
}
/** Two walls meeting at a 120° inside angle (a 60° turn): the "odd angle" case. */
function oddAngle(): RoomData {
  const c = Math.cos(Math.PI / 3), s = Math.sin(Math.PI / 3);
  return { width: 220, depth: 140, ceilingHeight: 96, openWallPath: true,
    vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 120, y: 0 }, { id: "c", x: 120 + 120 * c, y: 120 * s }],
    customWalls: [
      { id: "o1", label: "Wall 1", startVertexId: "a", endVertexId: "b" },
      { id: "o2", label: "Wall 2", startVertexId: "b", endVertexId: "c" },
    ] } as RoomData;
}

const intake = (budget: boolean) => ({ ...emptyAutoDesignIntake(), construction: "new", preferences: budget ? ["budget-friendly"] : [], islandOrPeninsula: "none",
  canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } });

function build(room: RoomData, openings: WallOpening[], budget: boolean, input: Record<string, unknown>) {
  let uid = 0;
  return runAutoDesignLayout({
    input: { originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge", kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: intake(budget), ...input } as never,
    room, openings, baseCatalog: PACK.base, wallCatalog: PACK.wall, fillers: PACK.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(PACK.wall, []),
    refrigeratorEndPanels: PACK.accessory.filter((r) => /^REP/.test(r.masterCode)), tallCatalog: [], panelCatalog: PACK.accessory,
    styleId: 330011, makeUid: () => `t-${++uid}`,
  } as never) as { ok: boolean; placed: PlacedCabinet[]; notes: string[]; message?: string };
}

const band = (item: PlacedCabinet) => (item.placement === "wall" ? "wall" : "base");
function isOccupant(item: PlacedCabinet) {
  if (isFillerItem(item) || !item.wallId) return false;
  if (item.placement === "wall") return true;
  if (item.placement === "base" || item.placement === "tall") return true;
  return item.placement === "appliance" && Number(item.mountBottom ?? 0) <= 1 && !/hood|MW|microwave/i.test(`${item.masterCode} ${item.description}`);
}

/** Corners × sides × bands where a cabinet or appliance sits on the run but no filler closes the corner. */
function missingCornerSides(room: RoomData, placed: PlacedCabinet[], notes: readonly string[] = []) {
  const missing: string[] = [];
  for (const corner of autoDesignCorners(room).filter((c) => c.inside && Math.abs(c.angleDeg - 90) > 1 && c.angleDeg < 178)) {
    for (const side of [{ wallId: corner.wallId, at: corner.wallAt }, { wallId: corner.neighborWallId, at: corner.neighborAt }]) {
      const length = wallRunFrame(side.wallId, room)!.length;
      const near = (item: PlacedCabinet) => {
        const o = wallRunOffset(item, side.wallId, room); const w = wallRunSpan(item, side.wallId, room);
        return side.at === "start" ? o : length - (o + w);
      };
      for (const b of ["base", "wall"] as const) {
        const occ = placed.filter((item) => item.wallId === side.wallId && isOccupant(item) && (band(item) === b || item.placement === "tall"))
          .sort((x, y) => near(x) - near(y))[0];
        if (!occ) continue;
        if (b === "wall" && occ.placement === "tall") continue;
        const depth = b === "wall" ? 12 : 24;
        const miter = depth / Math.tan(((corner.angleDeg / 2) * Math.PI) / 180);
        const gap = near(occ) - miter;
        if (gap > 0 && gap < MIN_CORNER_BOARD_IN) continue; // a sub-1/2 in gap is logged, not cut
        const closed = placed.some((item) => item.wallId === side.wallId && isFillerItem(item) && band(item) === (occ.placement === "tall" ? "base" : b) && near(item) < near(occ) + 0.25);
        // Never silent: a side the check could not close carries a review note naming it.
        const reported = notes.some((note) => note.includes(`${side.wallId} ${b === "wall" ? "upper" : "base"} row`) && /left for review|under 1\/2 in/.test(note));
        if (!closed && !reported) missing.push(`${side.wallId}/${b} @${corner.angleDeg}° beside ${occ.masterCode} (gap ${gap.toFixed(2)})`);
      }
    }
  }
  return missing;
}

const win45: WallOpening = { uid: "w45", kind: "window", label: "Window 36\"", side: "angTR", offset: 20, width: 36, height: 42, sill: 42 } as WallOpening;
const fiveWallInput = { layoutType: "u-shape", sink: { wallLabel: "Wall 2", centerOffsetIn: 36 }, stove: { wallLabel: "Wall 3", centerOffsetIn: 39 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, dishwasher: { wallLabel: "Wall 2", centerOffsetIn: 70.34 } };
const chamferInput = { layoutType: "u-shape", sink: { wallLabel: "Wall 1", centerOffsetIn: 66 }, stove: { wallLabel: "Wall 3", centerOffsetIn: 60 }, refrigerator: { wallLabel: "Wall 3", centerOffsetIn: 96 }, refrigeratorWidthIn: 36 };

const CASES = [
  { name: "five-wall 45° U, standard, dishwasher at the Wall 2 / Wall 3 vertex", room: fiveWall, openings: [win45], budget: false, input: fiveWallInput },
  { name: "five-wall 45° U, budget friendly", room: fiveWall, openings: [win45], budget: true, input: fiveWallInput },
  { name: "chamfered L, standard", room: chamferL, openings: [], budget: false, input: chamferInput },
  { name: "chamfered L, budget friendly", room: chamferL, openings: [], budget: true, input: chamferInput },
];

describe("every recognized angle gets its plain corner filler on both sides (end-of-build check)", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const room = c.room();
      const result = build(room, c.openings, c.budget, c.input);
      expect(result.ok, result.message).toBe(true);
      if (process.env.DBG) console.log(c.name, result.notes.filter((n) => /Corner fillers/.test(n)));
      expect(missingCornerSides(room, result.placed, result.notes)).toEqual([]);
      // Never a fluted or BFF piece, and never two fillers stacked in one corner slot.
      const fillers = result.placed.filter(isFillerItem);
      expect(fillers.filter((f) => isBannedAutoDesignFiller(f))).toEqual([]);
    });
  }
});

describe("90° L: the configured blind-corner filler stays on every blind corner", () => {
  for (const budget of [false, true]) {
    it(budget ? "budget friendly" : "standard", () => {
      const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
      const result = build(room, [], budget, { layoutType: "l-shape", sink: { wallLabel: "Wall 1", centerOffsetIn: 72 }, stove: { wallLabel: "Wall 2", centerOffsetIn: 60 }, refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 } });
      expect(result.ok, result.message).toBe(true);
      const blinds = result.placed.filter((item) => /^(BBC|WBC)/i.test(item.masterCode) && item.placement === "base");
      for (const blind of blinds) expect(result.placed.some((item) => item.fillerForCabinetUid === blind.uid && isFillerItem(item))).toBe(true);
      expect(result.placed.filter(isFillerItem).filter((f) => isBannedAutoDesignFiller(f))).toEqual([]);
    });
  }
});

describe("the check itself", () => {
  const blanks = PACK.accessory as never;
  const room = oddAngle();
  function base(uid: string, wallId: string, offset: number, width = 30, code = `B${width}`): PlacedCabinet {
    const spot = wallPlacementAt(offset, width, 24, wallId as WallSide, room);
    return { uid, cabinetId: 1, masterCode: code, description: code, placement: "base", width, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 1, numberOfDrawers: 0, ...spot } as PlacedCabinet;
  }

  it("an odd 120° corner gets a plain board trimmed to the opening on each side, set at half the turn", () => {
    const miter = 24 / Math.tan((60 * Math.PI) / 180); // 13.86 in at a 120° inside angle
    const placed = [base("a", "o1", 120 - miter - 2.375 - 30), base("b", "o2", miter + 2.375)];
    let n = 0;
    const out = enforceCornerFillersAtEveryAngle({ placed, room, catalogFillers: blanks, makeUid: () => `f${++n}`, styleId: null });
    expect(out.inserted).toHaveLength(2);
    for (const piece of out.inserted) {
      expect(piece.cutIn).toBeCloseTo(2.375, 2);
      const item = out.placed.find((p) => p.uid === piece.uid)!;
      expect(item.fillerMiterAngle).toBeCloseTo(30, 3);
      expect(String(item.description)).toMatch(/trimmed to 2\.375/);
      expect(isBannedAutoDesignFiller(item)).toBe(false);
      // Flush: the board spans from the cabinet face to the miter line, no gap and no overlap.
      const owner = out.placed.find((p) => p.uid === piece.ownerUid)!;
      const o = wallRunOffset(item, item.wallId!, room); const w = wallRunSpan(item, item.wallId!, room);
      const oo = wallRunOffset(owner, owner.wallId!, room); const ow = wallRunSpan(owner, owner.wallId!, room);
      const touches = Math.min(Math.abs(o + w - oo), Math.abs(oo + ow - o));
      expect(touches).toBeLessThanOrEqual(1 / 16);
    }
    // Run again: nothing doubles.
    const again = enforceCornerFillersAtEveryAngle({ placed: out.placed, room, catalogFillers: blanks, makeUid: () => `g${++n}`, styleId: null });
    expect(again.inserted).toHaveLength(0);
  });

  it("an empty neighbor wall does not cancel the board on the occupied side", () => {
    const miter = 24 / Math.tan((60 * Math.PI) / 180);
    const placed = [base("a", "o1", 120 - miter - 3 - 30)];
    const out = enforceCornerFillersAtEveryAngle({ placed, room, catalogFillers: blanks, makeUid: () => "f", styleId: null });
    expect(out.inserted.map((p) => p.wallId)).toEqual(["o1"]);
  });

  it("a build shifts a cabinet sitting inside the miter just enough for a 1/2 in board; a hand placement never moves it", () => {
    const placed = [base("a", "o1", 120 - 30)]; // tight into the corner
    const built = enforceCornerFillersAtEveryAngle({ placed, room, catalogFillers: blanks, makeUid: () => "f", styleId: null, allowShift: true });
    expect(built.shifted).toHaveLength(1);
    expect(built.inserted[0].cutIn).toBeCloseTo(MIN_CORNER_BOARD_IN, 3);
    const manual = enforceCornerFillersAtEveryAngle({ placed, room, catalogFillers: blanks, makeUid: () => "f", styleId: null, allowShift: false });
    expect(manual.shifted).toHaveLength(0);
    expect(manual.flagged).toHaveLength(1);
    expect(manual.placed.find((p) => p.uid === "a")!.x).toBe(placed[0].x);
  });

  it("a gap under 1/2 in is skipped and logged", () => {
    const miter = 24 / Math.tan((60 * Math.PI) / 180);
    const placed = [base("a", "o1", 120 - miter - 0.25 - 30)];
    const out = enforceCornerFillersAtEveryAngle({ placed, room, catalogFillers: blanks, makeUid: () => "f", styleId: null });
    expect(out.inserted).toHaveLength(0);
    expect(out.skippedSmall).toHaveLength(1);
    expect(out.notes.join(" ")).toMatch(/under 1\/2 in/);
  });

  it("hand placement at a 45: placing a base by hand on the chamfer gets its corner board (manual hook scope)", () => {
    const l = chamferL();
    const spot = wallPlacementAt(9.94 + 3, 12, 24, "w2" as WallSide, l);
    const cab = { uid: "m", cabinetId: 1, masterCode: "B12", description: "B12", placement: "base", width: 12, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 1, numberOfDrawers: 0, ...spot } as PlacedCabinet;
    const out = enforceCornerFillersAtEveryAngle({ placed: [cab], room: l, catalogFillers: blanks, makeUid: () => "f", styleId: null, onlyWallIds: new Set(["w2"]) });
    expect(out.inserted).toHaveLength(1);
    expect(out.inserted[0].wallId).toBe("w2");
    expect(out.inserted[0].cutIn).toBeCloseTo(3, 1);
    expect(out.inserted[0].masterCode).toMatch(/^(F|BF)\d/);
  });

  it("a range at the 45° vertex owns the joint with its own front face (the build refuses a range in the corner clearance, so it is set by hand here)", () => {
    const l = chamferL();
    const shifted = wallPlacementAt(120 - 9.94 - 2 - 30, 30, 24, "w1" as WallSide, l);
    const range = { uid: "r", cabinetId: 9, masterCode: "RANGE-30", description: "30 in range", placement: "appliance", width: 30, depth: 24, height: 36, mountBottom: 0, rotation: 0, numberOfDoors: 0, numberOfDrawers: 0, ...shifted } as PlacedCabinet;
    const out = enforceCornerFillersAtEveryAngle({ placed: [range], room: l, catalogFillers: blanks, makeUid: () => "f", styleId: null });
    expect(out.inserted).toHaveLength(1);
    expect(out.inserted[0].ownerUid).toBe("r");
    expect(out.inserted[0].cutIn).toBeCloseTo(2, 2);
    expect(out.inserted[0].masterCode).toBe("F342");
  });
});

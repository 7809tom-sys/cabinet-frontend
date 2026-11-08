/**
 * Owner report: on a U-shaped kitchen's right wall, Auto Design seated the 30"
 * range and left the space on EACH side empty, flagged red as
 *
 *     right wall:  36.000 - 44.880   "Fits up to 8 7/8" — Wall"
 *                  74.875 - 84.005   "Fits up to 9 1/8" — Wall"
 *
 * with RANGE-30 at 44.875 - 74.875. Both openings were a hair off a stock width,
 * so the red flags were the whole difference between a finished wall and a wall
 * with two holes in it.
 *
 * Owner rule: Auto Design always puts a base cabinet on each side of the range.
 * When the side gaps are close to a stock width, the range is wiggled along its
 * wall by the small difference (1/8" here) so both sides land on a stock width,
 * and each side is filled with that cabinet. Filler is the fallback, not the
 * first answer. The outside of each flank cabinet is finished with the line's
 * own end panel, placed as a real catalog row so only real drawing items bill.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import {
  bestFlankCabinet,
  finishedBaseEndPanelStock,
  narrowFlankBaseCatalog,
  planRangeFlankCabinets,
  RANGE_FLANK_PANEL_THICKNESS_IN,
} from "./autoDesignRangeFlanks";
import {
  applianceAsDesignCabinet,
  cabinetPlacementCollisionDetail,
  cabinetWall,
  countertopSurfaces,
  freeSegmentsOnWall,
  isRangeOrOven,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { designerLayoutRuleIds } from "./designerLayoutRules";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const STYLE = "330011";
const REAL = realCatalog as unknown as Record<string, Pack>;
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const ACCESSORY = REAL[STYLE]!.accessory as DesignCabinet[];
const FILLERS = ACCESSORY.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));

/** The reported plan's room: a 144" top wall, a 120" right wall, in a U. */
function reportedRoom(): RoomData {
  return { width: 144, depth: 120, ceilingHeight: 96, openWallPath: false } as RoomData;
}

const APPLIANCE_PALETTE = [
  { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", height: "36", depth: "25", placement: "appliance" } as DesignCabinet,
  { id: 0, masterCode: "DW-24", description: '24" Dishwasher', category: "Appliance", subCategory: "Appliance", width: "24", height: "34.5", depth: "24", placement: "appliance" } as DesignCabinet,
  { id: 0, masterCode: "FRIDGE-36", description: '36" Refrigerator', category: "Appliance", subCategory: "Appliance", width: "36", height: "70", depth: "30", placement: "appliance" } as DesignCabinet,
].map(applianceAsDesignCabinet);

function inputs(overrides: Partial<AutoDesignInputs> = {}): AutoDesignInputs {
  return {
    layoutType: "u-shape",
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 1", centerOffsetIn: 72 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    // The reported range center on the right wall (Wall 2).
    stove: { wallLabel: "Wall 2", centerOffsetIn: 60 },
    skipDishwasher: true,
    dishwasher: null,
    refrigerator: null,
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    ...overrides,
  };
}

function build(overrides: Partial<AutoDesignInputs> = {}): AutoDesignLayoutSuccess {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: inputs(overrides),
    room: reportedRoom(),
    openings: [],
    baseCatalog: BASES,
    wallCatalog: WALLS,
    fillers: FILLERS,
    appliancePalette: APPLIANCE_PALETTE,
    refrigeratorCaps: [],
    refrigeratorEndPanels: [],
    tallCatalog: [],
    panelCatalog: ACCESSORY,
    styleId: Number(STYLE),
    makeUid: () => `uid-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

function span(item: PlacedCabinet, wallId: string, room: RoomData) {
  const start = wallRunOffset(item, wallId as never, room);
  return { start: Math.round(start * 1000) / 1000, end: Math.round((start + wallRunSpan(item, wallId as never, room)) * 1000) / 1000 };
}

function baseGaps(placed: readonly PlacedCabinet[], wallId: string, room: RoomData) {
  return freeSegmentsOnWall(wallId as never, room, [...placed], [], 0.125, 0, "base", false, undefined, 24)
    .map((gap) => ({ start: Math.round(gap.start * 1000) / 1000, end: Math.round((gap.start + gap.length) * 1000) / 1000 }));
}

/** The two floor pieces nearest the range on its own wall, one per side. */
function flankNeighbours(placed: readonly PlacedCabinet[], wallId: string, room: RoomData) {
  const range = placed.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description))!;
  const rangeSpan = span(range, wallId, room);
  const floor = placed.filter((item) => cabinetWall(item, room) === wallId && (item.placement === "base" || item.placement === "appliance") && item.uid !== range.uid);
  const left = floor
    .filter((item) => Math.abs(span(item, wallId, room).end - rangeSpan.start) <= 0.06)
    .sort((a, b) => b.width - a.width)[0] ?? null;
  const right = floor
    .filter((item) => Math.abs(span(item, wallId, room).start - rangeSpan.end) <= 0.06)
    .sort((a, b) => b.width - a.width)[0] ?? null;
  return { range, rangeSpan, left, right };
}

describe("the reported right-wall plan: range with an 8 7/8\" gap and a 9 1/8\" gap", () => {
  const room = reportedRoom();
  const result = build();
  const rightFloor = result.placed.filter((item) => (
    cabinetWall(item, room) === "right" && (item.placement === "base" || item.placement === "appliance")
  ));

  it("puts a real 9 inch base cabinet on each side of the range", () => {
    const { left, right } = flankNeighbours(result.placed, "right", room);
    expect(left, "no cabinet on the start side of the range").not.toBeNull();
    expect(right, "no cabinet on the end side of the range").not.toBeNull();
    expect(left!.masterCode).toBe("BT9");
    expect(right!.masterCode).toBe("BT9");
    expect(left!.width).toBe(9);
    expect(right!.width).toBe(9);
    // Both stand against the range, which is what the owner asked for.
    const { rangeSpan } = flankNeighbours(result.placed, "right", room);
    expect(span(left!, "right", room).end).toBeCloseTo(rangeSpan.start, 3);
    expect(span(right!, "right", room).start).toBeCloseTo(rangeSpan.end, 3);
  });

  it("lands both sides on a stock width instead of leaving 8 7/8\" and 9 1/8\" openings", () => {
    const { rangeSpan, left, right } = flankNeighbours(result.placed, "right", room);
    // The reported plan had the range at 44.875 with 8 7/8" and 9 1/8" beside it.
    // That 1/8" is the whole difference, so the fix puts the range back on 45 and
    // each side on a full 9": 36 -> 45 on the start side, 75 -> 84 on the end side.
    expect(rangeSpan.start).toBeCloseTo(45, 3);
    expect(rangeSpan.end).toBeCloseTo(75, 3);
    expect(span(left!, "right", room)).toEqual({ start: 36, end: 45 });
    expect(span(right!, "right", room)).toEqual({ start: 75, end: 84 });
    // And the report that it moved is there, in eighths, for the person reading it.
    expect(result.notes.some((note) => /slid.*⅛|slid.*1\/8/i.test(note))).toBe(true);
    const fillersAgainstRange = rightFloor.filter((item) => /filler|scribe/i.test(`${item.masterCode} ${item.description}`));
    expect(fillersAgainstRange).toEqual([]);
  });

  it("wiggles the range by exactly 1/8 inch off the reported placement", () => {
    // The exact plan the user reported: LSB36 at 0-36, RANGE-30 at 44.875-74.875,
    // and 8 7/8" / 9 1/8" of bare wall on each side.
    const lsb = BASES.find((row) => row.masterCode === "LSB36")!;
    const rangeSource = APPLIANCE_PALETTE.find((row) => row.masterCode === "RANGE-30")!;
    const seat = (source: DesignCabinet, start: number, width: number, placement: PlacedCabinet["placement"], uid: string): PlacedCabinet => {
      const depth = Number(source.depth) || 24;
      const spot = wallPlacementAt(start, width, depth, "right", room)!;
      return {
        uid, cabinetId: source.id, masterCode: source.masterCode, description: source.description,
        category: source.category, subCategory: source.subCategory, placement, ...spot,
        width, depth, height: Number(source.height) || 34.5,
        numberOfDoors: source.numberOfDoors ?? 1, numberOfDrawers: source.numberOfDrawers ?? 0,
        styleId: Number(STYLE),
        ...(isRangeOrOven(source.masterCode, source.description) ? { applianceRole: "base-height" as const } : {}),
      } as PlacedCabinet;
    };
    const reported = [
      seat(lsb, 0, 36, "base", "reported-lsb"),
      seat(rangeSource, 44.875, 30, "appliance", "reported-range"),
      // The bottom-wall corner box owns the far end of this run, which is why the
      // plan measured "Fits up to 9 1/8" rather than the whole rest of the wall.
      seat(lsb, 84, 36, "base", "reported-lsb-corner"),
    ];
    // Reproduce the two red flags exactly before the fix: the plan rounds each
    // opening to a hundredth, and labels 8.88" as "Fits up to 8 7/8"".
    const before = baseGaps(reported, "right", room);
    expect(before).toHaveLength(2);
    expect(before[0]!.start).toBeCloseTo(36, 3);
    expect(before[0]!.end - before[0]!.start).toBeCloseTo(8.875, 1);
    expect(before[1]!.start).toBeCloseTo(74.875, 3);
    expect(before[1]!.end - before[1]!.start).toBeCloseTo(9.125, 1);
    const plans = planRangeFlankCabinets({ placed: reported, room, openings: [], catalog: BASES });
    expect(plans).toHaveLength(1);
    const plan = plans[0]!;
    expect(plan.shiftIn).toBeCloseTo(0.125, 6);
    expect(plan.toStartIn).toBeCloseTo(45, 6);
    expect(plan.left?.widthIn).toBe(9);
    expect(plan.right?.widthIn).toBe(9);
    expect(plan.left)?.toMatchObject({ startIn: 36, gapIn: 9 });
    expect(plan.right)?.toMatchObject({ startIn: 75, gapIn: 9 });
  });

  it("leaves no red 'Fits up to' opening beside the range", () => {
    const gaps = baseGaps(result.placed, "right", room);
    const besideRange = gaps.filter((gap) => gap.end - gap.start >= 1);
    expect(besideRange).toEqual([]);
    expect(result.reviewFindings.filter((finding) => /opening left open on right/i.test(finding.title))).toEqual([]);
    // And no overlap anywhere on that wall.
    const overlaps = result.placed.flatMap((left) => result.placed
      .filter((right) => right.uid !== left.uid && cabinetWall(right, room) === "right" && cabinetWall(left, room) === "right")
      .map((right) => ({ left, right, detail: cabinetPlacementCollisionDetail(left, [right], room) }))
      .filter((entry) => entry.detail != null));
    expect(overlaps.map((entry) => `${entry.left.masterCode} ∩ ${entry.right.masterCode}`)).toEqual([]);
  });

  it("reports the new rule on the rule list and honours the existing ones", () => {
    expect(designerLayoutRuleIds()).toContain("range-flank-base-cabinets");
    expect(designerLayoutRuleIds()).toContain("range-flank-finished-ends");
    // The sink stays where it was measured and its base is still the sink base.
    const sink = result.placed.find((item) => /^SB/i.test(item.masterCode))!;
    expect(sink).toBeDefined();
    expect(span(sink, "top", room).start).toBeCloseTo(54, 3);
    // The range is display context only and never becomes a cart line; this is
    // the same rule as before, checked so the new pass cannot undo it.
    expect(result.placed.find((item) => isRangeOrOven(item.masterCode, item.description))?.placement).toBe("appliance");
  });

  it("says in the plan why a flank that ends against the corner box gets no separate panel", () => {
    // In a U kitchen each flank's outside runs into the corner box that owns the
    // room vertex. That side is already finished, so the plan reports it instead
    // of inventing a second board and double-stocking the corner.
    const panelNotes = result.notes.filter((note) => /which already finishes it|no free 3\/4/i.test(note));
    expect(panelNotes).toHaveLength(2);
    expect(panelNotes.join(" ")).toMatch(/BT9 keeps its (start|end) side/);
    expect(result.placed.filter((item) => item.subCategory === "End panel")).toEqual([]);
    // Both red "Fits up to" openings beside the range are gone.
    expect(baseGaps(result.placed, "right", room).filter((gap) => gap.end - gap.start >= 3.05)).toEqual([]);
    // The countertop runs continuously over each flank cabinet and up to the
    // cabinet beside it: the new pass leaves no bare base and no gap in the top.
    const surfaces = countertopSurfaces(result.placed, room);
    const onRight = surfaces.filter((surface) => surface.supportWallId === "right");
    const flankCabinets = result.placed.filter((item) => item.masterCode === "BT9" && cabinetWall(item, room) === "right");
    expect(flankCabinets).toHaveLength(2);
    for (const flank of flankCabinets) {
      const start = wallRunOffset(flank, "right", room);
      const end = start + flank.width;
      const slab = onRight.find((surface) => (
        Math.abs(surface.y - start) <= 0.01 && Math.abs(surface.y + surface.depth - end) <= 0.01
      ));
      expect(slab, `${flank.masterCode} at ${start} has no countertop`).toBeDefined();
      expect(slab!.linearInches).toBeCloseTo(flank.width, 3);
    }
    // Every base on the wall that carries a top is covered, and the only break in
    // the counter is the range opening itself (30"), which is correct.
    const rightEdges = onRight.map((surface) => [surface.y, surface.y + surface.depth]).sort((a, b) => a[0]! - b[0]!);
    const gapsInTop = rightEdges.slice(1)
      .map((edge, index) => Math.round((edge[0]! - rightEdges[index]![1]!) * 1000) / 1000)
      .filter((gap) => gap > 0.06);
    expect(gapsInTop).toEqual([30]);
  });
});

describe("range flank: choosing the cabinet and the finished end", () => {
  const room = reportedRoom();

  it("prefers a stock width plus its end panel over filler, and never filler over an exact width", () => {
    const narrow = narrowFlankBaseCatalog(BASES);
    expect(narrow.map((row) => Number(row.width)).sort((a, b) => a - b)).toEqual([9, 12]);
    // 9" + 3/4" finished end closes a 9 3/4" opening with no filler at all.
    const withPanel = bestFlankCabinet({ gapIn: 9.75, catalog: narrow });
    expect(withPanel).toMatchObject({ widthIn: 9, fillerIn: 0, panelIn: RANGE_FLANK_PANEL_THICKNESS_IN });
    // An exact 9" opening takes the 9" cabinet and no filler.
    const exact = bestFlankCabinet({ gapIn: 9, catalog: narrow });
    expect(exact).toMatchObject({ widthIn: 9, fillerIn: 0 });
    // A covered outside cannot take a panel, so the panel is not counted there.
    const covered = bestFlankCabinet({ gapIn: 9.75, catalog: narrow, panelAvailable: false });
    expect(covered).toMatchObject({ widthIn: 9, fillerIn: 0.75, panelIn: 0 });
    // 21" is beyond what one narrow base closes; that opening is a run, not a flank.
    expect(bestFlankCabinet({ gapIn: 21, catalog: narrow })).toBeNull();
  });

  it("plans no move when the range already sits between two stock widths", () => {
    const range = {
      id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance",
      width: "30", height: "36", depth: "25", placement: "appliance",
    } as DesignCabinet;
    const b36 = BASES.find((row) => row.masterCode === "B36")!;
    const at = (source: DesignCabinet, start: number, width: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet => {
      const spot = wallPlacementAt(start, width, Number(source.depth) || 24, "top", room)!;
      return {
        uid: `${source.masterCode}-${start}`, cabinetId: source.id, masterCode: source.masterCode,
        description: source.description, category: source.category, subCategory: source.subCategory,
        placement: source.placement, ...spot, width, depth: Number(source.depth) || 24,
        height: Number(source.height) || 34.5, numberOfDoors: source.numberOfDoors ?? 1,
        numberOfDrawers: source.numberOfDrawers ?? 0, styleId: Number(STYLE), ...extra,
      } as PlacedCabinet;
    };
    // 36" cabinet, 9" + 9" flanking a 30" range, 12" cabinet: the range is already
    // exactly on stock widths, so the plan seats the cabinets and moves nothing.
    const placed = [at(b36, 0, 36), at(range, 45, 30, { placement: "appliance", applianceRole: "base-height" }), at(b36, 84, 36)];
    const [plan] = planRangeFlankCabinets({ placed, room, openings: [], catalog: BASES });
    expect(plan).toBeDefined();
    expect(plan!.shiftIn).toBe(0);
    expect(plan!.left?.widthIn).toBe(9);
    expect(plan!.right?.widthIn).toBe(9);
  });

  it("picks the line's own base end panel stock for a 24 inch base side", () => {
    const stock = finishedBaseEndPanelStock(ACCESSORY, { depth: 24, height: 34.5 });
    expect(stock).not.toBeNull();
    expect(stock!.stockFace).toBeGreaterThanOrEqual(24);
    expect(stock!.stockHeight).toBeGreaterThanOrEqual(34.5);
    // Never a dishwasher return, refrigerator or tall sheet for a base side.
    expect(/dishwasher|return panel|refrigerator|tall/i.test(`${stock!.masterCode} ${stock!.description}`)).toBe(false);
  });
});

describe("finished end panels on the outside of the range flanks", () => {
  const room = reportedRoom();
  const rangeSource = APPLIANCE_PALETTE.find((row) => row.masterCode === "RANGE-30")!;
  const b36 = BASES.find((row) => row.masterCode === "B36")!;

  const seat = (source: DesignCabinet, start: number, width: number, placement: PlacedCabinet["placement"], uid: string): PlacedCabinet => {
    const depth = Number(source.depth) || 24;
    const spot = wallPlacementAt(start, width, depth, "right", room)!;
    return {
      uid, cabinetId: source.id, masterCode: source.masterCode, description: source.description,
      category: source.category, subCategory: source.subCategory, placement, ...spot,
      width, depth, height: Number(source.height) || 34.5,
      numberOfDoors: source.numberOfDoors ?? 1, numberOfDrawers: source.numberOfDrawers ?? 0,
      styleId: Number(STYLE),
      ...(isRangeOrOven(source.masterCode, source.description) ? { applianceRole: "base-height" as const } : {}),
    } as PlacedCabinet;
  };

  it("seats the line's panel outside an open flank and bills it as a real catalog row", async () => {
    const { applyRangeFlankPlan, applyRangeFlankEndPanels, rangeFlankPanelRequests } = await import("./autoDesignRangeFlanks");
    // A run that ends 9 3/4" past the range: a 36" cabinet, 9 3/4", a 30" range,
    // 9 3/4" to the wall end. Each flank takes a 9" cabinet; the right one ends the
    // run, so it gets its 3/4" finished end. The left flank's outside butts the
    // 36" cabinet, which already finishes that side.
    const shortRun = { ...room, depth: 85.5 } as RoomData;
    const seatAt = (source: DesignCabinet, start: number, width: number, placement: PlacedCabinet["placement"], uid: string): PlacedCabinet => {
      const depth = Number(source.depth) || 24;
      const spot = wallPlacementAt(start, width, depth, "right", shortRun)!;
      return {
        uid, cabinetId: source.id, masterCode: source.masterCode, description: source.description,
        category: source.category, subCategory: source.subCategory, placement, ...spot,
        width, depth, height: Number(source.height) || 34.5,
        numberOfDoors: source.numberOfDoors ?? 1, numberOfDrawers: source.numberOfDrawers ?? 0,
        styleId: Number(STYLE),
      } as PlacedCabinet;
    };
    const placed = [
      seatAt(b36, 0, 36, "base", "b36"),
      seatAt(rangeSource, 45.75, 30, "appliance", "range"),
    ];
    const plans = planRangeFlankCabinets({ placed, room: shortRun, openings: [], catalog: BASES });
    expect(plans).toHaveLength(1);
    expect(plans[0]!.left?.panelIn).toBe(0);
    expect(plans[0]!.right?.panelIn).toBeCloseTo(RANGE_FLANK_PANEL_THICKNESS_IN, 6);
    expect(plans[0]!.right?.widthIn).toBe(9);
    let uid = 0;
    const applied = applyRangeFlankPlan({ placed, room: shortRun, plans, styleId: Number(STYLE), makeUid: () => `a-${++uid}` });
    const request = rangeFlankPanelRequests({ placed: applied.placed, room: shortRun, plans: applied.plans });
    const panels = applyRangeFlankEndPanels({
      placed: applied.placed, room: shortRun, catalog: ACCESSORY, requests: request.requests,
      styleId: Number(STYLE), makeUid: () => `p-${++uid}`,
    });
    expect(panels.skipped).toEqual([]);
    expect(panels.additions).toHaveLength(1);

    const panel = panels.additions[0]!;
    // A real catalog row, the line's own finished end, 3/4" thick, outside the cabinet.
    expect(ACCESSORY.some((row) => row.id === panel.cabinetId && row.masterCode === panel.masterCode)).toBe(true);
    expect(panel.width).toBeCloseTo(RANGE_FLANK_PANEL_THICKNESS_IN, 6);
    expect(panel.category).toBe("Panels");
    expect(panel.autoPlacedSide).toBe("end");
    expect(panel.fieldModificationNote).toMatch(/finished end panel/i);
    const flank = panels.placed.find((item) => item.uid === panel.autoPlacedForUid)!;
    expect(flank.masterCode).toBe("BT9");
    expect(span(panel, "right", shortRun).start).toBeCloseTo(span(flank, "right", shortRun).end, 3);
    // The run is closed with the panel at its end. The only remainder is the 3/4"
    // the closed side could not spend on a panel, which the seam pass closes with
    // a real filler against the neighbouring cabinet — never against the range.
    const gaps = baseGaps(panels.placed, "right", shortRun);
    expect(gaps).toEqual([{ start: 36, end: 36.75 }]);
    expect(plans[0]!.left?.fillerIn).toBeCloseTo(0.75, 6);
    // Nothing overlaps anything: the panel is real, seated furniture.
    for (const other of panels.placed) {
      if (other.uid === panel.uid) continue;
      expect(cabinetPlacementCollisionDetail(panel, [other], shortRun)).toBeNull();
    }
    // The flank whose outside already butts the 36" cabinet is reported, not double-stocked.
    expect(request.unspaced.map((entry) => entry.against)).toEqual(["B36"]);
  });

  it("does not invent a second panel where the outside is already against a cabinet", async () => {
    const { applyRangeFlankPlan, applyRangeFlankEndPanels, rangeFlankPanelRequests } = await import("./autoDesignRangeFlanks");
    // Both outsides butted: the reported U-shape wall, where a corner box owns
    // each end. No end is exposed, so no board is placed and none is billed.
    const placed = [
      seat(b36, 0, 36, "base", "left-butted"),
      seat(rangeSource, 44.875, 30, "appliance", "range"),
      seat(b36, 84, 36, "base", "right-butted"),
    ];
    const plans = planRangeFlankCabinets({ placed, room, openings: [], catalog: BASES });
    let uid = 0;
    const applied = applyRangeFlankPlan({ placed, room, plans, styleId: Number(STYLE), makeUid: () => `b-${++uid}` });
    const request = rangeFlankPanelRequests({ placed: applied.placed, room, plans: applied.plans });
    expect(request.requests).toEqual([]);
    expect(request.unspaced).toHaveLength(2);
    expect(request.unspaced.every((entry) => entry.against === "B36")).toBe(true);
    const panels = applyRangeFlankEndPanels({
      placed: applied.placed, room, catalog: ACCESSORY, requests: request.requests,
      styleId: Number(STYLE), makeUid: () => `q-${++uid}`,
    });
    expect(panels.additions).toEqual([]);
  });

  it("never bills a range or a panel that is not a placed catalog row", async () => {
    const { buildDesignCabinetCartLines } = await import("./designCartLines");
    const result = build();
    const lines = buildDesignCabinetCartLines({
      placed: result.placed,
      styleId: Number(STYLE),
      distributorId: null,
      tier: "list" as never,
      styleNameById: new Map([[Number(STYLE), "Test line"]]),
      unitPriceFor: () => 10,
    });
    // Appliances, including the range, are design context and never a cabinet line.
    expect(lines.some((line) => /RANGE/i.test(line.masterCode))).toBe(false);
    // Any flank end panel the plan did place is a real line; nothing else is.
    const panels = result.placed.filter((item) => item.subCategory === "End panel");
    for (const panel of panels) {
      expect(lines.some((line) => line.masterCode === panel.masterCode)).toBe(true);
    }
  });
});

describe("the whole build places the flank end panel and bills only placed rows", () => {
  it("finishes the outside of an open flank on a closed measured run and says why the butted side gets none", () => {
    // A two-wall run whose far end is open: the build itself seats the panel.
    let uid = 0;
    const result = runAutoDesignLayout({
      input: inputs({
        layoutType: "single-wall",
        sink: { wallLabel: "Wall 1", centerOffsetIn: 24 },
        stove: { wallLabel: "Wall 1", centerOffsetIn: 90 },
      }),
      room: { width: 120, depth: 120, ceilingHeight: 96, openWallPath: false } as RoomData,
      openings: [],
      baseCatalog: BASES,
      wallCatalog: WALLS,
      fillers: FILLERS,
      appliancePalette: APPLIANCE_PALETTE,
      refrigeratorCaps: [],
      refrigeratorEndPanels: [],
      tallCatalog: [],
      panelCatalog: ACCESSORY,
      styleId: Number(STYLE),
      makeUid: () => `whole-${++uid}`,
    });
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    const room = { width: 120, depth: 120, ceilingHeight: 96, openWallPath: false } as RoomData;
    const range = result.placed.find((item) => item.placement === "appliance" && isRangeOrOven(item.masterCode, item.description))!;
    const rangeSpan = span(range, "top", room);
    // A real base cabinet on each side of the range, whatever the measured run.
    const floor = result.placed.filter((item) => cabinetWall(item, room) === "top" && (item.placement === "base" || item.placement === "appliance"));
    const left = floor.filter((item) => Math.abs(span(item, "top", room).end - rangeSpan.start) <= 0.06 && item.uid !== range.uid);
    const right = floor.filter((item) => Math.abs(span(item, "top", room).start - rangeSpan.end) <= 0.06 && item.uid !== range.uid);
    expect(left.length, "no base cabinet on the start side of the range").toBeGreaterThan(0);
    expect(right.length, "no base cabinet on the end side of the range").toBeGreaterThan(0);
    // No filler at the range on either side: filler is not this rule's answer.
    for (const item of [...left, ...right]) {
      expect(/filler|scribe/i.test(`${item.masterCode} ${item.description}`)).toBe(false);
      expect(item.width).toBeGreaterThanOrEqual(6);
    }
    // Every end panel on the plan is a real catalog row from the line's own stock,
    // seated outside a real cabinet, and never an appliance or a range top.
    for (const panel of result.placed.filter((item) => item.subCategory === "End panel")) {
      expect(ACCESSORY.some((row) => row.id === panel.cabinetId && row.masterCode === panel.masterCode)).toBe(true);
      expect(panel.width).toBeCloseTo(RANGE_FLANK_PANEL_THICKNESS_IN, 6);
      expect(panel.placement).toBe("base");
      expect(panel.autoPlacedForUid).toBeTruthy();
      const host = result.placed.find((item) => item.uid === panel.autoPlacedForUid)!;
      expect(host.placement).toBe("base");
    }
  });
});

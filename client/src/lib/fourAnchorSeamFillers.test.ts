import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/fourAnchorRealCatalog.json";
import kitchenFixture from "./__fixtures__/fourAnchorGapKitchen.json";
import { autoBuildStraightBaseCatalog } from "./fourAnchorAutoBuild";
import {
  RANGE_NEIGHBOR_MIN_WIDTH_IN, SEAM_MIN_IN, findFourAnchorSeams, fillFourAnchorLowerSeams, planFourAnchorBaseSegment,
  seamFillerWidths, upperReservedZones,
} from "./fourAnchorSeamFillers";
import { buildFourAnchorWallCabinets } from "./fourAnchorWallCabinets";
import {
  cabinetPlacementCollisionDetail, cabinetWall, freeSegmentsOnWall, isRangeOrOven, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData, type WallOpening,
} from "./design";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;
const rows = (style: string, kind: "base" | "wall" | "accessory") => REAL[style]![kind] as DesignCabinet[];
const fillersOf = (style: string) => rows(style, "accessory").filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`)) as never[];

const STYLE = "330011";
const room = kitchenFixture.room as RoomData;
const openings = kitchenFixture.openings as unknown as WallOpening[];
const TOP_RIGHT = { x: room.width, y: 0 };
let counter = 0;
const uid = () => `seam-${++counter}`;
/** The kitchen the Four-anchor builder produced for the user before this rule: bases and appliances only. */
const lowerOnly = () => (kitchenFixture.placed as unknown as PlacedCabinet[]).filter((item) => item.placement !== "wall" || /fridge|refrigerator/i.test(item.description ?? ""));
const bridge = () => (kitchenFixture.placed as unknown as PlacedCabinet[]).find((item) => item.masterCode === "W361224")!;
const lowerWithBridge = () => lowerOnly().filter((item) => item.placement !== "wall").concat(bridge());

const span = (item: PlacedCabinet) => {
  const wall = cabinetWall(item, room);
  const start = wallRunOffset(item, wall, room);
  return { wall: wall as string, start: Math.round(start * 1000) / 1000, end: Math.round((start + wallRunSpan(item, wall, room)) * 1000) / 1000 };
};
const freeBase = (placed: PlacedCabinet[]) => ["top", "right", "bottom", "left"].flatMap((wall) =>
  freeSegmentsOnWall(wall as never, room, placed, openings, SEAM_MIN_IN, 0, "base", false, undefined, 24)
    .map((segment) => ({ wall, start: Math.round(segment.start * 1000) / 1000, end: Math.round((segment.start + segment.length) * 1000) / 1000 })));

const lowerResult = () => fillFourAnchorLowerSeams({
  placed: lowerWithBridge(), room, openings, fillers: fillersOf(STYLE), makeUid: uid, styleId: Number(STYLE), corners: [TOP_RIGHT],
});

describe("Four-anchor: no gaps anywhere — the user's real built kitchen", () => {
  it("starts with the exact gaps the user reported (1.75-inch seams, a 3-inch seam beside the range)", () => {
    const gaps = freeBase(lowerWithBridge());
    expect(gaps).toContainEqual({ wall: "top", start: 52.25, end: 54 });
    expect(gaps).toContainEqual({ wall: "top", start: 114, end: 117 });
    expect(gaps).toContainEqual({ wall: "right", start: 42, end: 45 });
  });

  it("closes every opening between anchors, panels, corner and runs with real catalog filler", () => {
    const result = lowerResult();
    expect(result.notes).toEqual([]);
    expect(findFourAnchorSeams({ layer: "base", placed: result.placed, room, openings, corners: [TOP_RIGHT] })).toEqual([]);
    // What remains free is only deliberate: the refrigerator assembly's own 1/2-inch clearances and the blind corner's pocket.
    // Bottom and left are empty walls in this kitchen (no cabinets), so they are free by design.
    const left = freeBase(result.placed).filter((gap) => gap.wall === "top" || gap.wall === "right").map((gap) => `${gap.wall}:${gap.start}-${gap.end}`).sort();
    expect(left).toEqual(["right:0-6", "top:2.5-3", "top:39-39.5"]);
  });

  it("uses the real filler SKU for each seam, cut to the exact opening width, billed once", () => {
    const result = lowerResult();
    const realIds = new Set(fillersOf(STYLE).map((row: DesignCabinet) => row.id));
    expect(result.additions.length).toBeGreaterThanOrEqual(4);
    for (const filler of result.additions) {
      expect(realIds.has(filler.cabinetId)).toBe(true);
      expect(filler.fillerPieceGroupId).toMatch(/^filler-group-/);
      expect(filler.fillerBillingRole).toBe("primary");
      expect(filler.width).toBeGreaterThan(0);
      expect(filler.width).toBeLessThanOrEqual(6);
    }
    const byStart = (wall: string, start: number) => result.additions.find((item) => span(item).wall === wall && Math.abs(span(item).start - start) < 0.01);
    expect(byStart("top", 52.25)?.width).toBeCloseTo(1.75, 3);
    expect(byStart("top", 0)?.width).toBeCloseTo(1.75, 3);
    expect(byStart("top", 114)?.width).toBeCloseTo(3, 3);
    expect(byStart("right", 42)?.width).toBeCloseTo(3, 3);
  });

  it("seats every filler without touching or moving a single anchor, panel or cabinet", () => {
    const before = lowerWithBridge();
    const result = lowerResult();
    for (const original of before) {
      const after = result.placed.find((item) => item.uid === original.uid)!;
      expect(after.x).toBe(original.x);
      expect(after.y).toBe(original.y);
      expect(after.width).toBe(original.width);
    }
    for (const filler of result.additions) {
      expect(cabinetPlacementCollisionDetail(filler, result.placed.filter((item) => item.uid !== filler.uid), room)).toBeNull();
    }
  });

  it("never fills the refrigerator's own clearances, the corner pocket, or an opening it cannot match", () => {
    const result = lowerResult();
    expect(result.additions.some((item) => { const s = span(item); return s.wall === "top" && s.start >= 2.4 && s.end <= 3.6; })).toBe(false);
    expect(result.additions.some((item) => { const s = span(item); return s.wall === "right" && s.start < 6.01; })).toBe(false);
  });
});

describe("Four-anchor: upper layer has no gaps either, and nothing over the sink, range or refrigerator", () => {
  const upper = () => {
    const lower = lowerResult();
    const result = buildFourAnchorWallCabinets({
      placed: lower.placed, room, openings, catalog: rows(STYLE, "wall"), wallCabinetHeightIn: 30, styleId: Number(STYLE),
      makeUid: uid, catalogFillers: fillersOf(STYLE), closeSeams: true,
      corners: [{ base: lower.placed.find((item) => item.masterCode === "BBC36")!, point: { ...TOP_RIGHT, firstWallId: "top" } }],
    });
    return { lower, result };
  };

  it("leaves no uncovered opening above any lower run outside the deliberate zones", () => {
    const { result } = upper();
    const zones = upperReservedZones(result.placed.filter((item) => item.placement !== "wall" || /fridge|refrigerator/i.test(item.description ?? "")), room);
    const seams = findFourAnchorSeams({
      layer: "wall", placed: result.placed, room, openings,
      corners: [TOP_RIGHT], reservedZones: zones,
    });
    expect(seams.map((seam) => `${seam.wall}:${seam.start}-${seam.end}`)).toEqual([]);
  });

  it("keeps the wall above the sink window and over the range clear, and the 3-inch window clearance intact", () => {
    const { result } = upper();
    const above = result.additions.filter((item) => { const s = span(item); return s.wall === "top" && s.end > 51.01 && s.start < 92.99; });
    expect(above.map((item) => item.masterCode)).toEqual([]);
    const overRange = result.additions.filter((item) => { const s = span(item); return s.wall === "right" && s.end > 45.01 && s.start < 74.99; });
    expect(overRange.map((item) => item.masterCode)).toEqual([]);
  });

  it("closes the 3-inch seam beside the hood and the 10-3/4-inch run beside the window with real upper pieces", () => {
    const { result } = upper();
    const at = (wall: string, start: number) => result.additions.find((item) => span(item).wall === wall && Math.abs(span(item).start - start) < 0.01);
    expect(at("right", 42)?.width).toBeCloseTo(3, 3);
    expect(at("top", 40.25)).toBeDefined();
    const covered = result.additions.filter((item) => { const s = span(item); return s.wall === "top" && s.start >= 40.24 && s.end <= 51.01; });
    expect(covered.reduce((sum, item) => sum + item.width, 0)).toBeCloseTo(10.75, 2);
  });

  it("is collision-free", () => {
    const { result } = upper();
    for (const item of result.additions) {
      expect(cabinetPlacementCollisionDetail(item, result.placed.filter((other) => other.uid !== item.uid), room)).toBeNull();
    }
  });

  it("is off by default so every other caller keeps its exact behavior", () => {
    const lower = lowerResult();
    const without = buildFourAnchorWallCabinets({
      placed: lower.placed, room, openings, catalog: rows(STYLE, "wall"), wallCabinetHeightIn: 30, styleId: Number(STYLE),
      makeUid: uid, catalogFillers: fillersOf(STYLE),
    });
    const withSeams = upper().result;
    expect(withSeams.additions.length).toBeGreaterThan(without.additions.length);
  });
});

describe("Four-anchor: a range always has a real cabinet at least 15 inches wide on each side", () => {
  const catalog = autoBuildStraightBaseCatalog(rows(STYLE, "base"));
  const widthsBeside = (plan: ReturnType<typeof planFourAnchorBaseSegment>, edge: "first" | "last") => {
    const real = plan.items.filter((item) => !item.isFiller);
    return real[edge === "first" ? 0 : real.length - 1]?.width;
  };

  it("exposes the 15-inch rule as a constant", () => {
    expect(RANGE_NEIGHBOR_MIN_WIDTH_IN).toBe(15);
  });

  it("never puts a stub beside the range when the run can be tiled with wider boxes (range at the start)", () => {
    for (const length of [21, 24, 27, 30, 33, 39, 45, 51, 54, 57, 63, 69, 75, 81, 93]) {
      const plan = planFourAnchorBaseSegment({ length, catalog, rangeAtStart: true, rangeAtEnd: false });
      expect(plan.items[0]!.isFiller, `length ${length}`).toBe(false);
      expect(plan.items[0]!.width, `length ${length}`).toBeGreaterThanOrEqual(15);
    }
  });

  it("puts the widest box against a range at the END of the run, and filler away from it", () => {
    for (const length of [21, 30, 45, 54, 69]) {
      const plan = planFourAnchorBaseSegment({ length, catalog, rangeAtStart: false, rangeAtEnd: true });
      expect(plan.items[plan.items.length - 1]!.isFiller, `length ${length}`).toBe(false);
      expect(plan.items[plan.items.length - 1]!.width, `length ${length}`).toBeGreaterThanOrEqual(15);
    }
  });

  it("gives both neighbors 15 inches or more when a run sits between two ranges", () => {
    const plan = planFourAnchorBaseSegment({ length: 54, catalog, rangeAtStart: true, rangeAtEnd: true });
    expect(widthsBeside(plan, "first")).toBeGreaterThanOrEqual(15);
    expect(widthsBeside(plan, "last")).toBeGreaterThanOrEqual(15);
    expect(plan.note).toBeNull();
    expect(plan.items.reduce((sum, item) => sum + item.width, 0)).toBeLessThanOrEqual(54 + 0.01);
  });

  it("covers the same span as the unconstrained plan (no extra gap) and keeps real boxes", () => {
    const free = planFourAnchorBaseSegment({ length: 45, catalog, rangeAtStart: false, rangeAtEnd: false });
    const constrained = planFourAnchorBaseSegment({ length: 45, catalog, rangeAtStart: true, rangeAtEnd: false });
    const total = (plan: typeof free) => plan.items.reduce((sum, item) => sum + item.width, 0);
    expect(total(constrained)).toBeCloseTo(total(free), 2);
  });

  it("says so (and does not hide it) when the segment itself is too short for a 15-inch neighbor", () => {
    const plan = planFourAnchorBaseSegment({ length: 12, catalog, rangeAtStart: true, rangeAtEnd: false });
    expect(plan.note).toMatch(/narrower than 15/);
  });

  it("leaves a segment with no range exactly as the plain largest-first plan", () => {
    const plan = planFourAnchorBaseSegment({ length: 45, catalog, rangeAtStart: false, rangeAtEnd: false });
    expect(plan.note).toBeNull();
    expect(plan.items.some((item) => !item.isFiller)).toBe(true);
  });
});

describe("seamFillerWidths", () => {
  it("cuts one board up to 6 inches, two equal boards up to 12, ignores tape-measure noise, refuses wider", () => {
    expect(seamFillerWidths(0.05)).toEqual([]);
    expect(seamFillerWidths(1.75)).toEqual([1.75]);
    expect(seamFillerWidths(6)).toEqual([6]);
    expect(seamFillerWidths(9)).toEqual([4.5, 4.5]);
    expect(seamFillerWidths(12)).toEqual([6, 6]);
    expect(seamFillerWidths(12.5)).toBeNull();
  });

  it("never rounds up past the opening", () => {
    for (const width of [0.2, 1.7, 2.93, 3.01, 5.99, 7.31, 11.99]) {
      const pieces = seamFillerWidths(width)!;
      expect(pieces.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(width + 1e-9);
    }
  });
});

describe("range detection used by the wiring", () => {
  it("recognizes the measured range in the fixture", () => {
    const range = (kitchenFixture.placed as unknown as PlacedCabinet[]).find((item) => item.masterCode === "RANGE-30")!;
    expect(isRangeOrOven(range.masterCode, range.description)).toBe(true);
  });
});

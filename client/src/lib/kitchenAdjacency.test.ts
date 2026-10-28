import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, wallPlacementAt, wallRunOffset, type DesignCabinet, type PlacedCabinet } from "./design";
import { planAutoDesignBaseSegment } from "./autoDesignSeamFillers";
import { applyAutoDesignWiggleRoom, type AutoDesignAnchorOrigin } from "./designerLayoutRules";
import {
  HEAVY_COOK_LANDING_IN,
  OPEN_QUESTION_TWENTY_FOUR_INCH_CABINET_BOTTOM_IN,
  SMALL_RANGE_NEIGHBOR_BELOW_IN,
  WALL_RUN_TOP_IN,
  rangeBridgeSpec,
  reviewAfterShift,
  reviewHeavyCookLandings,
  reviewKitchenAdjacency,
  separateRangeAndRefrigerator,
} from "./kitchenAdjacency";
import { KITCHEN_ADJACENCY_RULES } from "./kitchenAdjacencyRules";

function placed(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode" | "placement">): PlacedCabinet {
  const room = { ...DEFAULT_ROOM, width: 144 };
  const width = partial.width ?? 30;
  const spot = wallPlacementAt(partial.wallOffset ?? partial.x ?? 0, width, partial.depth ?? 24, "bottom", room);
  return {
    cabinetId: 1,
    description: partial.description ?? partial.masterCode,
    category: "Base",
    subCategory: null,
    x: spot.x,
    y: spot.y,
    width,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    numberOfDoors: 1,
    numberOfDrawers: 0,
    ...partial,
  } as PlacedCabinet;
}

describe("adjacency rule catalog", () => {
  it("lists all 49 rules with an id and a source", () => {
    expect(KITCHEN_ADJACENCY_RULES).toHaveLength(49);
    expect(new Set(KITCHEN_ADJACENCY_RULES.map((rule) => rule.number)).size).toBe(49);
    for (const rule of KITCHEN_ADJACENCY_RULES) {
      expect(rule.id.length).toBeGreaterThan(0);
      expect(rule.sources.length).toBeGreaterThan(0);
      expect(["auto", "suggest", "review", "skipped"]).toContain(rule.enforcement);
    }
  });
});

describe("range bridge vertical rules", () => {
  it("uses a 24 inch bridge at 72 when something hangs below, and a 30 inch bridge at 66 when it does not", () => {
    expect(rangeBridgeSpec({ rangeWidthIn: 30, hangsBelow: true })).toMatchObject({ code: "W3024", heightIn: 24, bottomIn: 72, topIn: 96, depthIn: 12 });
    expect(rangeBridgeSpec({ rangeWidthIn: 36, hangsBelow: true })).toMatchObject({ code: "W3624", bottomIn: 72, topIn: WALL_RUN_TOP_IN });
    expect(rangeBridgeSpec({ rangeWidthIn: 33, hangsBelow: false })).toMatchObject({ code: "W3330", heightIn: 30, bottomIn: 66, topIn: 96 });
    expect(OPEN_QUESTION_TWENTY_FOUR_INCH_CABINET_BOTTOM_IN).toBe(66);
    expect(OPEN_QUESTION_TWENTY_FOUR_INCH_CABINET_BOTTOM_IN + 24).toBe(90);
  });
});

describe("heavy-cooking landings", () => {
  const room = { ...DEFAULT_ROOM, width: 144 };

  it("treats bases under 15 inches, fillers, and tall units as small cabinets beside the range", () => {
    expect(SMALL_RANGE_NEIGHBOR_BELOW_IN).toBe(HEAVY_COOK_LANDING_IN);
    const range = placed({ uid: "range", masterCode: "RANGE-30", description: "30 inch range", placement: "appliance", width: 30, wallOffset: 40 });
    const spice = placed({ uid: "spice", masterCode: "B12", description: "12 inch base", placement: "base", width: 12, wallOffset: 28 });
    const findings = reviewHeavyCookLandings([range, spice], room);
    expect(findings.some((finding) => finding.ruleId === "heavy-cook-landing")).toBe(true);
    expect(findings.map((finding) => finding.description).join(" ")).toMatch(/under 15/);
  });

  it("does not place a 12 inch cabinet against the range for a heavy cook", () => {
    const catalog = [12, 9].map((width, index) => ({
      id: index + 1,
      masterCode: `B${width}`,
      description: `${width} inch base cabinet`,
      category: "Base",
      subCategory: "Base",
      width: String(width),
      height: "34.5",
      depth: "24",
      placement: "base",
      numberOfDoors: 1,
      numberOfDrawers: 0,
    })) as DesignCabinet[];
    const fill = planAutoDesignBaseSegment({
      length: 12,
      catalog,
      rangeAtStart: true,
      rangeAtEnd: false,
      heavyCookLanding: true,
    });
    expect(fill.items).toEqual([]);
    expect(fill.note).toMatch(/15/);
  });
});

describe("range and refrigerator spacing", () => {
  it("shifts them at most 3 inches so a 15 inch cabinet can sit between them", () => {
    const room = { ...DEFAULT_ROOM, width: 144 };
    const range = placed({ uid: "range", masterCode: "RANGE-30", description: "30 inch range", placement: "appliance", width: 30, wallOffset: 20 });
    const fridge = placed({ uid: "fridge", masterCode: "FRIDGE-36", description: "36 inch refrigerator", placement: "appliance", width: 36, wallOffset: 62 });
    const before = wallRunOffset(fridge, "bottom", room) - (wallRunOffset(range, "bottom", room) + 30);
    expect(before).toBeCloseTo(12, 1);
    const result = separateRangeAndRefrigerator({
      placed: [range, fridge],
      room,
      origins: [
        { uid: "range", originalStart: wallRunOffset(range, "bottom", room) },
        { uid: "fridge", originalStart: wallRunOffset(fridge, "bottom", room) },
      ],
    });
    const movedRange = result.placed.find((item) => item.uid === "range")!;
    const movedFridge = result.placed.find((item) => item.uid === "fridge")!;
    const gap = wallRunOffset(movedFridge, "bottom", room) - (wallRunOffset(movedRange, "bottom", room) + 30);
    expect(gap).toBeGreaterThanOrEqual(15 - 0.05);
    for (const item of [movedRange, movedFridge]) {
      const origin = item.uid === "range" ? wallRunOffset(range, "bottom", room) : wallRunOffset(fridge, "bottom", room);
      expect(Math.abs(wallRunOffset(item, "bottom", room) - origin)).toBeLessThanOrEqual(3.05);
    }
    expect(result.flags).toEqual([]);
  });

  it("flags a manual layout whose fillers are the only thing between the range and refrigerator", () => {
    const room = { ...DEFAULT_ROOM, width: 180 };
    const range = placed({ uid: "range", masterCode: "RANGE-30", description: "30 inch range", placement: "appliance", width: 30, wallOffset: 0 });
    const filler = placed({ uid: "fill", masterCode: "BF3", description: "3 inch filler", placement: "base", width: 18, wallOffset: 30 });
    const fridge = placed({ uid: "fridge", masterCode: "FRIDGE-36", description: "36 inch refrigerator", placement: "appliance", width: 36, wallOffset: 48 });
    const report = reviewKitchenAdjacency({ room, placed: [range, filler, fridge], openings: [], island: null, usage: { uses: [], skipped: true } });
    expect(report.findings.some((finding) => finding.id.startsWith("adjacency:range-fridge-gap"))).toBe(true);
  });
});

describe("post-shift checks", () => {
  it("lets a sink slide up to 3 inches and then suggests recentering it on the window", () => {
    const room = { ...DEFAULT_ROOM, width: 120 };
    const spot = wallPlacementAt(45, 36, 24, "bottom", room);
    const sink = {
      uid: "sink-1",
      cabinetId: 4,
      masterCode: "SB36",
      description: "Sink Base 36",
      placement: "base",
      ...spot,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: spot.rotation,
      wallId: spot.wallId,
      wallOffset: spot.wallOffset,
      numberOfDoors: 2,
      numberOfDrawers: 0,
    } as PlacedCabinet;
    const catalog = [36, 30, 24, 18, 12].map((width, index) => ({
      id: index + 1,
      masterCode: `B${width}`,
      description: `${width} inch base cabinet`,
      category: "Base",
      width: String(width),
      height: "34.5",
      depth: "24",
      placement: "base",
      numberOfDoors: 1,
      numberOfDrawers: 0,
    })) as DesignCabinet[];
    const origin: AutoDesignAnchorOrigin = { uid: sink.uid, kind: "sink", wallId: "bottom", originalStart: 45 };
    const shifted = applyAutoDesignWiggleRoom({
      placed: [sink],
      room,
      openings: [{ uid: "window-1", kind: "window", label: "Sink window", side: "bottom", offset: 45, width: 36, height: 36, sill: 42 }],
      catalog,
      origins: [origin],
    });
    const start = wallRunOffset(shifted.placed[0]!, "bottom", room);
    expect(Math.abs(start - 45)).toBeLessThanOrEqual(3);
    expect(shifted.moves[0]?.kind).toBe("sink");
    const review = reviewAfterShift({
      placed: shifted.placed,
      room,
      openings: [{ uid: "window-1", kind: "window", label: "Sink window", side: "bottom", offset: 45, width: 36, height: 36, sill: 42 }],
      usage: { uses: [], skipped: true },
    });
    expect(review.findings.some((finding) => finding.ruleId === "sink-on-window" && finding.severity === "suggestion")).toBe(true);
  });
});

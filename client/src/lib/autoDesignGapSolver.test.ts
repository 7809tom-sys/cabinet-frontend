import { describe, expect, it } from "vitest";
import { chooseLowestFillerCandidate, planWallWidthsOverBase, searchFewestFillerOpening, solveCabinetSpan } from "./autoDesignGapSolver";
import { chooseLazySusanSize, preferredAutoDesignCorner } from "./autoDesignCornerStage";
import { closestDishwasherStart, defaultDishwasherSide, resolveDishwasherSide } from "./autoDesignAutoBuild";
import { REFRIGERATOR_SHIFT_LIMIT_IN, SINK_SHIFT_LIMIT_IN } from "./designerLayoutRules";

const baseWidths = [36, 33, 30, 27, 24, 21, 18, 15, 12, 9];

describe("zero-filler search", () => {
  it("closes a span with cabinet widths before it will use a filler", () => {
    const solved = solveCabinetSpan({ lengthIn: 48, widthsIn: baseWidths, layer: "base" });
    expect(solved.fillerCount).toBe(0);
    expect(solved.cabinetWidths.reduce((sum, width) => sum + width, 0)).toBe(48);
  });

  it("uses the smallest movement when a shift removes the filler", () => {
    const unshifted = solveCabinetSpan({ lengthIn: 39, widthsIn: [36, 24, 18], layer: "base", movementIn: 0 });
    const shifted = solveCabinetSpan({ lengthIn: 36, widthsIn: [36, 24, 18], layer: "base", movementIn: 3 });
    const chosen = chooseLowestFillerCandidate([
      { ...unshifted, lengthIn: 39 },
      { ...shifted, lengthIn: 36 },
    ]);
    expect(unshifted.fillerCount).toBeGreaterThan(0);
    expect(shifted.fillerCount).toBe(0);
    expect(chosen?.movementIn).toBe(3);
    expect(chosen?.fillerCount).toBe(0);
  });

  it("places one filler only when no cabinet combination or allowed shift can close the gap", () => {
    const widths = [36, 24];
    const stuck = solveCabinetSpan({ lengthIn: 50, widthsIn: widths, layer: "base", movementIn: 0 });
    const beyondEveryCap = solveCabinetSpan({ lengthIn: 48, widthsIn: widths, layer: "base", movementIn: 7 });
    expect(beyondEveryCap.fillerCount).toBe(0);
    const chosen = chooseLowestFillerCandidate([
      { ...stuck, lengthIn: 50 },
    ]);
    expect(stuck.fillerCount).toBe(1);
    expect(stuck.fillerWidth).toBe(2);
    expect(chosen?.fillerCount).toBe(1);
    expect(chosen?.movementIn).toBe(0);
  });

  it("never uses a 3 inch wall filler when other wall widths exist", () => {
    const solved = solveCabinetSpan({ lengthIn: 27, widthsIn: [24, 21, 18, 15, 12, 9], layer: "wall" });
    expect(solved.fillerWidth).not.toBe(3);
    expect(solved.fillerCount).toBe(0);
    expect(solved.cabinetWidths).toEqual([15, 12]);
  });
});

describe("wall cabinets over a base", () => {
  it("splits 48 into two 24s and 42 into two 21s instead of a lopsided pair", () => {
    expect(planWallWidthsOverBase(48, [39, 36, 24, 12, 9])).toEqual([24, 24]);
    expect(planWallWidthsOverBase(42, [39, 24, 21, 18, 9])).toEqual([21, 21]);
  });

  it("keeps a single cabinet when the line sells that exact width", () => {
    expect(planWallWidthsOverBase(36, [36, 24, 12])).toEqual([36]);
  });
});

describe("lazy Susan size fallback", () => {
  it("keeps 36 when it fits with no shift", () => {
    const chosen = chooseLazySusanSize([36, 33], (size, shift) => size === 36 && shift === 0);
    expect(chosen).toMatchObject({ size: 36, reducedFrom: null, fallback: false });
  });

  it("steps down to 33 when 36 does not fit even with the allowed shifts", () => {
    const chosen = chooseLazySusanSize([36, 33], (size, shift) => size === 33 && shift === 0);
    expect(chosen.size).toBe(33);
    expect(chosen.reducedFrom).toBe(36);
    expect(chosen.note).toBe('Lazy Susan reduced to 33" to fit');
  });

  it("falls back when no lazy Susan size fits", () => {
    const chosen = chooseLazySusanSize([36, 33], () => false);
    expect(chosen.size).toBeNull();
    expect(chosen.fallback).toBe(true);
  });
});

describe("corner preselect", () => {
  it("preselects a diagonal corner when one is sold", () => {
    const chosen = preferredAutoDesignCorner([
      { id: 1, masterCode: "LSB36", description: "Lazy Susan", placement: "base", cornerType: "lazy-susan" },
      { id: 2, masterCode: "DCB36", description: "Diagonal corner", placement: "base", cornerType: "diagonal" },
      { id: 3, masterCode: "BBC42", description: "Blind corner", placement: "base", cornerType: "blind-corner" },
    ]);
    expect(chosen?.id).toBe(2);
  });
});

describe("dishwasher side", () => {
  it("uses the saved side and otherwise sits away from the corner", () => {
    expect(resolveDishwasherSide({ preference: "left" })).toBe("left");
    expect(resolveDishwasherSide({ preference: null, originCorner: "left" })).toBe("right");
    expect(defaultDishwasherSide({ originCorner: "right" })).toBe("left");
  });

  it("stays adjacent when the sink can slide within 3 inches", () => {
    const placed = closestDishwasherStart({
      sinkStart: 42,
      sinkWidth: 36,
      dishwasherWidth: 24,
      side: "right",
      wallStart: 0,
      wallEnd: 100,
      blocked: [],
      sinkShiftLimit: SINK_SHIFT_LIMIT_IN,
    });
    expect(placed?.adjacent).toBe(true);
    expect(placed?.sinkShift).toBeCloseTo(2, 5);
    expect(placed!.dishwasherStart).toBeCloseTo(placed!.sinkStart + 36, 5);
  });

  it("keeps the checked side and the smallest gap when the sink cannot reach", () => {
    const placed = closestDishwasherStart({
      sinkStart: 40,
      sinkWidth: 36,
      dishwasherWidth: 24,
      side: "right",
      wallStart: 0,
      wallEnd: 160,
      blocked: [{ start: 76, end: 90 }],
      sinkShiftLimit: SINK_SHIFT_LIMIT_IN,
    });
    expect(placed?.adjacent).toBe(false);
    expect(placed!.dishwasherStart).toBeGreaterThanOrEqual(placed!.sinkStart + 36 - 1e-6);
    expect(placed!.dishwasherStart).toBeCloseTo(90, 5);
    expect(Math.abs(placed!.sinkStart - 40)).toBeLessThanOrEqual(SINK_SHIFT_LIMIT_IN + 1e-6);
  });
});

describe("fewest-filler search", () => {
  it("closes a gap with catalog widths and does not add a filler", () => {
    const chosen = searchFewestFillerOpening({ lengthIn: 48, widthsIn: baseWidths, layer: "base" });
    expect(chosen?.fillerCount).toBe(0);
    expect(chosen?.movementIn).toBe(0);
    expect(chosen?.cabinetWidths.reduce((sum, width) => sum + width, 0)).toBe(48);
  });

  it("slides within the 3 inch sink cap when that removes the filler", () => {
    const chosen = searchFewestFillerOpening({
      lengthIn: 39,
      widthsIn: [36, 24, 18],
      layer: "base",
      movementLimitIn: 3,
    });
    expect(chosen?.fillerCount).toBe(0);
    expect(chosen?.movementIn).toBe(3);
    expect(chosen?.cabinetWidths).toEqual([36]);
  });

  it("uses the refrigerator's 6 inch cap when 3 inches is not enough", () => {
    const sink = searchFewestFillerOpening({
      lengthIn: 41,
      widthsIn: [36],
      layer: "base",
      movementLimitIn: 3,
    });
    const fridge = searchFewestFillerOpening({
      lengthIn: 41,
      widthsIn: [36],
      layer: "base",
      movementLimitIn: 6,
    });
    expect(sink?.fillerCount).toBe(1);
    expect(fridge?.fillerCount).toBe(0);
    expect(fridge?.movementIn).toBe(5);
    expect(fridge?.cabinetWidths).toEqual([36]);
  });

  it("prefers an equal wall split over a lopsided pair", () => {
    const chosen = searchFewestFillerOpening({
      lengthIn: 48,
      widthsIn: [39, 36, 24, 12, 9],
      layer: "wall",
    });
    expect(chosen?.fillerCount).toBe(0);
    expect(chosen?.cabinetWidths).toEqual([24, 24]);
  });

  it("uses a stepped-down corner opening before it will place a filler", () => {
    const stuck = searchFewestFillerOpening({ lengthIn: 39, widthsIn: [36, 24, 18], layer: "base" });
    const chosen = searchFewestFillerOpening({
      lengthIn: 39,
      widthsIn: [36, 24, 18],
      layer: "base",
      alternates: [{ lengthIn: 42, movementIn: 0 }],
    });
    expect(stuck?.fillerCount).toBe(1);
    expect(chosen?.fillerCount).toBe(0);
    expect(chosen?.lengthIn).toBe(42);
    expect(chosen?.cabinetWidths.reduce((sum, width) => sum + width, 0)).toBe(42);
  });

  it("places a filler only when no width, shift, split, or step-down closes the gap", () => {
    const chosen = searchFewestFillerOpening({
      lengthIn: 50,
      widthsIn: [36, 24],
      layer: "base",
      movementLimitIn: 1,
      alternates: [{ lengthIn: 47, movementIn: 1, widthsIn: [36, 24] }],
    });
    expect(chosen?.fillerCount).toBe(1);
    expect(chosen?.fillerWidth).toBe(2);
    expect(chosen?.movementIn).toBe(0);
  });

  it("does not close a wall gap with a 3 inch filler", () => {
    const withOtherWidths = searchFewestFillerOpening({
      lengthIn: 27,
      widthsIn: [24, 21, 18, 15, 12, 9],
      layer: "wall",
    });
    const onlyTwentyFour = searchFewestFillerOpening({ lengthIn: 27, widthsIn: [24], layer: "wall" });
    expect(withOtherWidths?.fillerWidth).not.toBe(3);
    expect(withOtherWidths?.fillerCount).toBe(0);
    expect(onlyTwentyFour?.fillerWidth ?? null).not.toBe(3);
    expect(onlyTwentyFour?.fillerCount ?? 0).toBe(0);
  });
});

describe("shift caps used by the search", () => {
  it("publishes the refrigerator and sink limits", () => {
    expect(REFRIGERATOR_SHIFT_LIMIT_IN).toBe(6);
    expect(SINK_SHIFT_LIMIT_IN).toBe(3);
  });
});

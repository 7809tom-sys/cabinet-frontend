import { describe, expect, it } from "vitest";
import { packGap, planRun } from "./autoDesignRunPacking";
import type { RunSpec } from "./autoDesignRunPacking";

describe("packGap", () => {
  it("closes a 45in gap exactly with two pieces and no filler", () => {
    const r = packGap(45, [9, 12, 15, 18, 21, 24, 30, 33, 36], 3);
    expect(r.pieces).toHaveLength(2);
    expect(r.pieces.reduce((a, b) => a + b, 0)).toBe(45);
    expect(r.fillerIn).toBe(0);
    expect(r.openIn).toBe(0);
  });

  it("uses stock first and only a small filler for a 37in gap", () => {
    const r = packGap(37, [12, 15, 18, 24], 3);
    const sum = r.pieces.reduce((a, b) => a + b, 0);
    expect(sum + r.fillerIn).toBe(37);
    expect(r.fillerIn).toBeLessThanOrEqual(3);
    expect(r.openIn).toBe(0);
  });

  it("cannot fit a cabinet in a 7in gap and leaves it open", () => {
    const r = packGap(7, [9, 12], 3);
    expect(r.pieces).toHaveLength(0);
    expect(r.openIn).toBe(7);
  });

  it("fills a 4in opening with a filler only", () => {
    const r = packGap(4, [9, 12], 6);
    expect(r.pieces).toHaveLength(0);
    expect(r.fillerIn).toBe(4);
    expect(r.openIn).toBe(0);
  });
});

describe("planRun", () => {
  it("plans a >=15in landing between a fixed fridge and a movable range with no open gap", () => {
    const spec: RunSpec = {
      runStart: 0,
      runEnd: 120,
      blocked: [],
      blocks: [
        {
          id: "fridge",
          start: 0,
          end: 36.75,
          ranges: null,
          role: "refrigerator",
          coversStart: true,
          coversEnd: false,
        },
        {
          id: "range",
          start: 44.25,
          end: 74.25,
          ranges: [{ lo: -3, hi: 8 }],
          role: "range",
          coversStart: false,
          coversEnd: false,
        },
      ],
      widths: [9, 12, 15, 18, 21, 24, 30, 33, 36],
      fillerMaxIn: 3,
      panelIn: 0.75,
      landingPairs: [{ a: "fridge", b: "range", minIn: 15 }],
    };

    const plan = planRun(spec);

    const landing = plan.landing.find((l) => l.a === "fridge" && l.b === "range");
    expect(landing).toBeDefined();
    expect(landing!.gapIn).toBeGreaterThanOrEqual(15);

    const openTotal = plan.gaps.reduce((acc, g) => acc + g.openIn, 0);
    expect(openTotal).toBe(0);
  });

  it("aims a blind corner's filler at its target by moving the corner's open edge", () => {
    const spec: RunSpec = {
      runStart: 0,
      runEnd: 137,
      blocked: [],
      widths: [9, 12, 15, 18, 21, 24, 30, 33, 36],
      fillerMaxIn: 6,
      panelIn: 0,
      step: 0.125,
      landingPairs: [{ a: "fridge", b: "range", minIn: 15 }],
      blocks: [
        {
          id: "fridge",
          start: 0,
          end: 37.25,
          ranges: null,
          role: "refrigerator",
          coversStart: true,
          coversEnd: true,
        },
        {
          id: "range",
          start: 44.25,
          end: 74.25,
          ranges: [{ lo: 8, hi: 11 }],
          role: "range",
          coversStart: false,
          coversEnd: false,
        },
        {
          id: "corner",
          start: 101,
          end: 137,
          ranges: [{ lo: 0, hi: 3 }],
          role: "corner",
          coversStart: true,
          coversEnd: true,
          movingEdge: "start",
          fillerTargetIn: 1.8,
        },
      ],
    };

    const plan = planRun(spec);

    const openTotal = plan.gaps.reduce((sum, g) => sum + g.openIn, 0);
    expect(openTotal).toBe(0);

    const landing = plan.landing.find((l) => l.a === "fridge" && l.b === "range");
    expect(landing).toBeDefined();
    expect(landing!.gapIn).toBeGreaterThanOrEqual(15);

    const cornerGap = plan.gaps.find((g) => g.endNeighbor === "corner");
    expect(cornerGap).toBeDefined();
    expect(cornerGap!.filler).not.toBeNull();
    expect(cornerGap!.filler!.width).toBe(1.75);
    expect(cornerGap!.filler!.start + cornerGap!.filler!.width).toBe(
      101 + plan.offsets.corner,
    );
  });
});

describe("planRun never overlaps two blocks (Tom, Nov 23 2026: range and sink base 1/8 in. into each other)", () => {
  it("leaves the opening rather than sliding a block 1/8 in. into its neighbor", () => {
    // Range 0-30 cannot move; the sink base 30-66 may wiggle 1/4 in. The 35 7/8 in.
    // left after it only closes with a 36 in. base if the sink base slides 1/8 in.
    // into the range, which the planner used to accept as "touching".
    const spec: RunSpec = {
      runStart: 0,
      runEnd: 101.875,
      blocked: [],
      blocks: [
        { id: "range", start: 0, end: 30, ranges: null, role: "range", coversStart: true, coversEnd: true },
        { id: "sink", start: 30, end: 66, ranges: [{ lo: -0.25, hi: 0.25 }], role: "sink", coversStart: true, coversEnd: true },
      ],
      widths: [36],
      fillerMaxIn: 0,
      panelIn: 0,
      landingPairs: [],
    };
    const plan = planRun(spec);
    expect(30 + plan.offsets.sink).toBeGreaterThanOrEqual(30);
  });

  it("does not let a block slide 1/8 in. into a blocked span either", () => {
    const spec: RunSpec = {
      runStart: 0,
      runEnd: 101.875,
      blocked: [{ start: 0, end: 30 }],
      blocks: [
        { id: "sink", start: 30, end: 66, ranges: [{ lo: -0.25, hi: 0.25 }], role: "sink", coversStart: true, coversEnd: true },
      ],
      widths: [36],
      fillerMaxIn: 0,
      panelIn: 0,
      landingPairs: [],
    };
    const plan = planRun(spec);
    expect(30 + plan.offsets.sink).toBeGreaterThanOrEqual(30);
  });

  it("still lets two blocks touch exactly", () => {
    const spec: RunSpec = {
      runStart: 0,
      runEnd: 102,
      blocked: [],
      blocks: [
        { id: "range", start: 0, end: 30, ranges: null, role: "range", coversStart: true, coversEnd: true },
        { id: "sink", start: 30.125, end: 66.125, ranges: [{ lo: -0.25, hi: 0.25 }], role: "sink", coversStart: true, coversEnd: true },
      ],
      widths: [36],
      fillerMaxIn: 0,
      panelIn: 0,
      landingPairs: [],
    };
    const plan = planRun(spec);
    expect(30.125 + plan.offsets.sink).toBe(30);
    expect(plan.gaps.reduce((acc, g) => acc + g.openIn, 0)).toBe(0);
  });
});

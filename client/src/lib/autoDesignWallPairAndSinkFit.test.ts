import { describe, expect, it } from "vitest";
import { centeredSinkRangePair, sinkBaseFitOptions } from "./autoDesignWallPairAndSinkFit";
import { autoDesignWallUsableSpan } from "./autoDesignDefaultCenters";

// Tom (owner voice, Nov 24 2026, 12:27 PM CT): Wall 2 places the range and sink, centered.
describe("centeredSinkRangePair", () => {
  it("centers sink group + 18 in landing + range as one pair on the usable span", () => {
    const pair = centeredSinkRangePair({ lo: 45, hi: 200, sinkBaseWidthIn: 36, dishwasherSide: "right" })!;
    // total = 36 + 24 + 18 + 30 = 108; start = 45 + (155 - 108) / 2 = 68.5
    expect(pair).toMatchObject({ order: "sink-first", gapIn: 18, shiftIn: 0, openingConflict: false });
    expect(pair.sinkCenterIn).toBe(86.5);
    expect(pair.stoveCenterIn).toBe(161.5);
    // Pair midpoint is the span midpoint.
    expect((68.5 + 176.5) / 2).toBe((45 + 200) / 2);
  });

  it("drops to the 15 in minimum landing before giving up, and returns null when even that does not fit", () => {
    expect(centeredSinkRangePair({ lo: 0, hi: 105, sinkBaseWidthIn: 36, dishwasherSide: "right" })!.gapIn).toBe(15);
    expect(centeredSinkRangePair({ lo: 0, hi: 104, sinkBaseWidthIn: 36, dishwasherSide: "right" })).toBeNull();
  });

  it("keeps the range off a window: flips the order first, then slides in 3 in steps", () => {
    // Centered sink-first puts the range at 146.5-176.5; a window there flips the order.
    const flipped = centeredSinkRangePair({ lo: 45, hi: 200, sinkBaseWidthIn: 36, dishwasherSide: "right", blockedForRange: [{ start: 140, end: 180 }] })!;
    expect(flipped.order).toBe("range-first");
    expect(flipped.shiftIn).toBe(0);
    expect(flipped.stoveCenterIn! + 15 <= 140 || flipped.stoveCenterIn! - 15 >= 180).toBe(true);
    // Windows at both ends: neither order clears at the center, so the pair slides
    // (nearest the center first, 3 in steps) until the range clears both.
    const windows = [{ start: 45, end: 75 }, { start: 140, end: 180 }];
    const slid = centeredSinkRangePair({ lo: 45, hi: 200, sinkBaseWidthIn: 36, dishwasherSide: "right", blockedForRange: windows })!;
    expect(slid).toMatchObject({ order: "range-first", shiftIn: 9, openingConflict: false });
    const range = { start: slid.stoveCenterIn! - 15, end: slid.stoveCenterIn! + 15 };
    for (const w of windows) expect(range.end <= w.start || range.start >= w.end).toBe(true);
  });

  it("a sink under a window is fine, but nothing crosses a door", () => {
    const underWindow = centeredSinkRangePair({ lo: 45, hi: 200, sinkBaseWidthIn: 36, dishwasherSide: "right", blockedForRange: [{ start: 70, end: 100 }] })!;
    expect(underWindow).toMatchObject({ order: "sink-first", shiftIn: 0 });
    const door = centeredSinkRangePair({ lo: 45, hi: 200, sinkBaseWidthIn: 36, dishwasherSide: "right", blockedForSink: [{ start: 60, end: 75 }], blockedForRange: [{ start: 60, end: 75 }] })!;
    expect(door).toMatchObject({ order: "sink-first", shiftIn: 9, openingConflict: false });
    expect(door.sinkCenterIn - 18).toBeGreaterThanOrEqual(75);
  });

  it("reports an opening conflict (and stays centered) when no position clears", () => {
    const blocked = centeredSinkRangePair({ lo: 45, hi: 200, sinkBaseWidthIn: 36, dishwasherSide: "right", blockedForSink: [{ start: 45, end: 200 }] })!;
    expect(blocked).toMatchObject({ openingConflict: true, shiftIn: 0, order: "sink-first" });
  });

  it("centers the sink group alone when the range is not added", () => {
    const pair = centeredSinkRangePair({ lo: 0, hi: 120, sinkBaseWidthIn: 36, dishwasherSide: "none", includeStove: false })!;
    expect(pair.sinkCenterIn).toBe(60);
    expect(pair.stoveCenterIn).toBeNull();
  });
});

// Tom (owner voice, Nov 24 2026, 12:28 PM CT): 36 in sink base must qualify; when it does, no smaller ones.
describe("sinkBaseFitOptions", () => {
  it("36 qualifies: only 36 in and larger widths that also fit are offered", () => {
    const fit = sinkBaseFitOptions({ lo: 0, hi: 99, sinkCenterIn: 40, dishwasherSide: "right" });
    expect(fit.qualifies36).toBe(true);
    expect(fit.offered).toEqual([36, 42]);
    expect(fit.offered).not.toContain(30);
    expect(fit.offered).not.toContain(33);
    expect(fit.recommended).toBe(36);
  });

  it("36 qualifies but 42 does not: offers only 36 and disables 42 with a reason", () => {
    // Range typed at 90 (75-105): sink group 36 + DW at center 40 spans 22-82; 42 spans 19-85 -> still fits; tighten.
    const fit = sinkBaseFitOptions({ lo: 0, hi: 99, sinkCenterIn: 40, dishwasherSide: "right", obstacles: [{ start: 82, end: 112 }] });
    expect(fit.offered).toEqual([36]);
    expect(fit.disabled.map((d) => d.width)).toEqual([42]);
  });

  it("36 does not qualify: 36 is disabled with a reason and the largest width that fits is offered", () => {
    // Corner room taken: usable 0-80, sink at 30 with DW right -> SB36 group 12-72 fits? make it not fit.
    const fit = sinkBaseFitOptions({ lo: 14, hi: 80, sinkCenterIn: 30, dishwasherSide: "right" });
    // SB36: 12-72 (starts before 14) -> no; SB33: 13.5-70.5 -> no; SB30: 15-69 -> yes.
    expect(fit.qualifies36).toBe(false);
    expect(fit.offered).toEqual([30]);
    expect(fit.recommended).toBe(30);
    expect(fit.disabled.map((d) => d.width)).toEqual([33, 36, 42]);
    expect(fit.disabled.find((d) => d.width === 36)!.reason).toMatch(/SB36 needs 60 in with the dishwasher/);
  });

  it("uses the largest free run when Auto-Design still chooses the sink spot", () => {
    expect(sinkBaseFitOptions({ lo: 45, hi: 99, sinkCenterIn: null, dishwasherSide: "right" }).offered).toEqual([30]);
    expect(sinkBaseFitOptions({ lo: 0, hi: 144, sinkCenterIn: null, dishwasherSide: "right" }).offered).toEqual([36, 42]);
  });

  it("reserves the corner cabinet room on a layout wall that meets another run", () => {
    const span = autoDesignWallUsableSpan({ room: { width: 180, depth: 200, ceilingHeight: 96 }, layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCount: 4 }, "Wall 2")!;
    expect(span.lo).toBe(45);
    expect(span.hi).toBe(200);
  });
});

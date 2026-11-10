import { describe, expect, it } from "vitest";
import { layoutFillerLabels, shortFillerLabel } from "./fillerLabelLayout";

function label(uid: string, centerXPx: number, groupId = "top/base", overrides: Partial<{ fullText: string; shortText: string }> = {}) {
  return {
    uid,
    groupId,
    centerXPx,
    fullText: overrides.fullText ?? 'FILLER 1-1/4" · MAX 3"',
    shortText: overrides.shortText ?? 'F 1-1/4"',
  };
}

describe("layoutFillerLabels", () => {
  it("leaves a lone label wide and unstacked", () => {
    const [placement] = layoutFillerLabels([label("a", 100)]);
    expect(placement).toEqual({ uid: "a", text: 'FILLER 1-1/4" · MAX 3"', offsetYPx: 0, lane: 0, collapsed: false });
  });

  it("stacks two overlapping banners into two lanes instead of drawing them on top of each other", () => {
    const placements = layoutFillerLabels([label("a", 100), label("b", 108)]);
    expect(placements.map((entry) => entry.lane)).toEqual([0, 1]);
    expect(placements[0]!.offsetYPx).toBe(0);
    expect(placements[1]!.offsetYPx).toBeGreaterThan(0);
    expect(placements.every((entry) => entry.text.startsWith("FILLER"))).toBe(true);
  });

  it("keeps well-separated banners on the same lane", () => {
    const placements = layoutFillerLabels([label("a", 40), label("b", 400)]);
    expect(placements.map((entry) => entry.lane)).toEqual([0, 0]);
    expect(placements.every((entry) => entry.offsetYPx === 0)).toBe(true);
  });

  it("collapses to the short form when a run is too crowded for stacked banners", () => {
    // Five boards a few pixels apart: stacking them all would cover the run.
    const placements = layoutFillerLabels(["a", "b", "c", "d", "e"].map((uid, index) => label(uid, 100 + index * 9)));
    expect(placements.every((entry) => entry.collapsed)).toBe(true);
    expect(placements.map((entry) => entry.text)).toEqual(["F 1-1/4\"", "F 1-1/4\"", "F 1-1/4\"", "F 1-1/4\"", "F 1-1/4\""]);
  });

  it("never draws two labels on the same lane when they overlap, even after collapsing", () => {
    const placements = layoutFillerLabels(["a", "b", "c"].map((uid, index) => label(uid, 200 + index * 2)));
    const byLane = new Map<number, string[]>();
    for (const placement of placements) {
      const lane = byLane.get(placement.lane) ?? [];
      lane.push(placement.uid);
      byLane.set(placement.lane, lane);
    }
    // One label per lane is the only way three 2px-apart labels can be readable.
    for (const [, uids] of byLane) expect(uids).toHaveLength(1);
  });

  it("never collides labels across different runs", () => {
    const placements = layoutFillerLabels([
      label("top-board", 100),
      label("bottom-board", 100, "bottom/base"),
    ]);
    expect(placements.map((entry) => entry.lane)).toEqual([0, 0]);
    expect(placements.every((entry) => entry.offsetYPx === 0)).toBe(true);
  });

  it("is deterministic for the same input", () => {
    const input = [label("a", 100), label("b", 112), label("c", 260)];
    expect(layoutFillerLabels(input)).toEqual(layoutFillerLabels(input));
  });

  it("preserves the caller's order", () => {
    const placements = layoutFillerLabels([label("b", 400), label("a", 40)]);
    expect(placements.map((entry) => entry.uid)).toEqual(["b", "a"]);
  });
});

describe("shortFillerLabel", () => {
  it("shortens the banner but keeps the measurement", () => {
    expect(shortFillerLabel('1-1/4"')).toBe('F 1-1/4"');
    expect(shortFillerLabel('1"')).toBe('F 1"');
    expect(shortFillerLabel('3"')).toBe('F 3"');
  });

  it("marks an over-maximum board", () => {
    expect(shortFillerLabel('4"', true)).toBe('F 4" ⚠');
  });
});

import { describe, expect, it } from "vitest";
import { crownTopRuns, formatCrownTop } from "./crownTopRuns";
import type { PlacedCabinet, RoomData } from "./design";

const room: RoomData = { width: 192, depth: 144, ceilingHeight: 96 };
const cab = (overrides: Partial<PlacedCabinet>): PlacedCabinet => ({
  uid: "x", cabinetId: 1, masterCode: "W2430", description: "Wall Cabinet", placement: "wall",
  x: 0, y: 0, width: 24, depth: 12, height: 30, rotation: 0, mountBottom: 54, wallId: "top",
  ...overrides,
});

describe("crownTopRuns", () => {
  it("merges touching uppers at the same top into one run with one badge", () => {
    const runs = crownTopRuns([
      cab({ uid: "a", x: 0 }),
      cab({ uid: "b", x: 24 }),
      cab({ uid: "c", x: 48, width: 30 }),
    ], room);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.top).toBe(84);
    expect(runs[0]!.uids.sort()).toEqual(["a", "b", "c"]);
    expect(runs[0]!.mismatch).toBe(false);
    expect(runs[0]!.start).toBe(0);
    expect(runs[0]!.end).toBe(78);
  });

  it("flags two runs on one wall whose tops differ (12-inch fridge bridge beside 42-inch uppers)", () => {
    const runs = crownTopRuns([
      cab({ uid: "bridge", masterCode: "WR3612", x: 0, width: 36, depth: 24, height: 12, mountBottom: 72 }),
      cab({ uid: "w2442", x: 36, height: 42, mountBottom: 54 }),
      cab({ uid: "w3042", x: 60, width: 30, height: 42, mountBottom: 54 }),
    ], room);
    expect(runs).toHaveLength(2);
    const bridge = runs.find((run) => run.uids.includes("bridge"))!;
    const uppers = runs.find((run) => run.uids.includes("w2442"))!;
    expect(bridge.top).toBe(84);
    expect(uppers.top).toBe(96);
    expect(bridge.mismatch).toBe(true);
    expect(uppers.mismatch).toBe(true);
    expect(bridge.otherTops).toEqual([96]);
    expect(uppers.otherTops).toEqual([84]);
  });

  it("does not flag runs on different walls against each other", () => {
    const runs = crownTopRuns([
      cab({ uid: "a", x: 0 }),
      cab({ uid: "r", x: 180, y: 40, rotation: 90, wallId: "right", height: 42 }),
    ], room);
    expect(runs).toHaveLength(2);
    expect(runs.every((run) => run.mismatch === false)).toBe(true);
  });

  it("separates non-touching same-height uppers into separate runs without a mismatch", () => {
    const runs = crownTopRuns([
      cab({ uid: "a", x: 0 }),
      cab({ uid: "b", x: 60 }),
    ], room);
    expect(runs).toHaveLength(2);
    expect(runs.every((run) => run.mismatch === false)).toBe(true);
  });

  it("formats tops in inches with eighths", () => {
    expect(formatCrownTop(96)).toBe('96"');
    expect(formatCrownTop(84.5)).toBe('84 1/2"');
    expect(formatCrownTop(90.375)).toBe('90 3/8"');
  });
});

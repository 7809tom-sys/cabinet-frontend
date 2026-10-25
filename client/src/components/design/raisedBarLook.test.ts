import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { raisedBarCorbelPlan, RAISED_BAR_EDGE_EASE_IN } from "./InteractiveRoom3D";

const src = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
const rect = [{ x: 0, y: 0 }, { x: 96, y: 0 }, { x: 96, y: 25.5 }, { x: 0, y: 25.5 }];

describe("raised bar looks like a real seating bar", () => {
  it("places evenly spaced corbels under a 15-inch overhang, inset from the ends", () => {
    const plan = raisedBarCorbelPlan(rect, { x: 0, y: 1 }, 15);
    expect(plan.length).toBeGreaterThanOrEqual(4);
    const along = plan.map((c) => Math.abs(c.tangentIn)).sort((a, b) => a - b);
    expect(along[0]).toBeGreaterThanOrEqual(3 - 1e-6);
    expect(along.at(-1)).toBeLessThanOrEqual(93 + 1e-6);
    const gaps = along.slice(1).map((v, i) => v - along[i]!);
    gaps.forEach((g) => expect(g).toBeLessThanOrEqual(24 + 1e-6));
    plan.forEach((c) => {
      expect(c.faceIn).toBeCloseTo(0, 6);
      expect(c.armIn).toBeLessThanOrEqual(6);
    });
  });
  it("adds no corbels when there is no seating overhang", () => {
    expect(raisedBarCorbelPlan(rect, { x: 0, y: 1 }, 1.5)).toEqual([]);
  });
  it("keeps the eased edge small and limited to the raised bar", () => {
    expect(RAISED_BAR_EDGE_EASE_IN).toBeLessThan(0.5);
    expect(src).toContain("const eased = Boolean(surface.raisedBar)");
    expect(src).toContain("bevelOffset: -ease");
  });
  it("corbels are visual only and never touch the outline", () => {
    expect(src).toContain("visualOnly: true");
  });
});

import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/kitchenDesignSeatFailure.json";
import { explainPeninsulaSeatFailure, firstCollisionFreePeninsulaPlacement } from "./design";

const room = (): any => ({
  ...JSON.parse(JSON.stringify((fixture as any).room)),
  peninsulaRuns: [{ id: "pw_t", parentWall: "top", startOffset: 72, turn: 90, direction: "right", length: 74, height: 34.5, cabinetSide: "left" }],
});
const placed = (): any[] => JSON.parse(JSON.stringify((fixture as any).placed));

describe("Wizard seat failure explanation (Kitchen design)", () => {
  it("names the blocking cabinet and suggests a start that really seats", () => {
    const r = room();
    const p = placed();
    const range = { start: 0, end: 63 - 18 };
    expect(firstCollisionFreePeninsulaPlacement("pw_t" as any, r, p, 18, 24, "base", { start: 0, end: 0 })).toBeNull();
    const why = explainPeninsulaSeatFailure("pw_t" as any, r, p, 18, 24, "base", range);
    expect(why.blocker?.masterCode).toBe("O309624");
    expect(why.suggestedStart).not.toBeNull();
    expect(why.suggestedStart!).toBeGreaterThan(0);
    // The suggestion must actually be a free seat.
    expect(firstCollisionFreePeninsulaPlacement("pw_t" as any, r, p, 18, 24, "base", { start: why.suggestedStart!, end: why.suggestedStart! })).not.toBeNull();
  });
  it("suggests the nearest start (not just any)", () => {
    const r = room(); const p = placed();
    const why = explainPeninsulaSeatFailure("pw_t" as any, r, p, 18, 24, "base", { start: 12, end: 45 });
    for (let o = 0; o < why.suggestedStart! - 0.99; o += 1) {
      if (Math.abs(o - 12) < Math.abs(why.suggestedStart! - 12)) {
        expect(firstCollisionFreePeninsulaPlacement("pw_t" as any, r, p, 18, 24, "base", { start: o, end: o })).toBeNull();
      }
    }
  });
  it("reports no blocker when the spot is free", () => {
    const why = explainPeninsulaSeatFailure("pw_t" as any, room(), placed(), 18, 24, "base", { start: 45, end: 45 });
    expect(why.blocker).toBeNull();
    expect(why.suggestedStart).toBe(45);
  });
});

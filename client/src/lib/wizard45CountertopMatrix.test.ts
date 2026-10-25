import { describe, expect, it } from "vitest";
import saved from "./__fixtures__/wizard45Saved.json";
import { countertopSurfaces, countertopSurfacePlanPolygon } from "./design";

const bounds = (surfaces: any[]) => {
  const pts = surfaces.flatMap((s) => countertopSurfacePlanPolygon(s));
  return { minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)) };
};
const build = (raised: boolean, seating: 0 | 12 | 15, drywall: boolean) => {
  const room: any = JSON.parse(JSON.stringify(saved.room));
  for (const run of room.peninsulaRuns) { run.countertopRaisedBar = raised; run.countertopSeatingOverhang = seating; }
  const ponyWalls = drywall ? [{ id: "pw", peninsulaRunId: room.peninsulaRuns[0].id, peninsulaPlacement: "behind-cabinets", finish: "drywall", x: 108, y: 0, length: 48, height: 40.5, thickness: 0.5, rotation: 90 }] : [];
  return countertopSurfaces(saved.placed as any, room, null, ponyWalls as any) as any[];
};

describe("Wizard 45-degree countertop matrix (right return)", () => {
  for (const drywall of [false, true]) {
    const tag = drywall ? "with drywall" : "without drywall";
    it(`regular top, standard edge ${tag}: stays on the cabinets`, () => {
      const lows = build(false, 0, drywall).filter((s) => !s.raisedBar);
      expect(lows.length).toBe(3);
      expect(bounds(lows).maxX).toBeCloseTo(108, 1);
    });
    for (const seating of [12, 15] as const) {
      it(`regular top, ${seating}" outward ${tag}: extends out the back only`, () => {
        const lows = build(false, seating, drywall).filter((s) => !s.raisedBar);
        const b = bounds(lows);
        expect(b.maxX).toBeCloseTo(108 + seating, 1);
        expect(b.minX).toBeCloseTo(48.2, 1); // cabinet-facing edge unchanged (never forward)
      });
    }
    it(`step bar ${tag}: lower top stays on cabinets, raised strip 15" behind`, () => {
      const all = build(true, 0, drywall);
      expect(bounds(all.filter((s) => !s.raisedBar)).maxX).toBeCloseTo(108, 1);
      expect(all.filter((s) => s.raisedBar).length).toBe(2);
      expect(bounds(all.filter((s) => s.raisedBar && s.rotation !== 135 && countertopSurfacePlanPolygon(s).length === 4).slice(0, 1)).maxX).toBeCloseTo(123, 1);
    });
  }
});

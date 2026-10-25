import { describe, expect, it } from "vitest";
import saved from "./__fixtures__/wizard45RaisedBarSaved.json";
import { countertopSurfaces, countertopSurfacePlanPolygon } from "./design";
describe("Wizard 45-degree raised bar outer corner", () => {
  it("extends the two strips to one shared mitre line: no notch, no third piece", () => {
    const raised = countertopSurfaces(saved.placed as any, saved.room as any).filter((s: any) => s.raisedBar) as any[];
    expect(raised.length).toBe(2);
    const [a, b] = raised.map((s) => countertopSurfacePlanPolygon(s));
    expect(a!.length).toBe(4);
    expect(b!.length).toBe(4);
    const shared = a!.filter((p) => b!.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 0.05));
    // exactly the outer and inner mitre points are common to both strips
    expect(shared.length).toBe(2);
  });
  it("never lets the raised strips cover the lower worktop", () => {
    const all = countertopSurfaces(saved.placed as any, saved.room as any) as any[];
    const lowerMaxX = Math.max(...all.filter((s) => !s.raisedBar && countertopSurfacePlanPolygon(s).some((p) => p.y < 47)).flatMap((s) => countertopSurfacePlanPolygon(s).map((p) => p.x)));
    const straight = all.find((s) => s.raisedBar && countertopSurfacePlanPolygon(s).every((p) => p.x >= lowerMaxX - 0.5 || p.y > 47) )!;
    expect(straight).toBeTruthy();
  });
	it("keeps the supported segments and fills the program countertop opening", () => {
		const lows = countertopSurfaces(saved.placed as any, saved.room as any).filter((s: any) => !s.raisedBar);
		expect(lows.length).toBe(3);
		expect(lows.some((surface: any) => (surface.areaInches ?? 0) > 200 && (surface.areaInches ?? 0) < 300)).toBe(true);
  });
});
import { readFileSync } from "node:fs";
describe("corbels are optional", () => {
  it("3D draws corbels only when the run opts in", () => {
    const src = readFileSync("client/src/components/design/InteractiveRoom3D.tsx", "utf8");
    expect(src).toContain("run.countertopRaisedBarCorbels ? raisedBarCorbelPlan(");
    const wiz = readFileSync("client/src/pages/DesignTool.tsx", "utf8");
    expect(wiz).toContain("countertopRaisedBarCorbels: draft.corbels === true");
  });
});

describe("Wizard 45-degree raised bar: lower-level gap beside the riser", () => {
  it("keeps the intentional triangle beside the riser open", () => {
    const all = countertopSurfaces(saved.placed as any, saved.room as any) as any[];
    const polys = all.filter((s) => !s.raisedBar).map((s) => countertopSurfacePlanPolygon(s));
    const hit = (x: number, y: number) => polys.some((poly) => {
      let h = false;
      for (let k = 0, m = poly.length - 1; k < poly.length; m = k++) {
        const a = poly[k]!, b = poly[m]!;
        if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) h = !h;
      }
      return h;
    });
    // centroid of the former void: (108,48) (108,59) (100.2,66.8)
    expect(hit(105.4, 57.9)).toBe(false);
  });
});

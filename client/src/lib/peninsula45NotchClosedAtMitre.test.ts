import { describe, expect, it } from 'vitest';
import live from './__fixtures__/wizard45LiveTurn.json';
import saved from './__fixtures__/wizard45RaisedBarSaved.json';
import { countertopSurfaces, countertopSurfacePlanPolygon } from './design';
type P = { x: number; y: number };
const inside = (pt: P, poly: readonly P[]) => {
  let hit = false;
  for (let k = 0, m = poly.length - 1; k < poly.length; m = k++) {
    const a = poly[k]!, b = poly[m]!;
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};
const slabs = (fx: any) => countertopSurfaces(fx.placed, fx.room, null, []);
const polys = (list: ReturnType<typeof slabs>) => list.map(countertopSurfacePlanPolygon);
describe('Wizard 45-degree supported seam and raised-bar miter', () => {
  const apex = { x: 122, y: 90 };
  it('joins the raised strips at the miter even when the straight bar is split by a real gap', () => {
    const raised = polys(slabs(live).filter(s => s.raisedBar));
    expect(raised.filter(poly => poly.some(p => Math.hypot(p.x - apex.x, p.y - apex.y) < .3))).toHaveLength(2);
  });
  it('fills the measured lower structural seam, not the unsupported back-of-bar triangle', () => {
    const all = slabs(live);
    const fill = all.find(s => s.peninsulaMiterInfill)!;
    expect(fill).toBeTruthy();
    expect(fill.areaInches).toBeCloseTo(248.94535988955067, 6);
    expect(fill.raisedBar).not.toBe(true);
    expect(fill.peninsulaRunIds).toHaveLength(2);
    const lower = polys(all.filter(s => !s.raisedBar));
    expect(lower.some(poly => inside({ x: 119, y: 108 }, poly))).toBe(true);
    // This older triangle centroid is behind the actual supported seam; filling it
    // would invent a floating countertop over open floor rather than close a joint.
    expect(lower.some(poly => inside({ x: (111 + 122 + 129.8) / 3, y: (90 + 90 + 97.8) / 3 }, poly))).toBe(false);
  });
  it('puts no lower countertop behind the real cabinet back edge', () => {
    const lower = polys(slabs(live).filter(s => !s.raisedBar)).flat();
    for (const p of lower) expect(p.y).toBeGreaterThanOrEqual(89.95);
    for (const p of lower.filter(p => Math.abs(p.y - 90) < .05 && p.x > 100)) expect(p.x).toBeLessThanOrEqual(apex.x + .05);
  });
  it('covers every interior sample in the actual structural seam at the lower level only', () => {
    const all = slabs(live), lower = polys(all.filter(s => !s.raisedBar));
    const wedge = countertopSurfacePlanPolygon(all.find(s => s.peninsulaMiterInfill)!);
    let tested = 0;
    for (let x = 111.25; x < 130; x += .5) for (let y = 90.25; y < 116; y += .5) {
      if (!inside({ x, y }, wedge)) continue;
      tested++;
      expect(lower.some(poly => inside({ x, y }, poly)), `uncovered seam ${x},${y}`).toBe(true);
    }
    expect(tested).toBeGreaterThan(500);
    expect(all.filter(s => s.raisedBar).every(s => !s.peninsulaMiterInfill)).toBe(true);
  });
  it('keeps the earlier fixture as two shared raised strips plus one lower-only miter fill', () => {
    const all = slabs(saved), raised = polys(all.filter(s => s.raisedBar));
    expect(raised).toHaveLength(2);
    const shared = raised[0]!.filter(p => raised[1]!.some(q => Math.hypot(p.x-q.x,p.y-q.y)<.05));
    expect(shared).toHaveLength(2);
    expect(all.filter(s => s.peninsulaMiterInfill)).toHaveLength(1);
  });
});

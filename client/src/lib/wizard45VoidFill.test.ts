import { describe, expect, it } from "vitest";
import saved from "./__fixtures__/wizard45Saved.json";
import { countertopSurfaces, countertopSurfacePlanPolygon } from "./design";

const countertopPolygonArea = (poly: { x: number; y: number }[]) =>
  Math.abs(poly.reduce((sum, p, i) => { const q = poly[(i + 1) % poly.length]!; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
const splitLevelLows = () => countertopSurfaces(saved.placed as any, saved.room as any).filter((s: any) => !s.raisedBar);

describe("Wizard 45-degree peninsula lower countertop", () => {
	it("adds a lower countertop fill across the tiered miter opening", () => {
		const lows = countertopSurfaces(saved.placed as any, saved.room as any).filter((s: any) => !s.raisedBar);
		const total = lows.reduce((sum: number, s: any) => sum + countertopPolygonArea(countertopSurfacePlanPolygon(s)), 0);
		expect(lows).toHaveLength(3);
		expect(total).toBeCloseTo(2696.94535988955, 6);
  });
});
describe("Wizard 45-degree miter wedge winding", () => {
  it("is counter-clockwise like every other slab so its top face is visible", () => {
    const signed = (p: { x: number; y: number }[]) => p.reduce((sum, q, i) => { const n = p[(i + 1) % p.length]!; return sum + q.x * n.y - n.x * q.y; }, 0) / 2;
    const lows = countertopSurfaces(saved.placed as any, saved.room as any).filter((s: any) => !s.raisedBar);
		expect(lows.length).toBe(3);
    for (const s of lows) expect(signed(countertopSurfacePlanPolygon(s))).toBeGreaterThan(0);
  });
});

describe("tiered Wizard peninsula void policy", () => {
	it("fills the former lower-level opening with matching countertop", () => {
		const lows = splitLevelLows();
		expect(lows).toHaveLength(3);
		expect(lows.every((surface: any) => surface.peninsulaRunIds?.length !== 0)).toBe(true);
		const filled = lows.find((surface: any) => (surface.areaInches ?? 0) > 200 && (surface.areaInches ?? 0) < 300);
		expect(filled).toMatchObject({ peninsulaRunIds: expect.arrayContaining(["peninsula_wizard_mv13btdx", "peninsula_wizard_mv13btdx_45_end"]) });
  });

  it("does not change ordinary peninsula void-fill geometry", () => {
    const room: any = JSON.parse(JSON.stringify(saved.room));
    for (const run of room.peninsulaRuns) {
      run.countertopRaisedBar = false;
      run.countertopSeatingOverhang = 12;
      if (run.wizardRecipe) run.wizardRecipe.countertopTreatment = "regular";
    }
    const lows = countertopSurfaces(saved.placed as any, room).filter((s: any) => !s.raisedBar);
    expect(lows).toHaveLength(3);
    expect(lows.some((surface: any) => (surface.areaInches ?? 0) > 400)).toBe(true);
  });

  it("keeps the structural void and opposite-side raised top identical for no appliance and every cooktop mode", () => {
    const modes = ["none", "gas", "electric", "induction", "slide-in"] as const;
    const structural = (placed: any[]) => countertopSurfaces(placed, saved.room as any)
      .filter((surface: any) => surface.raisedBar)
      .map((surface: any) => countertopSurfacePlanPolygon(surface));
    const base = structural(saved.placed as any);
		const voidFillArea = (placed: any[]) => countertopSurfaces(placed, saved.room as any)
			.filter((surface: any) => !surface.raisedBar && (surface.areaInches ?? 0) > 200 && (surface.areaInches ?? 0) < 300)
			.reduce((sum: number, surface: any) => sum + (surface.areaInches ?? 0), 0);
		expect(voidFillArea(saved.placed as any)).toBeCloseTo(248.94535988955, 6);
    for (const mode of modes.slice(1)) {
      const placed = [...(saved.placed as any[]), {
        uid: `qa-${mode}`,
        cabinetId: 9900001,
        masterCode: "RANGE30",
        description: `${mode} cooktop`,
        category: "Appliances",
        subCategory: "Ranges",
        placement: "appliance",
        applianceRole: "countertop-opening",
        x: 84, y: 0, width: 30, depth: 24, height: 34.5, rotation: 90,
        wallId: "peninsula_wizard_mv145zsh", wallOffset: 9,
        peninsulaWizardId: "peninsula_wizard_mv145zsh",
        rangeTopType: mode,
      }];
      expect(structural(placed)).toEqual(base);
			expect(voidFillArea(placed)).toBeCloseTo(248.94535988955, 6);
    }
  });
});

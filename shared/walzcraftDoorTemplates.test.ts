import { describe, it, expect } from "vitest";
import {
  WALZCRAFT_PROFILE_TEMPLATES,
  rankProfiles,
  rankShades,
  buildProfileGeometry,
  GLAZE_OPTIONS,
  GLAZE_LINE_WIDTH_IN,
  stepsFor,
  drawerFrontFor,
  type WalzProfileTemplate,
} from "./walzcraftDoorTemplates";

describe("walzcraftDoorTemplates", () => {
  it("has 7 seed templates with unique ids including the expected styles", () => {
    expect(WALZCRAFT_PROFILE_TEMPLATES).toHaveLength(7);
    const ids = WALZCRAFT_PROFILE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["S109", "S102", "S586", "S592", "S841", "S424", "S579"]) {
      expect(ids).toContain(id);
    }
  });

  it("S109 has published values and is not estimated", () => {
    const s109 = WALZCRAFT_PROFILE_TEMPLATES.find((t) => t.id === "S109");
    expect(s109).toBeDefined();
    if (!s109) return;
    expect(s109.frameProfile).toBe("MP722-57");
    expect(s109.frameWidth.value).toBe(2.25);
    expect(s109.faceBevelDeg.value).toBe(7.4);
    expect(s109.panelProfile).toBe("PR317-25");
    expect(s109.panelReveal.value).toBe(1);
    expect(s109.thickness.value).toBe(0.75);
    expect(s109.frameWidth.estimated).toBe(false);
    expect(s109.faceBevelDeg.estimated).toBe(false);
    expect(s109.panelReveal.estimated).toBe(false);
    expect(s109.thickness.estimated).toBe(false);
  });

  it("S592 and S841 have at least one estimated dimension", () => {
    for (const id of ["S592", "S841"]) {
      const t = WALZCRAFT_PROFILE_TEMPLATES.find((x) => x.id === id);
      expect(t).toBeDefined();
      if (!t) continue;
      const dims = [t.frameWidth, t.faceBevelDeg, t.panelReveal, t.thickness];
      expect(dims.some((d) => d.estimated)).toBe(true);
    }
  });

  it("rankProfiles returns top 4 with expected confidences and ids", () => {
    const ranked = rankProfiles();
    expect(ranked).toHaveLength(4);
    expect(ranked.map((r) => r.confidence)).toEqual([70, 30, 20, 10]);
    expect(ranked.map((r) => r.template.id)).toEqual(["S109", "S102", "S586", "S592"]);
  });

  it("rankProfiles is data-driven and accepts extra templates", () => {
    const extra: WalzProfileTemplate = {
      id: "TEST-99",
      name: "Test Extra",
      frameProfile: null,
      panelProfile: null,
      corner: "mitered",
      frameWidth: { value: 2.5, estimated: true },
      faceBevelDeg: { value: 5, estimated: true },
      panelReveal: { value: 1, estimated: true },
      thickness: { value: 0.75, estimated: true },
      panelStyle: "raised-bevel",
      frameDetail: "slant-bevel",
      baseScore: 99,
    };
    const ranked = rankProfiles([...WALZCRAFT_PROFILE_TEMPLATES, extra]);
    expect(ranked).toHaveLength(4);
    expect(ranked[0].template.id).toBe("TEST-99");
    expect(ranked[0].confidence).toBe(99);
  });

  it("rankShades returns 4 in descending confidence order", () => {
    const ranked = rankShades();
    expect(ranked).toHaveLength(4);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].confidence).toBeGreaterThanOrEqual(ranked[i].confidence);
    }
  });

  it("buildProfileGeometry produces finite, bounded geometry for every template", () => {
    for (const t of WALZCRAFT_PROFILE_TEMPLATES) {
      const geo = buildProfileGeometry(t);
      expect(geo.outline.length).toBeGreaterThanOrEqual(5);
      expect(geo.recesses.length).toBeGreaterThanOrEqual(1);
      for (const [x, y] of geo.outline) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(geo.widthIn);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(geo.thicknessIn);
      }
      for (const poly of geo.recesses) {
        for (const [x, y] of poly) {
          expect(Number.isFinite(x)).toBe(true);
          expect(Number.isFinite(y)).toBe(true);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(geo.widthIn);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(geo.thicknessIn);
        }
      }
    }
  });

  it("glaze line width is 1/8in and options are none/black/gold with gold stroke", () => {
    expect(GLAZE_LINE_WIDTH_IN).toBe(0.125);
    expect(GLAZE_OPTIONS.map((o) => o.id)).toEqual(["none", "black", "gold"]);
    const gold = GLAZE_OPTIONS.find((o) => o.id === "gold");
    expect(gold?.stroke).toBe("#d7a46c");
  });

  it("stepsFor excludes profile and glaze for slab, includes all 6 for five-piece", () => {
    const slab = stepsFor("slab");
    expect(slab).not.toContain("profile");
    expect(slab).not.toContain("glaze");
    const five = stepsFor("five-piece");
    expect(five).toHaveLength(6);
    expect(five).toEqual(["type", "profile", "shade", "glaze", "drawers", "review"]);
  });

  it("drawerFrontFor handles slab and base five-piece correctly", () => {
    const slab = drawerFrontFor(null, "base", "slab");
    expect(slab.style).toBe("slab");

    const s109 = WALZCRAFT_PROFILE_TEMPLATES.find((t) => t.id === "S109");
    expect(s109).toBeDefined();
    if (!s109) return;
    const base = drawerFrontFor(s109, "base", "five-piece");
    expect(base.railProfile).toBe("MP722-38");

    const wall = drawerFrontFor(s109, "wall", "five-piece");
    expect(wall.note).toContain("Wall cabinets");
  });

  it("glaze option strokes are not blue-ish", () => {
    for (const opt of GLAZE_OPTIONS) {
      const hex = opt.stroke.replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      expect(b).toBeLessThanOrEqual(r + 40);
      expect(b).toBeLessThanOrEqual(g + 40);
    }
  });
});

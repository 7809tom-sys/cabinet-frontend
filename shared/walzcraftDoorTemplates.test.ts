import { describe, it, expect } from "vitest";
import {
  WALZCRAFT_PROFILE_TEMPLATES,
  WALZCRAFT_SHADE_FAMILIES,
  WALZCRAFT_SHADE_COLORS,
  rankProfiles,
  rankShades,
  rankProfilesForShade,
  shadesForProfile,
  buildProfileGeometry,
  GLAZE_OPTIONS,
  GLAZE_LINE_WIDTH_IN,
  stepsFor,
  nextStep,
  drawerFrontFor,
  drawerProfileOptions,
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

  it("every profile has exactly four shades", () => {
    for (const t of WALZCRAFT_PROFILE_TEMPLATES) {
      expect(shadesForProfile(t.id)).toHaveLength(4);
    }
  });

  it("no two profiles share a shade set or shade", () => {
    const keys = WALZCRAFT_PROFILE_TEMPLATES.map((t) =>
      shadesForProfile(t.id)
        .map((s) => s.id)
        .sort()
        .join("|"),
    );
    expect(new Set(keys).size).toBe(keys.length);

    const allShadeIds = WALZCRAFT_PROFILE_TEMPLATES.flatMap((t) =>
      shadesForProfile(t.id).map((s) => s.id),
    );
    expect(new Set(allShadeIds).size).toBe(4 * WALZCRAFT_PROFILE_TEMPLATES.length);
  });

  it("every family has exactly 4 shades, all same familyId, valid hex, hexEstimated true", () => {
    for (const family of WALZCRAFT_SHADE_FAMILIES) {
      const shades = WALZCRAFT_SHADE_COLORS.filter((s) => s.familyId === family.id);
      expect(shades).toHaveLength(4);
      for (const s of shades) {
        expect(s.familyId).toBe(family.id);
        expect(s.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(s.hexEstimated).toBe(true);
      }
    }
  });

  it("rankShades(familyId) returns that family's 4; rankShades() returns one leader per family", () => {
    for (const family of WALZCRAFT_SHADE_FAMILIES) {
      const ranked = rankShades(family.id);
      expect(ranked).toHaveLength(4);
      for (const r of ranked) {
        expect(r.shade.familyId).toBe(family.id);
      }
    }

    const leaders = rankShades();
    expect(leaders).toHaveLength(WALZCRAFT_SHADE_FAMILIES.length);
    const familyIds = leaders.map((r) => r.shade.familyId);
    expect(new Set(familyIds).size).toBe(familyIds.length);
  });

  it("rankProfilesForShade ranks agave and eggshell correctly", () => {
    const agave = rankProfilesForShade("agave");
    expect(agave.length).toBeGreaterThan(0);
    expect(agave[0].template.id).toBe("S592");
    expect(agave[0].confidence).toBe(99);

    const eggshell = rankProfilesForShade("eggshell");
    expect(eggshell.length).toBeGreaterThan(0);
    expect(eggshell[0].template.id).toBe("S109");
  });

  it("drawerProfileOptions returns unique ids and correct options", () => {
    const all = drawerProfileOptions();
    const ids = all.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);

    const slab = drawerProfileOptions(null, "base", "slab");
    expect(slab).toHaveLength(1);
    expect(slab[0].id).toBe("slab");

    const s109 = WALZCRAFT_PROFILE_TEMPLATES.find((t) => t.id === "S109");
    expect(s109).toBeDefined();
    if (!s109) return;
    const five = drawerProfileOptions(s109, "base", "five-piece");
    const fiveIds = five.map((o) => o.id);
    expect(fiveIds).toContain("match");
    expect(fiveIds).toContain("full");
    expect(fiveIds).toContain("slab");
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

  it("stepsFor five-piece and slab sequences, and nextStep advances", () => {
    expect(stepsFor("five-piece")).toEqual([
      "color",
      "type",
      "profile",
      "drawers",
      "glaze",
      "review",
    ]);
    expect(stepsFor("slab")).toEqual(["color", "type", "drawers", "review"]);
    expect(nextStep("color", "five-piece")).toBe("type");
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

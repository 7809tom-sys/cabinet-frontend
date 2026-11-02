import { describe, expect, it } from "vitest";
import {
  SHERWIN_WILLIAMS_STAINS,
  SHERWIN_WILLIAMS_STAIN_SOURCE,
  SHERWIN_WILLIAMS_STAIN_WHEEL,
  STAIN_WHEEL_ENDS,
  nearestStain,
  normalizeStainCode,
  stainAtPosition,
  stainByCode,
  stainByName,
  stainLabel,
  stainLightness,
  stainPositionOf,
  stainWheelGradient,
} from "./sherwinWilliamsStain";

describe("Sherwin-Williams stain data", () => {
  it("cites the published stain pages it was built from", () => {
    expect(SHERWIN_WILLIAMS_STAIN_SOURCE.publisher).toBe("Sherwin-Williams");
    expect(SHERWIN_WILLIAMS_STAIN_SOURCE.documents.join(" ")).toContain("stain-colors/interior-stains");
    expect(SHERWIN_WILLIAMS_STAIN_SOURCE.documents.join(" ")).toContain("stain-colors/exterior-stains");
    expect(SHERWIN_WILLIAMS_STAIN_SOURCE.method).toMatch(/median of its inner 50% box/);
    expect(SHERWIN_WILLIAMS_STAINS.length).toBeGreaterThan(200);
  });

  it("uses real published stain names and codes, each with its own page", () => {
    const early = stainByCode("MW230");
    expect(early).toMatchObject({ code: "MW230", name: "Early American" });
    expect(early?.page).toBe("https://www.sherwin-williams.com/homeowners/color/find-and-explore-colors/stain-colors/early-american-mw230");
    expect(early?.swatch.startsWith("https://sherwin.scene7.com/is/image/sw/")).toBe(true);
    expect(stainByCode("MW2716")?.name).toBe("Dark Walnut");
    expect(stainByCode("DB2306")?.name).toBe("Rosewood");
  });

  it("has no invented names, no duplicate codes, and every code on a published page", () => {
    const codes = new Set<string>();
    for (const stain of SHERWIN_WILLIAMS_STAINS) {
      expect(stain.code).toMatch(/^[A-Z]{2,4}\d{3,4}[A-Z]*$/);
      expect(stain.name.trim().length).toBeGreaterThan(0);
      expect(stain.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(stain.page.startsWith("https://www.sherwin-williams.com/homeowners/color/find-and-explore-colors/stain-colors/")).toBe(true);
      expect(codes.has(stain.code)).toBe(false);
      codes.add(stain.code);
    }
  });

  it("reads a typed stain code and refuses an unknown one", () => {
    expect(normalizeStainCode("mw 230")).toBe("MW230");
    expect(normalizeStainCode("MW-230")).toBe("MW230");
    expect(stainByCode("mw230")?.name).toBe("Early American");
    expect(stainByCode("MW9999")).toBeNull();
    expect(stainByCode("S592")).toBeNull();
    expect(stainByName("Early American")?.code).toBe("MW230");
    expect(stainLabel(stainByCode("MW230")!)).toBe("MW230 Early American");
  });

  it("slides continuously from light maple to dark smoke over published stains only", () => {
    expect(STAIN_WHEEL_ENDS).toEqual({ light: "light maple", dark: "dark smoke" });
    expect(SHERWIN_WILLIAMS_STAIN_WHEEL.length).toBe(SHERWIN_WILLIAMS_STAINS.length);
    const light = stainAtPosition(0);
    const dark = stainAtPosition(1);
    expect(stainLightness(light)).toBeGreaterThan(stainLightness(dark));
    expect(stainLightness(light)).toBeGreaterThan(80);
    expect(stainLightness(dark)).toBeLessThan(30);
    for (let step = 0; step <= 100; step += 1) {
      const stain = stainAtPosition(step / 100);
      expect(SHERWIN_WILLIAMS_STAINS.some((entry) => entry.code === stain.code)).toBe(true);
    }
    let previous = stainLightness(stainAtPosition(0));
    for (let step = 1; step <= 100; step += 1) {
      const next = stainLightness(stainAtPosition(step / 100));
      expect(next).toBeLessThanOrEqual(previous + 0.001);
      previous = next;
    }
  });

  it("draws the wheel from measured stain hexes and locates a stain on it", () => {
    const early = stainByCode("MW230")!;
    expect(stainAtPosition(stainPositionOf(early)).code).toBe("MW230");
    const hexes = (stainWheelGradient().match(/#[0-9a-f]{6}/g) ?? []);
    expect(hexes.length).toBeGreaterThan(10);
    for (const hex of hexes) expect(SHERWIN_WILLIAMS_STAINS.some((stain) => stain.hex === hex)).toBe(true);
  });

  it("finds the nearest published stain with a CIEDE2000 distance", () => {
    const early = stainByCode("MW230")!;
    const hit = nearestStain(early.hex);
    expect(hit?.stain.code).toBe("MW230");
    expect(hit?.deltaE).toBe(0);
    expect(nearestStain("nope")).toBeNull();
  });

  it("never claims light maple or dark smoke as a published stain name", () => {
    const names = SHERWIN_WILLIAMS_STAINS.map((stain) => stain.name.toLowerCase());
    expect(names).not.toContain("light maple");
    expect(names).not.toContain("dark smoke");
  });
});

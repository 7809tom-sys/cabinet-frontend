import { describe, expect, it } from "vitest";
import {
  SHERWIN_WILLIAMS_PAINT_COLORS,
  SHERWIN_WILLIAMS_PAINT_SOURCE,
  SHERWIN_WILLIAMS_PAINT_WHEEL,
  normalizePaintCode,
  paintAtPosition,
  paintColorByCode,
  paintColorByName,
  paintHexFromChannels,
  paintLightness,
  paintPositionOf,
  paintWheelGradient,
  nearestPaintColor,
  paintHueFamily,
} from "./sherwinWilliamsPaint";

describe("Sherwin-Williams paint data", () => {
  it("is the published chart, cited in the data file", () => {
    expect(SHERWIN_WILLIAMS_PAINT_SOURCE.publisher).toBe("Sherwin-Williams");
    expect(SHERWIN_WILLIAMS_PAINT_SOURCE.url).toBe(
      "https://images.sherwin-williams.com/content_images/sw-pdf-sherwin-williams-colorc.pdf",
    );
    expect(SHERWIN_WILLIAMS_PAINT_SOURCE.columns).toContain("HEX COLOR");
    expect(SHERWIN_WILLIAMS_PAINT_COLORS.length).toBeGreaterThan(1500);
  });

  it("keeps the published hex for a known chip, unchanged", () => {
    // The chart's own row: SW7005 Pure White 255-C1 237 236 230 EDECE6
    expect(paintColorByCode("SW 7005")).toEqual({
      code: "SW7005",
      name: "Pure White",
      locator: "255-C1",
      hex: "#edece6",
      rgb: [237, 236, 230],
    });
    expect(paintColorByCode("SW7015")?.hex).toBe("#ccc9c0");
    expect(paintColorByCode("7069")?.name).toBe("Iron Ore");
  });

  it("has no empty names, duplicate codes, or hexes that disagree with the published RGB", () => {
    const codes = new Set<string>();
    for (const color of SHERWIN_WILLIAMS_PAINT_COLORS) {
      expect(color.code).toMatch(/^SW\d{4}$/);
      expect(color.name.trim().length).toBeGreaterThan(0);
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(paintHexFromChannels(color.rgb)).toBe(color.hex);
      expect(codes.has(color.code)).toBe(false);
      codes.add(color.code);
    }
  });

  it("reads a typed chip code in every form the admin might type, and never invents a color", () => {
    for (const typed of ["SW 7005", "sw7005", "SW-7005", "7005", " sw  7005 "]) {
      expect(normalizePaintCode(typed)).toBe("SW7005");
      expect(paintColorByCode(typed)?.code).toBe("SW7005");
    }
    expect(paintColorByCode("SW 9999")).toBeNull();
    expect(paintColorByCode("not a code")).toBeNull();
    expect(paintColorByCode("")).toBeNull();
    expect(normalizePaintCode("12345")).toBeNull();
  });

  it("finds a chip by published name", () => {
    expect(paintColorByName("Pure White")?.code).toBe("SW7005");
    expect(paintColorByName("pure white")?.code).toBe("SW7005");
    expect(paintColorByName("Not A Color")).toBeNull();
  });

  it("runs one continuous wheel over every published chip, grouped by hue family", () => {
    expect(SHERWIN_WILLIAMS_PAINT_WHEEL.length).toBe(SHERWIN_WILLIAMS_PAINT_COLORS.length);
    // Every position returns a real published chip, never a synthesized blend.
    for (let step = 0; step <= 200; step += 1) {
      const color = paintAtPosition(step / 200);
      expect(SHERWIN_WILLIAMS_PAINT_COLORS.some((entry) => entry.code === color.code)).toBe(true);
    }
    // Each hue family is one unbroken run, so a slide never jumps between unrelated hues.
    const families: string[] = [];
    for (const color of SHERWIN_WILLIAMS_PAINT_WHEEL) {
      const family = paintHueFamily(color);
      if (families[families.length - 1] !== family) {
        expect(families).not.toContain(family);
        families.push(family);
      }
    }
    expect(families.length).toBeGreaterThan(3);
  });

  it("walks lightest to darkest inside each family", () => {
    const wheel = SHERWIN_WILLIAMS_PAINT_WHEEL;
    for (let index = 1; index < wheel.length; index += 1) {
      const previous = wheel[index - 1]!;
      const current = wheel[index]!;
      if (paintHueFamily(previous) !== paintHueFamily(current)) continue;
      expect(paintLightness(current)).toBeLessThanOrEqual(paintLightness(previous) + 0.001);
    }
  });

  it("reports where a chip sits on the wheel and draws every stop from published hexes", () => {
    const pure = paintColorByCode("SW7005")!;
    expect(paintPositionOf(pure)).toBeGreaterThanOrEqual(0);
    expect(paintPositionOf(pure)).toBeLessThanOrEqual(1);
    expect(paintAtPosition(paintPositionOf(pure)).code).toBe(pure.code);
    const gradient = paintWheelGradient();
    expect(gradient.startsWith("linear-gradient(90deg, ")).toBe(true);
    const hexes = gradient.match(/#[0-9a-f]{6}/g) ?? [];
    expect(hexes.length).toBeGreaterThan(10);
    for (const hex of hexes) {
      expect(SHERWIN_WILLIAMS_PAINT_COLORS.some((color) => color.hex === hex)).toBe(true);
    }
  });

  it("finds the nearest published chip without creating a new color", () => {
    const nearest = nearestPaintColor("#edece7");
    expect(nearest?.code).toBe("SW7005");
    expect(nearestPaintColor("not a hex")).toBeNull();
  });
});

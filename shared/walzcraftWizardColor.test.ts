import { describe, expect, it } from "vitest";
import catalog from "./fixtures/doorStyleSideCatalog.json";
import { resolveDoorColor, type DoorColorInput } from "./doorColorResolve";
import {
  PAINT_FINISH,
  SHERWIN_WILLIAMS_ATTRIBUTION,
  STAIN_FINISH,
  paintAt,
  readPaintCodeInput,
  readStainCodeInput,
  stainAt,
  wizardColorByCode,
  wizardColorByPaintCode,
  wizardColorByStainCode,
  wizardColorPosition,
  wizardSavePatch,
} from "./walzcraftWizardColor";
import { SHERWIN_WILLIAMS_PAINT_COLORS } from "./sherwinWilliamsPaint";
import { SHERWIN_WILLIAMS_STAINS } from "./sherwinWilliamsStain";

const BRAND = ["#dedac6", "#fffdf9", "#f6f3ed", "#244338", "#d7a46c"];
const styles = catalog as DoorColorInput[];

describe("wizard color: Sherwin-Williams stain and paint", () => {
  it("slides the stain wheel from light maple to dark smoke over published stains", () => {
    const light = stainAt(0);
    const dark = stainAt(1);
    expect(light.finish).toBe(STAIN_FINISH);
    expect(dark.finish).toBe(STAIN_FINISH);
    expect(light.keepsGrain).toBe(true);
    expect(light.hex).not.toBe(dark.hex);
    for (let step = 0; step <= 40; step += 1) {
      const color = stainAt(step / 40);
      expect(SHERWIN_WILLIAMS_STAINS.some((stain) => stain.code === color.code)).toBe(true);
      expect(color.keepsGrain).toBe(true);
      expect(BRAND).not.toContain(color.hex);
    }
  });

  it("slides the paint wheel over published chips and keeps paint opaque", () => {
    const light = paintAt(0);
    const dark = paintAt(1);
    expect(light.finish).toBe(PAINT_FINISH);
    expect(light.keepsGrain).toBe(false);
    expect(light.hex).not.toBe(dark.hex);
    for (let step = 0; step <= 40; step += 1) {
      const color = paintAt(step / 40);
      expect(SHERWIN_WILLIAMS_PAINT_COLORS.some((chip) => chip.code === color.code)).toBe(true);
      expect(color.keepsGrain).toBe(false);
    }
  });

  it("selects the exact chip for a typed SW code", () => {
    const result = readPaintCodeInput("SW 7005");
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.color).toMatchObject({ finish: PAINT_FINISH, code: "SW7005", name: "Pure White", hex: "#edece6", label: "SW 7005 Pure White" });
    expect(readPaintCodeInput("7015").found).toBe(true);
  });

  it("says plainly when a typed SW code is not published, and picks no color", () => {
    const result = readPaintCodeInput("SW 9999");
    expect(result.found).toBe(false);
    if (result.found) return;
    expect(result.message).toMatch(/SW9999 is not in the published Sherwin-Williams chart/);
    expect(result.message).toMatch(/No color is assumed/);
  });

  it("says plainly when a typed stain code is not published, and picks no color", () => {
    const stain = readStainCodeInput("MW230");
    expect(stain.found).toBe(true);
    if (stain.found) expect(stain.color.label).toBe("MW230 Early American");
    const miss = readStainCodeInput("MW9999");
    expect(miss.found).toBe(false);
    if (!miss.found) expect(miss.message).toMatch(/No color is assumed/);
  });

  it("reads a code from either wheel with one lookup", () => {
    expect(wizardColorByCode("SW 7005")?.finish).toBe(PAINT_FINISH);
    expect(wizardColorByCode("MW230")?.finish).toBe(STAIN_FINISH);
    expect(wizardColorByCode("not a code")).toBeNull();
    expect(wizardColorByStainCode("SW7005")).toBeNull();
    expect(wizardColorByPaintCode("MW230")).toBeNull();
  });

  it("places a chosen color back on its own wheel", () => {
    const paint = wizardColorByPaintCode("SW7005")!;
    expect(paintAt(wizardColorPosition(paint)).code).toBe("SW7005");
    const stain = wizardColorByStainCode("MW230")!;
    expect(stainAt(wizardColorPosition(stain)).code).toBe("MW230");
    expect(wizardColorPosition(null)).toBe(0);
  });

  it("saves paint as a solid through the existing hex/grain path", () => {
    const paint = wizardColorByPaintCode("SW 7005")!;
    expect(wizardSavePatch(paint, null)).toEqual({ renderHex: "#edece6", woodSpecies: null, grainDirection: "none" });
  });

  it("keeps the grain for a stain and carries its direction", () => {
    const stain = wizardColorByStainCode("MW230")!;
    expect(wizardSavePatch(stain, { name: "Grey Wood", orientation: "horizontal" })).toEqual({
      renderHex: "#9a6e51",
      woodSpecies: "Grey Wood",
      grainDirection: "horizontal",
    });
    // A stain cannot be applied without a grain: a stain with no species is refused, not guessed.
    expect(wizardSavePatch(stain, null)).toBeNull();
    expect(wizardSavePatch(stain, { name: null, orientation: null })).toBeNull();
  });

  it("never routes a picked Sherwin-Williams hex through the brand palette", () => {
    for (const code of ["SW 7005", "SW 7015", "SW 7069", "SW 6244", "SW 6258"]) {
      const color = wizardColorByCode(code)!;
      expect(BRAND).not.toContain(color.hex);
      const patch = wizardSavePatch(color, { name: "Grey Wood", orientation: "vertical" })!;
      expect(patch.renderHex).toBe(color.hex);
      // The resolved door color keeps the hand-set hex exactly.
      const resolved = resolveDoorColor({ ...styles[0]!, renderHex: patch.renderHex });
      expect(resolved.appliedHex).toBe(color.hex);
    }
  });

  it("cites Sherwin-Williams as the source the admin sees", () => {
    expect(SHERWIN_WILLIAMS_ATTRIBUTION).toContain("Sherwin-Williams");
    expect(SHERWIN_WILLIAMS_ATTRIBUTION).toContain("sw-pdf-sherwin-williams-colorc.pdf");
    expect(SHERWIN_WILLIAMS_ATTRIBUTION).toMatch(/measured from the swatch image/);
  });
});

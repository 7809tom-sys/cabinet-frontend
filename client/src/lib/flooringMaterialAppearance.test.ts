import { describe, expect, it } from "vitest";
import {
  THREE_D_MOSAIC_MACRO_FIELD_IN,
  THREE_D_NEUTRAL_FLOOR_COLOR,
  threeDAverageMaterialHex,
  threeDCuratedIdentityMatches,
  threeDFlooringFallbackColor,
  preferredDesignerMosaicUrl,
  threeDMosaicSheetMap,
  threeDRetailContentBounds,
  threeDTextureUrlIsColorMap,
} from "./flooringMaterialAppearance";

describe("flooring material appearance", () => {
  it("matches a curated floor by name, and by id only when no other name is supplied", () => {
    expect(threeDCuratedIdentityMatches("Acorn 20mil Dryback Planks", 999, "acorn 20mil dryback planks", 40)).toBe(true);
    expect(threeDCuratedIdentityMatches(null, 40, "acorn 20mil dryback planks", 40)).toBe(true);
    expect(threeDCuratedIdentityMatches("Greenline Square", 40, "acorn 20mil dryback planks", 40)).toBe(false);
    expect(threeDCuratedIdentityMatches("Bahia 20mil Vinyl Flooring", 82, "bahia 12mil vinyl flooring", 82)).toBe(false);
  });

  it("keeps a sampled product color and refuses debug primaries", () => {
    expect(threeDFlooringFallbackColor("#00ff00")).toBe(THREE_D_NEUTRAL_FLOOR_COLOR);
    expect(threeDFlooringFallbackColor("#0000ff")).toBe(THREE_D_NEUTRAL_FLOOR_COLOR);
    expect(threeDFlooringFallbackColor("#ff00ff")).toBe(THREE_D_NEUTRAL_FLOOR_COLOR);
    expect(threeDFlooringFallbackColor("#800080")).toBe(THREE_D_NEUTRAL_FLOOR_COLOR);
    expect(threeDFlooringFallbackColor("#000000")).toBe(THREE_D_NEUTRAL_FLOOR_COLOR);
    expect(threeDFlooringFallbackColor(null)).toBe(THREE_D_NEUTRAL_FLOOR_COLOR);
    const oak = threeDFlooringFallbackColor("#b28a5a");
    expect(oak).not.toBe(THREE_D_NEUTRAL_FLOOR_COLOR);
    expect(oak.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    const blueStone = threeDFlooringFallbackColor("#8e9aa5");
    expect(blueStone).not.toBe("#0000ff");
    expect(blueStone).not.toBe(THREE_D_NEUTRAL_FLOOR_COLOR);
  });

  it("averages the product picture and ignores a white retail margin", () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);
    data.fill(255);
    for (let y = 4; y < 7; y += 1) {
      for (let x = 4; x < 7; x += 1) {
        const index = (y * width + x) * 4;
        data[index] = 180;
        data[index + 1] = 140;
        data[index + 2] = 90;
        data[index + 3] = 255;
      }
    }
    const sampled = threeDAverageMaterialHex(data, width, height);
    expect(sampled).not.toBe(THREE_D_NEUTRAL_FLOOR_COLOR);
    expect(sampled).not.toBeNull();
    const bounds = threeDRetailContentBounds(data, width, height);
    expect(bounds).toEqual({ x: 4, y: 4, width: 3, height: 3 });
  });

  it("does not crop a full-bleed sheet and does not treat a normal map as a color map", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let index = 0; index < data.length; index += 4) {
      data[index] = 90;
      data[index + 1] = 80;
      data[index + 2] = 70;
      data[index + 3] = 255;
    }
    expect(threeDRetailContentBounds(data, 4, 4)).toBeNull();
    expect(threeDTextureUrlIsColorMap("/manus-storage/pelican/floor_normal.jpg")).toBe(false);
    expect(threeDTextureUrlIsColorMap("/manus-storage/pelican/floor_roughness.png")).toBe(false);
    expect(threeDTextureUrlIsColorMap("/manus-storage/pelican/95_belmont.png")).toBe(true);
  });

  it("repeats a mosaic close-up across the chips it shows, and a Designer upload across the sheet", () => {
    const macro = threeDMosaicSheetMap(
      "/manus-storage/carbon_hex_candidate_1_2af63616.png",
      12.8,
      11.1,
    );
    expect(macro.macroCandidate).toBe(true);
    expect(macro.widthIn).toBe(THREE_D_MOSAIC_MACRO_FIELD_IN);
    expect(macro.widthIn).toBeLessThan(12);
    const sheet = threeDMosaicSheetMap(
      "/manus-storage/carbon_hex_candidate_1_2af63616.png",
      12.8,
      11.1,
      "/manus-storage/pelican/products/142/1793556207681-de516bbe_0314bfe8.webp",
    );
    expect(sheet).toMatchObject({
      url: "/manus-storage/pelican/products/142/1793556207681-de516bbe_0314bfe8.webp",
      widthIn: 12.8,
      heightIn: 11.1,
      cropRetailBackground: false,
      macroCandidate: false,
    });
    const fullSheet = threeDMosaicSheetMap(
      "/manus-storage/desert_clay_11_81_interlocking_mosaic_0aa381c4.webp",
      11.81,
      11.81,
    );
    expect(fullSheet).toMatchObject({ widthIn: 11.81, heightIn: 11.81, macroCandidate: false });
  });

  it("uses the Designer slot and never the catalog card as a mosaic texture", () => {
    const card = "/manus-storage/pelican/142_kitchen.jpg";
    const designer = "/manus-storage/pelican/products/142/sheet.webp";
    expect(preferredDesignerMosaicUrl(card, card, null)).toBe("");
    expect(preferredDesignerMosaicUrl(card, card, designer)).toBe(designer);
    expect(preferredDesignerMosaicUrl(designer, card, null)).toBe(designer);
    expect(preferredDesignerMosaicUrl(null, card, null)).toBe("");
  });
});

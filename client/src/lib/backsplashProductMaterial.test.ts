import { describe, expect, it } from "vitest";
import { threeDProductMaterialSource } from "@/components/design/InteractiveRoom3D";
import { buildPhotorealPrompt } from "@shared/photorealPrompt";
import {
  BACKSPLASH_ROOM_SCENE_FIDELITY,
  backsplashTextureWarningMessage,
  absoluteApprovedMaterialUrl,
  mapBacksplashSelectionToMaterial,
  resolveDesignerMaterialUrl,
} from "./backsplashProductMaterial";

const moonstone = {
  id: 364,
  name: "Moonstone Hex",
  pelicanCode: "Moonstone Hex",
  sku: "MS-HEX-1181",
  category: "Tile & Mosaic",
  subCategory: "Mosaic",
  size: '11.81" x 11.81"',
  materialImageUrl: null,
  imageUrl: "/manus-storage/pelican/364_moonstone.png",
};

describe("backsplash selection to material", () => {
  it("maps a catalog mosaic with only a product picture onto that picture at sheet size", () => {
    const mapped = mapBacksplashSelectionToMaterial(moonstone);
    expect(mapped).toEqual({
      productId: 364,
      name: "Moonstone Hex",
      sku: "MS-HEX-1181",
      textureUrl: "/manus-storage/pelican/364_moonstone.png",
      imageSource: "product-image",
      widthIn: 11.81,
      heightIn: 11.81,
      patternKind: "interlocking-mosaic",
      proceduralFallback: false,
      warning: null,
    });

    const source = threeDProductMaterialSource("backsplash", mapped.name, mapped.textureUrl, {
      productId: mapped.productId,
      category: moonstone.category,
      subCategory: moonstone.subCategory,
      size: moonstone.size,
    });
    expect(source).toMatchObject({
      url: "/manus-storage/pelican/364_moonstone.png",
      key: "catalog-backsplash:364",
      curated: false,
      proceduralFallback: false,
      textureUnavailable: false,
      physicalWidthIn: 11.81,
      physicalDepthIn: 11.81,
      backsplashPatternKind: "interlocking-mosaic",
      backsplashModuleIn: 11.81,
      backsplashModuleHeightIn: 11.81,
      sourceProductName: "Moonstone Hex",
    });
    expect(source?.key).not.toBe("representative-backsplash");
  });

  it("prefers an approved swatch over the retail picture and ignores a thickness number", () => {
    const mapped = mapBacksplashSelectionToMaterial({
      ...moonstone,
      size: "11.81 x 11.81 x 8",
      materialImageUrl: "/manus-storage/moonstone_hex_sheet.webp",
      imageUrl: "/manus-storage/pelican/364_moonstone.png",
    });
    expect(mapped.textureUrl).toBe("/manus-storage/moonstone_hex_sheet.webp");
    expect(mapped.imageSource).toBe("approved-swatch");
    expect(mapped.widthIn).toBe(11.81);
    expect(mapped.heightIn).toBe(11.81);
  });

  it("keeps a known curated mosaic on its measured map even when a card photo is also present", () => {
    const source = threeDProductMaterialSource("backsplash", "Desert Clay", "/manus-storage/pelican/183_55da5bcf.png", {
      productId: 183,
      category: "Tile & Mosaic",
      subCategory: "Mosaic",
      size: "11.81 x 11.81 x 8",
    });
    expect(source).toMatchObject({
      url: "/manus-storage/desert_clay_11_81_interlocking_mosaic_0aa381c4.webp",
      curated: true,
      proceduralFallback: false,
      backsplashModuleIn: 11.81,
    });
  });

  it("does not invent a generic tile when the selected product has no image", () => {
    const mapped = mapBacksplashSelectionToMaterial({
      id: 1003,
      name: "PL-O2519WBS",
      pelicanCode: "PL-O2519WBS",
      category: "Tile & Mosaic",
      subCategory: "Tile",
      size: null,
      materialImageUrl: null,
      imageUrl: null,
    });
    expect(mapped.textureUrl).toBeNull();
    expect(mapped.imageSource).toBe("missing");
    expect(mapped.widthIn).toBe(12);
    expect(mapped.heightIn).toBe(12);
    expect(mapped.patternKind).toBe("field-tile");
    expect(mapped.warning).toBe(backsplashTextureWarningMessage("PL-O2519WBS", "missing"));
    expect(mapped.proceduralFallback).toBe(false);

    const source = threeDProductMaterialSource("backsplash", mapped.name, mapped.textureUrl, {
      productId: mapped.productId,
      category: "Tile & Mosaic",
      subCategory: "Tile",
    });
    expect(source).toMatchObject({
      url: "",
      key: "backsplash-image-unavailable",
      proceduralFallback: false,
      textureUnavailable: true,
      backsplashModuleIn: 12,
    });
  });

  it("loads /manus-storage paths from this site and from the permanent asset host elsewhere", () => {
    expect(resolveDesignerMaterialUrl("/manus-storage/pelican/364_moonstone.png", "https://www.cabinetdealz.com")).toEqual({
      url: "/manus-storage/pelican/364_moonstone.png",
      crossOrigin: null,
    });
    expect(resolveDesignerMaterialUrl("/manus-storage/pelican/364_moonstone.png", "https://preview.example")).toEqual({
      url: "https://www.cabinetdealz.com/manus-storage/pelican/364_moonstone.png",
      crossOrigin: "anonymous",
    });
    expect(resolveDesignerMaterialUrl("  ", "https://www.cabinetdealz.com")).toBeNull();
    const uploaded = "/manus-storage/pelican/products/42/1710000000000-42_ab12cd34.webp";
    expect(resolveDesignerMaterialUrl(uploaded, "https://preview.example")).toEqual({
      url: `https://www.cabinetdealz.com${uploaded}`,
      crossOrigin: "anonymous",
    });
    expect(resolveDesignerMaterialUrl(uploaded, "https://www.cabinetdealz.com")).toEqual({
      url: uploaded,
      crossOrigin: null,
    });
    expect(absoluteApprovedMaterialUrl(uploaded, "https://preview.example")).toBe(`https://www.cabinetdealz.com${uploaded}`);
    expect(absoluteApprovedMaterialUrl("https://cdn.example/slab.jpg", "https://preview.example")).toBe("https://cdn.example/slab.jpg");
  });

  it("names the selected backsplash and its image in the room-scene prompt", () => {
    const mapped = mapBacksplashSelectionToMaterial(moonstone);
    const prompt = buildPhotorealPrompt({
      roomWidthFt: 12,
      roomDepthFt: 10,
      backsplash: mapped.name ?? undefined,
      backsplashImageUrl: mapped.textureUrl ?? undefined,
    });
    expect(prompt).toContain("The backsplash is Moonstone Hex");
    expect(prompt).toContain("/manus-storage/pelican/364_moonstone.png");
    expect(prompt).toContain(BACKSPLASH_ROOM_SCENE_FIDELITY);
  });
});

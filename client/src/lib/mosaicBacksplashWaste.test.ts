import { describe, expect, it } from "vitest";
import {
  cartNoteWithoutMosaicWaste,
  isMosaicBacksplashPick,
  isMosaicProduct,
  MOSAIC_BACKSPLASH_WASTE_NOTE,
  MOSAIC_BACKSPLASH_WASTE_PCT,
  mosaicBacksplashWasteFactor,
  mosaicBacksplashWasteInNote,
  mosaicBacksplashWasteNote,
  mosaicBacksplashWasteSqFt,
  mosaicDetectionUncertainty,
  mosaicSheetSquareFeet,
  readMosaicProduct,
  uncertainMosaicCandidate,
} from "./mosaicBacksplashWaste";

describe("mosaic backsplash waste factor", () => {
  it("is the owner's 5%", () => {
    expect(MOSAIC_BACKSPLASH_WASTE_PCT).toBe(0.05);
    expect(mosaicBacksplashWasteFactor()).toBeCloseTo(1.05, 10);
    expect(MOSAIC_BACKSPLASH_WASTE_NOTE).toBe("includes 5% waste");
  });

  it("turns X sq ft into X * 1.05", () => {
    expect(mosaicBacksplashWasteSqFt(30)).toBeCloseTo(31.5, 10);
    expect(mosaicBacksplashWasteSqFt(20)).toBeCloseTo(21, 10);
    expect(mosaicBacksplashWasteSqFt(1)).toBeCloseTo(1.05, 10);
  });

  it("never invents area for a zero, negative or non-numeric measurement", () => {
    expect(mosaicBacksplashWasteSqFt(0)).toBe(0);
    expect(mosaicBacksplashWasteSqFt(-12)).toBe(0);
    expect(mosaicBacksplashWasteSqFt(Number.NaN)).toBe(0);
  });
});

describe("mosaic sellable unit area", () => {
  const mosaic = { category: "Tile & Mosaic", subCategory: "Mosaic", name: "Arctic Vail" };

  it("reads the published sheet size as square feet and ignores the thickness number", () => {
    // 10.71 x 10.55 in sheet = 0.7847 sq ft. The trailing 8 is 8 mm thickness, not a dimension.
    expect(mosaicSheetSquareFeet({ ...mosaic, size: "10.71 x 10.55 x 8" })).toBeCloseTo((10.71 * 10.55) / 144, 4);
    expect(mosaicSheetSquareFeet({ ...mosaic, size: "11.81 x 11.81 x 8" })).toBeCloseTo((11.81 * 11.81) / 144, 4);
    expect(mosaicSheetSquareFeet({ ...mosaic, size: '12" x 12"' })).toBeCloseTo(1, 4);
  });

  it("refuses to derive a unit area from a product that is not a mosaic", () => {
    expect(mosaicSheetSquareFeet({ category: "Tile & Mosaic", subCategory: "Tile", name: "Glossy White", size: "3 x 6" })).toBeNull();
    expect(mosaicSheetSquareFeet({ category: "Flooring", name: "Mosaic Look LVP", size: "7 x 48" })).toBeNull();
  });

  it("returns null instead of a guessed number when the size is missing or unparseable", () => {
    expect(mosaicSheetSquareFeet({ ...mosaic, size: null })).toBeNull();
    expect(mosaicSheetSquareFeet({ ...mosaic, size: "sample" })).toBeNull();
    expect(mosaicSheetSquareFeet({ ...mosaic, size: "0 x 12" })).toBeNull();
    expect(mosaicSheetSquareFeet(null)).toBeNull();
  });
});

describe("mosaic detection", () => {
  it("reads a Tile & Mosaic row whose sub-category is Mosaic as a mosaic", () => {
    expect(readMosaicProduct({ category: "Tile & Mosaic", subCategory: "Mosaic", name: "Arctic Vail" }))
      .toEqual({ isMosaic: true, signal: "catalog-subcategory" });
  });

  it("ignores a Mosaic sub-category on a row that is not the tile line", () => {
    expect(readMosaicProduct({ category: "Flooring", subCategory: "Mosaic" })).toEqual({ isMosaic: false, signal: null });
    expect(readMosaicProduct({ category: "Quartz Slabs (Countertops)", subCategory: "Mosaic", name: "Apollo 3cm" }))
      .toEqual({ isMosaic: false, signal: null });
  });

  it("reads a verified catalog mosaic by exact SKU", () => {
    expect(readMosaicProduct({ category: "Tile & Mosaic", subCategory: "Tile", name: "Carrara Subway" }))
      .toMatchObject({ isMosaic: true, signal: "catalog-record" });
    expect(readMosaicProduct({ category: "Tile & Mosaic", name: "Moonstone Hex", pelicanCode: "Moonstone Hex" }))
      .toMatchObject({ isMosaic: true });
  });

  it("does not call a Flooring plank a mosaic even when the name says mosaic", () => {
    expect(isMosaicProduct({ category: "Flooring", subCategory: "Planks & Flooring", name: "Mosaic Look LVP" })).toBe(false);
    expect(readMosaicProduct({ category: "Flooring", name: "Mosaic Look LVP" }).signal).toBeNull();
  });

  it("does not call the distributor's cultured-marble vanity tops mosaics", () => {
    // These sit in Tile & Mosaic with subCategory "Tile" and carry an integrated backsplash.
    expect(isMosaicProduct({
      category: "Tile & Mosaic",
      subCategory: "Tile",
      name: "PL-O2519WBS",
      pelicanCode: "PL-O2519WBS",
    })).toBe(false);
  });

  it("does not treat countertop, sink or faucet products as mosaics", () => {
    expect(isMosaicProduct({ category: "Quartz Slabs (Countertops)", subCategory: "Quartz Slab", name: "Apollo 3cm" })).toBe(false);
    expect(isMosaicProduct({ category: "Sinks & Faucets", subCategory: "Faucets", name: "Mosaic Handle Faucet" })).toBe(false);
  });

  it("refuses to guess from a name alone, and reports that row as uncertain instead", () => {
    const legacy = { category: "Backsplash", name: "Carrara Marble Mosaic", subCategory: null };
    expect(readMosaicProduct(legacy)).toEqual({ isMosaic: false, signal: null });
    expect(uncertainMosaicCandidate(legacy)).toBe(true);
    expect(mosaicDetectionUncertainty(legacy)).toMatch(/^UNCERTAIN/);
  });

  it("matches the whole word only, so a product name that merely looks tiled stays field tile", () => {
    expect(uncertainMosaicCandidate({ category: "Tile & Mosaic", subCategory: "Wall Tile", name: "Mosaicato Porcelain" })).toBe(false);
    expect(uncertainMosaicCandidate({ category: "Tile & Mosaic", subCategory: "Wall Tile", name: "Mosaics Wall Tile" })).toBe(true);
  });

  it("explains each verified signal and says nothing for a plain field tile", () => {
    expect(mosaicDetectionUncertainty({ category: "Tile & Mosaic", subCategory: "Mosaic", name: "Arctic Vail" })).toContain("sub-category");
    expect(mosaicDetectionUncertainty({ category: "Tile & Mosaic", subCategory: "Tile", name: "Carrara Subway" })).toContain("verified Pelican catalog row");
    expect(mosaicDetectionUncertainty({ category: "Tile & Mosaic", subCategory: "Wall Tile", name: "Glossy White 3x6" })).toBeNull();
  });

  it("does not guess for an empty or missing product", () => {
    expect(readMosaicProduct(null)).toEqual({ isMosaic: false, signal: null });
    expect(readMosaicProduct({})).toEqual({ isMosaic: false, signal: null });
    expect(mosaicDetectionUncertainty({})).toBeNull();
  });
});

describe("mosaic backsplash pick", () => {
  const mosaicBacksplash = { category: "Tile & Mosaic", subCategory: "Mosaic", name: "Arctic Vail" };

  it("applies to a mosaic installed as the wall backsplash", () => {
    expect(isMosaicBacksplashPick(mosaicBacksplash)).toBe(true);
    expect(mosaicBacksplashWasteNote(mosaicBacksplash)).toBe("includes 5% waste");
  });

  it("does not apply to the same mosaic installed as the floor", () => {
    expect(isMosaicBacksplashPick({ ...mosaicBacksplash, installedAs: "flooring" })).toBe(false);
    expect(mosaicBacksplashWasteNote({ ...mosaicBacksplash, installedAs: "flooring" })).toBeNull();
  });

  it("does not apply to field tile on the backsplash", () => {
    const fieldTile = { category: "Tile & Mosaic", subCategory: "Wall Tile", name: "Glossy White 3x6" };
    expect(isMosaicBacksplashPick(fieldTile)).toBe(false);
    expect(mosaicBacksplashWasteNote(fieldTile)).toBeNull();
  });

  it("does not apply to a countertop that happens to be named like a mosaic", () => {
    expect(isMosaicBacksplashPick({ category: "Quartz Slabs (Countertops)", subCategory: "Quartz Slab", name: "Mosaic White" })).toBe(false);
  });

  it("applies to an older backsplash-category row that is a verified catalog mosaic", () => {
    expect(isMosaicBacksplashPick({ category: "Backsplash", name: "Carrara Subway" })).toBe(true);
    expect(mosaicBacksplashWasteNote({ category: "Backsplash", name: "Carrara Subway" })).toBe("includes 5% waste");
  });

  it("does not apply when the pick is explicitly a different role", () => {
    expect(isMosaicBacksplashPick({ category: "Sinks & Faucets", subCategory: "Sinks", name: "Mosaic Sink" })).toBe(false);
    expect(isMosaicBacksplashPick({ category: "Quartz Slabs (Countertops)", name: "Arctic Vail" })).toBe(false);
  });
});

describe("reading the waste note back off a saved cart line", () => {
  const note = "30.0 sq ft × 5% overage ÷ 5 sq ft/box = 7 boxes (includes 5% waste)";

  it("finds the mosaic waste sentence in the line's quantity note", () => {
    expect(mosaicBacksplashWasteInNote(note)).toBe("includes 5% waste");
    expect(mosaicBacksplashWasteInNote("Layout: Herringbone. 120.0 sq ft × 20% overage ÷ 16 sq ft/box = 9 boxes")).toBe("");
    expect(mosaicBacksplashWasteInNote(null)).toBe("");
  });

  it("lifts it out of the generic note so a cart row never prints it twice", () => {
    expect(cartNoteWithoutMosaicWaste(note)).toBe("30.0 sq ft × 5% overage ÷ 5 sq ft/box = 7 boxes");
    // A note that never carried the mosaic sentence is returned unchanged.
    const plain = "Layout: Herringbone. 120.0 sq ft × 20% overage ÷ 16 sq ft/box = 9 boxes";
    expect(cartNoteWithoutMosaicWaste(plain)).toBe(plain);
    expect(cartNoteWithoutMosaicWaste(undefined)).toBe("");
  });
});

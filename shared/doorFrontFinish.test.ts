import { describe, expect, it } from "vitest";
import { classifyDoorFinish, doorFrontTextureMapping, isFrameFreeGrainTexture, prefersSolidPaintedShakerFace } from "./doorFrontFinish";
import { isPaintedFinish } from "./paintedFinish";

/**
 * Live door_styles row 330002 as doorStyles.list returned it. The door style
 * type is "Shaker". The finish field is the color name, not the word painted.
 * The confirmed color source is hex, and the door photograph is still on the row.
 */
const CREAM = {
  id: 330002,
  ourName: "Classic Cream",
  aliasName: "Aura Cream (Ashford)",
  doorStyle: "Shaker",
  finish: "Aura Cream (Ashford)",
  finishCategory: null,
  color: "f9f7eb",
  renderHex: "#cac2aa",
  doorColorSource: "hex",
  doorColorSourceValue: { hex: "#cac2aa" },
  grainDirection: "none",
  doorSampleImageUrl: "/manus-storage/media-library/classic-cream-door.jpg",
};

const GREEK_VILLA = {
  id: 330006,
  ourName: "Greek Villa",
  doorStyle: "Shaker",
  finish: "Villa Blanc (Ashford)",
  color: "#E8E0D0",
};

const NATURA = {
  id: 330004,
  ourName: "Designer Natural",
  aliasName: "Natura Maple (Ashford)",
  doorStyle: "Shaker",
  finish: "Natura Maple (Ashford)",
  woodSpecies: "Maple",
  color: "#D4B896",
};

describe("prefersSolidPaintedShakerFace", () => {
  it("paints the live Shaker Classic Cream row even though its finish field does not say painted", () => {
    // The old painted check only reads finishCategory and the words paint / HDF / MDF.
    // This row's finish is "Aura Cream (Ashford)", so that check is false and the
    // door photograph was left on the face.
    expect(isPaintedFinish(CREAM)).toBe(false);
    expect(prefersSolidPaintedShakerFace(CREAM)).toBe(true);
  });

  it("paints an off-white shaker whose only saved color is a catalog hex", () => {
    expect(prefersSolidPaintedShakerFace(GREEK_VILLA)).toBe(true);
  });

  it("keeps a maple shaker on its grain photo even when the catalog row has a hex", () => {
    expect(prefersSolidPaintedShakerFace(NATURA)).toBe(false);
  });

  it("keeps hickory on its door photograph", () => {
    // Live Hickory Shaker: a render hex is stored, but there is no hex color
    // source, and the name is hickory, so the grain photo stays.
    expect(prefersSolidPaintedShakerFace({
      id: 330007,
      ourName: "Hickory Shaker",
      doorStyle: "Shaker",
      finish: "Silva Shaker (Ashford)",
      color: "hickory",
      renderHex: "#cc9f5e",
      doorSampleImageUrl: "/manus-storage/media-library/hickory-shaker-door.jpg",
    })).toBe(false);
  });

  it("uses the solid path for a confirmed hex or Sherwin-Williams paint chip on a non-wood door", () => {
    expect(prefersSolidPaintedShakerFace({
      doorStyle: "Shaker",
      ourName: "Custom",
      doorColorSource: "hex",
      doorColorSourceValue: { hex: "#f4f1ea" },
    })).toBe(true);
    expect(prefersSolidPaintedShakerFace({
      doorStyle: "Shaker",
      ourName: "Custom",
      doorColorSource: "sherwin-williams",
      doorColorSourceValue: { finish: "paint", hex: "#edeae0", code: "SW7008", label: "Alabaster" },
    })).toBe(true);
  });

  it("does not let a hex pick pull a maple door off its grain", () => {
    expect(prefersSolidPaintedShakerFace({
      ...NATURA,
      doorColorSource: "hex",
      doorColorSourceValue: { hex: "#f4f1ea" },
    })).toBe(false);
  });

  it("keeps a Sherwin-Williams stain on the photo, and still paints a cream whose source is the original image", () => {
    expect(prefersSolidPaintedShakerFace({
      ...CREAM,
      doorColorSource: "sherwin-williams",
      doorColorSourceValue: { finish: "stain", hex: "#8b5a2b", woodSpecies: "Oak" },
    })).toBe(false);
    // The photograph is not the finish. A painted cream stays flat.
    expect(prefersSolidPaintedShakerFace({
      ...CREAM,
      doorColorSource: "original-image",
    })).toBe(true);
  });

  it("paints a raised-panel cream and leaves a door with no color alone", () => {
    expect(prefersSolidPaintedShakerFace({
      ...CREAM,
      doorStyle: "Raised Panel",
      doorPanelType: "Raised Panel",
    })).toBe(true);
    expect(prefersSolidPaintedShakerFace({ doorStyle: "Shaker", ourName: "Untitled" })).toBe(false);
    expect(prefersSolidPaintedShakerFace({ doorStyle: "Glass", ourName: "Crystal Glass", color: "#e1e0de" })).toBe(false);
    expect(prefersSolidPaintedShakerFace(null)).toBe(false);
  });
});

describe("painted colors across the live door-style inventory", () => {
  it("keeps Warm Toffee on its wood photo", () => {
    const toffee = {
      id: 330030,
      ourName: "Oxford Toffee",
      aliasName: "Warm Toffee (Madison)",
      doorStyle: "Shaker",
      finish: "Warm Toffee (Madison)",
      woodSpecies: "Solid Birch frame / veneered center panel",
      color: "#A07850",
      grainDirection: null,
      doorSampleImageUrl: "/manus-storage/media-library/warm-toffee-door.jpg",
    };
    expect(classifyDoorFinish(toffee).family).toBe("stain");
    expect(prefersSolidPaintedShakerFace(toffee)).toBe(false);
  });

  it("keeps Carmel Shaker and Shaker Espresso on the photo", () => {
    expect(classifyDoorFinish({
      ourName: "Carmel Shaker",
      aliasName: "Terra Shaker (Ashford)",
      doorStyle: "Shaker",
      finish: "Terra Shaker (Ashford)",
      color: "#C8A882",
      renderHex: "#5a4226",
      grainDirection: "none",
    }).family).toBe("stain");
    expect(classifyDoorFinish({
      ourName: "Shaker Espresso",
      aliasName: "Cobalt Abyss (Preston)",
      doorStyle: "Shaker",
      finish: "Cobalt Abyss (Preston)",
      woodSpecies: "Solid Birch",
      color: "#25130e",
      grainDirection: "none",
    }).family).toBe("stain");
  });

  it("paints Zenith Sage even though its color source is an approved AI image", () => {
    const sage = {
      id: 330005,
      ourName: "Fresh Sage",
      aliasName: "Zenith Sage (Ashford)",
      doorStyle: "Shaker",
      finish: "Zenith Sage (Ashford)",
      color: "#8FAF8A",
      renderHex: "#798764",
      doorColorSource: "approved-ai-image",
      grainDirection: "none",
      doorSampleImageUrl: "/manus-storage/media-library/zenith-sage-screenshot.jpg",
    };
    // PR 523 stopped at an image color source, so this row kept the screenshot.
    expect(isPaintedFinish(sage)).toBe(false);
    expect(classifyDoorFinish(sage)).toEqual({
      family: "paint",
      reason: "Paint color name (white, cream, sage, gray, navy, black, and the rest).",
    });
  });

  it("classifies the named paint and stain rows the same way", () => {
    const rows = [
      { ourName: "Classic Cream", doorStyle: "Shaker", finish: "Aura Cream (Ashford)", color: "f9f7eb", renderHex: "#cac2aa", doorColorSource: "hex", doorColorSourceValue: { hex: "#cac2aa" }, grainDirection: "none" },
      { ourName: "Greek Villa", doorStyle: "Shaker", finish: "Villa Blanc (Ashford)", color: "#e3e1dd" },
      { ourName: "Shaker White", doorStyle: "Shaker", finish: "Nova Blanc (Madison)", woodSpecies: "Painted HDF", color: "#F5F5F5", renderHex: "#e3e4df" },
      { ourName: "Shaker Gray", doorStyle: "Shaker", finish: "Cobalt Abyss (Preston)", woodSpecies: "Solid Birch", color: "Gray", renderHex: "#9fa7aa", grainDirection: "none" },
      { id: 330007, ourName: "Hickory Shaker", doorStyle: "Shaker", finish: "Silva Shaker (Ashford)", color: "hickory", renderHex: "#cc9f5e", grainDirection: "horizontal" },
      { ourName: "Designer Natural", aliasName: "Natura Maple (Ashford)", doorStyle: "Shaker", finish: "Natura Maple (Ashford)", color: "#D4B896" },
    ];
    expect(rows.map((row) => classifyDoorFinish(row).family)).toEqual([
      "paint", "paint", "paint", "paint", "stain", "stain",
    ]);
  });
});

describe("doorFrontTextureMapping", () => {
  it("recognizes a frame-free grain board and not a door photograph", () => {
    expect(isFrameFreeGrainTexture("/textures/dlc-fr26/grain/versa-shaker.png")).toBe(true);
    expect(isFrameFreeGrainTexture("/uploads/oak_vertical_grain.jpg")).toBe(true);
    expect(isFrameFreeGrainTexture("/textures/dlc-fr26/door/white-shaker.png")).toBe(false);
    expect(isFrameFreeGrainTexture("/uploads/classic-cream-door.jpg")).toBe(false);
    expect(isFrameFreeGrainTexture(null)).toBe(false);
  });

  it("clamps a door photograph to one copy even when a grain tile repeat is proposed", () => {
    expect(doorFrontTextureMapping({
      sampleUrl: "/uploads/classic-cream-door.jpg",
      grainRepeat: { repeatX: 3.4, repeatY: 2.1 },
    })).toEqual({ wrap: "clamp", repeatX: 1, repeatY: 1, stampPieceGrain: false });
  });

  it("tiles a frame-free grain board at its physical repeat", () => {
    expect(doorFrontTextureMapping({
      sampleUrl: "/textures/dlc-fr26/grain/versa-shaker.png",
      grainRepeat: { repeatX: 3.7, repeatY: 2 },
    })).toEqual({ wrap: "mirror", repeatX: 3.7, repeatY: 2, stampPieceGrain: true });
  });

  it("keeps a curated grain board as one repeating tile", () => {
    expect(doorFrontTextureMapping({
      sampleUrl: "/uploads/rustic_hickory_vertical_grain.jpg",
      curatedGrain: true,
      grainRepeat: { repeatX: 4, repeatY: 4 },
    })).toEqual({ wrap: "repeat", repeatX: 1, repeatY: 1, stampPieceGrain: true });
  });
});

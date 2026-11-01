import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { genericMosaicSheetSpec, mosaicInterlockSpecForName, mosaicPitchIn } from "./backsplashMosaic";
import { acceptTransparentRepeat, transparentRepeatInches } from "./mosaicUnitImage";
import { analyzeMosaicPhoto, clearBakedSheetGrout, imageHasMeaningfulTransparency, measureTransparentSheetRepeat, measuredMosaicOverhangIn, sampleSheetGroutHex } from "./mosaicPhotoAnalysis";

type Rgba = [number, number, number, number];
function photo(width: number, height: number, background: Rgba, draw: (x: number, y: number) => Rgba | null) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = draw(x, y) ?? background;
      data.set(color, (y * width + x) * 4);
    }
  }
  return data;
}
const chip = (x: number, y: number): Rgba => ((Math.floor(x / 10) + Math.floor(y / 10)) % 2 ? [120, 96, 80, 255] : [150, 120, 100, 255]);

describe("mosaic photo analysis: finds the real sheet and its flush repeat", () => {
  it("white margin: box is the sheet, no overhang for a straight-edge sheet", () => {
    const data = photo(400, 400, [255, 255, 255, 255], (x, y) => (x >= 50 && x < 350 && y >= 50 && y < 350 ? chip(x, y) : null));
    const a = analyzeMosaicPhoto(data, 400, 400)!;
    expect(a.box).toEqual({ x: 50, y: 50, width: 300, height: 300 });
    expect(a.overhangXPx).toBe(0);
    expect(a.overhangYPx).toBe(0);
  });

  it("off-white and light-grey margins (the old >=248 white test missed these) are removed too", () => {
    for (const bg of [[240, 240, 236, 255], [226, 226, 226, 255], [247, 244, 238, 255]] as Rgba[]) {
      const data = photo(400, 400, bg, (x, y) => (x >= 40 && x < 360 && y >= 60 && y < 340 ? chip(x, y) : null));
      expect(analyzeMosaicPhoto(data, 400, 400)!.box).toEqual({ x: 40, y: 60, width: 320, height: 280 });
    }
  });

  it("transparent margin", () => {
    const data = photo(400, 400, [0, 0, 0, 0], (x, y) => (x >= 20 && x < 380 && y >= 20 && y < 380 ? chip(x, y) : null));
    const a = analyzeMosaicPhoto(data, 400, 400)!;
    expect(a.background).toBe("transparent");
    expect(a.box).toEqual({ x: 20, y: 20, width: 360, height: 360 });
  });

  it("a thin photo frame line outside the sheet is not mistaken for the sheet", () => {
    const data = photo(400, 400, [250, 250, 250, 255], (x, y) => {
      if (x === 6 || x === 393 || y === 6 || y === 393) return [90, 90, 90, 255];
      return x >= 50 && x < 350 && y >= 50 && y < 350 ? chip(x, y) : null;
    });
    const a = analyzeMosaicPhoto(data, 400, 400)!;
    expect(a.frameLineTrimmed).toBe(true);
    expect(a.box).toEqual({ x: 50, y: 50, width: 300, height: 300 });
  });

  it("fork-edged sheet: the core is the flush part, the fingers on the right and top are the overhang", () => {
    // 300x300 sheet; fingers: the right 20 columns and top 20 rows are present only in alternating 10px bands.
    const data = photo(400, 400, [255, 255, 255, 255], (x, y) => {
      if (x < 50 || x >= 350 || y < 50 || y >= 350) return null;
      const fx = x - 50; const fy = y - 50;
      if (fx >= 280 && Math.floor(fy / 10) % 2 === 1) return null;
      if (fy < 20 && Math.floor(fx / 10) % 2 === 1) return null;
      return chip(x, y);
    });
    const a = analyzeMosaicPhoto(data, 400, 400)!;
    expect(a.box).toEqual({ x: 50, y: 50, width: 300, height: 300 });
    expect(a.overhangXPx).toBe(20);
    expect(a.overhangYPx).toBe(20);
    expect(a.core).toEqual({ x: 50, y: 70, width: 280, height: 280 });
    // 12 in. sheet, 300 px wide: 20 px of fingers is 0.8 in.
    expect(measuredMosaicOverhangIn(a, 12, 12)).toEqual({ overhangXIn: 0.8, overhangYIn: 0.8 });
  });

  it("returns null (keep the estimate) for an empty photo, a tiny sheet, or an implausible overhang", () => {
    expect(analyzeMosaicPhoto(photo(200, 200, [255, 255, 255, 255], () => null), 200, 200)).toBeNull();
    expect(analyzeMosaicPhoto(photo(200, 200, [255, 255, 255, 255], (x, y) => (x < 20 && y < 20 ? chip(x, y) : null)), 200, 200)).toBeNull();
    expect(analyzeMosaicPhoto(new Uint8ClampedArray(10), 200, 200)).toBeNull();
    const a = analyzeMosaicPhoto(photo(400, 400, [255, 255, 255, 255], (x, y) => (x >= 50 && x < 350 && y >= 50 && y < 350 ? chip(x, y) : null)), 400, 400)!;
    expect(measuredMosaicOverhangIn({ ...a, overhangXPx: 120 }, 12, 12)).toBeNull();
    expect(measuredMosaicOverhangIn(null, 12, 12)).toBeNull();
  });
});

describe("transparent designer sheets nest at the stagger, not at the outer rectangle", () => {
  it("a half-brick stagger repeats inside the outer size and does not keep the notches", () => {
    const width = 120;
    const height = 48;
    const data = photo(width, height, [0, 0, 0, 0], (x, y) => {
      const top = y >= 2 && y < 22 && x >= 0 && x < 96;
      const bottom = y >= 24 && y < 46 && x >= 24 && x < 120;
      const groutRow = y >= 22 && y < 24 && x >= 24 && x < 96;
      if (!top && !bottom && !groutRow) return null;
      if (top && x >= 46 && x < 50) return [90, 84, 78, 255];
      if (bottom && x >= 70 && x < 74) return [90, 84, 78, 255];
      if (groutRow) return [90, 84, 78, 255];
      return [236, 236, 232, 255];
    });
    const repeat = measureTransparentSheetRepeat(data, width, height);
    expect(repeat).not.toBeNull();
    expect(repeat!.pitchFractionX).toBeGreaterThan(0.74);
    expect(repeat!.pitchFractionX).toBeLessThan(0.92);
    expect(repeat!.core.width).toBeLessThan(width - 8);
    expect(repeat!.pitchFractionY).toBeGreaterThan(0.9);
    const grout = sampleSheetGroutHex(data, width, height);
    expect(grout).toMatch(/^#[0-9a-f]{6}$/);
    // The notch fill must not be the neutral grey block color.
    expect(grout).not.toBe("#8a8782");
  });

  it("an opaque photo is not given a fake transparent repeat", () => {
    const data = photo(80, 80, [180, 170, 160, 255], () => [180, 170, 160, 255]);
    expect(imageHasMeaningfulTransparency(data, 80, 80)).toBe(false);
    expect(measureTransparentSheetRepeat(data, 80, 80)).toBeNull();
    expect(clearBakedSheetGrout(data, 80, 80)).toBe(0);
  });
});

describe("baked grey grout is a straight joint, not a vein or a gold strip", () => {
  it("clears a full-length grey joint and leaves a short vein and a warm metal strip", () => {
    const data = photo(100, 48, [220, 218, 214, 255], (x, y) => {
      if (y >= 20 && y <= 23) return [72, 68, 64, 255];
      if (x >= 30 && x <= 36 && y >= 4 && y <= 12) return [60, 58, 56, 255];
      if (y >= 40 && y <= 43) return [196, 164, 72, 255];
      return null;
    });
    const vein = data[(8 * 100 + 33) * 4 + 3];
    const gold = data[(41 * 100 + 10) * 4]!;
    expect(clearBakedSheetGrout(data, 100, 48)).toBeGreaterThan(0);
    expect(data[(21 * 100 + 50) * 4 + 3]).toBe(0);
    expect(data[(8 * 100 + 33) * 4 + 3]).toBe(vein);
    expect(data[(41 * 100 + 10) * 4]).toBe(gold);
    expect(data[(41 * 100 + 10) * 4 + 3]).toBe(255);
  });

  it("still treats a sheet as transparent when tile strips touch the border", () => {
    const tile: Rgba = [198, 203, 213, 255];
    const data = photo(120, 80, tile, (x, y) => (x >= 100 && Math.floor(y / 8) % 2 === 1 ? [0, 0, 0, 0] : null));
    const analysis = analyzeMosaicPhoto(data, 120, 80);
    expect(analysis?.background).toBe("transparent");
    expect(analysis!.box.width).toBeGreaterThan(100);
  });
});

const sheetFiles = {
  oat: new URL("./__fixtures__/mosaic-sheets/oat-stone-389.webp", import.meta.url),
  thassos: new URL("./__fixtures__/mosaic-sheets/thassos-subway-1292.webp", import.meta.url),
  cloud: new URL("./__fixtures__/mosaic-sheets/cloudline-marble-149.png", import.meta.url),
  carrara: new URL("./__fixtures__/mosaic-sheets/carrara-subway-144.webp", import.meta.url),
  greystone: new URL("./__fixtures__/mosaic-sheets/greystone-bloom-260.webp", import.meta.url),
  noble: new URL("./__fixtures__/mosaic-sheets/noble-row-380.webp", import.meta.url),
} as const;

async function loadSheet(url: URL) {
  const { data, info } = await sharp(readFileSync(url)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { pixels: new Uint8Array(data), width: info.width, height: info.height };
}

function inches(outer: number, part: number, whole: number) {
  return outer * part / whole;
}

describe("designer uploads nest at the measured repeat", () => {
  it("Oat Stone is transparent and repeats at 10.24 x 11.81 in", async () => {
    const { pixels, width, height } = await loadSheet(sheetFiles.oat);
    expect(analyzeMosaicPhoto(pixels, width, height)?.background).toBe("transparent");
    clearBakedSheetGrout(pixels, width, height);
    const repeat = measureTransparentSheetRepeat(pixels, width, height)!;
    const across = inches(11.97, repeat.core.width, repeat.box.width);
    const up = inches(11.81, repeat.core.height, repeat.box.height);
    expect(Math.abs(Math.round(across * 100) / 100 - 10.24)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(Math.round(up * 100) / 100 - 11.81)).toBeLessThanOrEqual(0.03);
  }, 20000);

  it("Thassos Subway is transparent and repeats at 9.56 x 12.13 in", async () => {
    const { pixels, width, height } = await loadSheet(sheetFiles.thassos);
    expect(analyzeMosaicPhoto(pixels, width, height)?.background).toBe("transparent");
    clearBakedSheetGrout(pixels, width, height);
    const repeat = measureTransparentSheetRepeat(pixels, width, height)!;
    const across = inches(11.97, repeat.core.width, repeat.box.width);
    const up = inches(12.13, repeat.core.height, repeat.box.height);
    expect(Math.abs(Math.round(across * 100) / 100 - 9.56)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(Math.round(up * 100) / 100 - 12.13)).toBeLessThanOrEqual(0.03);
    const offsetIn = inches(11.97, repeat.box.width - repeat.core.width, repeat.box.width);
    expect(offsetIn).toBeGreaterThan(2.2);
    expect(offsetIn).toBeLessThan(2.6);
  }, 20000);

  it("Cloudline Marble nests inside the 11.81 in sheet", async () => {
    const { pixels, width, height } = await loadSheet(sheetFiles.cloud);
    expect(analyzeMosaicPhoto(pixels, width, height)?.background).toBe("transparent");
    clearBakedSheetGrout(pixels, width, height);
    const repeat = measureTransparentSheetRepeat(pixels, width, height)!;
    const across = inches(11.81, repeat.core.width, repeat.box.width);
    const up = inches(11.81, repeat.core.height, repeat.box.height);
    expect(across).toBeGreaterThan(9.6);
    expect(across).toBeLessThan(10.6);
    expect(up).toBeGreaterThan(11.5);
    expect(up).toBeLessThanOrEqual(11.81);
  }, 20000);

  it("Carrara Subway drops its grey joints and nests the running-bond step", async () => {
    const { pixels, width, height } = await loadSheet(sheetFiles.carrara);
    expect(analyzeMosaicPhoto(pixels, width, height)?.background).toBe("transparent");
    const marble = pixels[(200 * width + 400) * 4 + 3];
    expect(clearBakedSheetGrout(pixels, width, height)).toBeGreaterThan(1000);
    expect(pixels[(322 * width + 800) * 4 + 3]).toBe(0);
    expect(pixels[(150 * width + 627) * 4 + 3]).toBe(0);
    expect(pixels[(200 * width + 400) * 4 + 3]).toBe(marble);
    const repeat = measureTransparentSheetRepeat(pixels, width, height)!;
    const across = inches(11.97, repeat.core.width, repeat.box.width);
    const up = inches(12.13, repeat.core.height, repeat.box.height);
    expect(across).toBeGreaterThan(9.2);
    expect(across).toBeLessThan(10.1);
    expect(Math.abs(up - 12.13)).toBeLessThan(0.05);
    expect(repeat.core.width).toBeLessThan(width - 200);
  }, 20000);

  it("Greystone Bloom nests the flower outline inside the sheet", async () => {
    const { pixels, width, height } = await loadSheet(sheetFiles.greystone);
    // The flower outline has no flush rectangle, so the coverage pass may return null.
    // The sheet is still transparent and the repeat is measured from that alpha.
    expect(imageHasMeaningfulTransparency(pixels, width, height)).toBe(true);
    const repeat = measureTransparentSheetRepeat(pixels, width, height)!;
    const across = inches(10.04, repeat.core.width, repeat.box.width);
    const up = inches(9.13, repeat.core.height, repeat.box.height);
    expect(across).toBeGreaterThan(7.8);
    expect(across).toBeLessThan(9.5);
    expect(up).toBeGreaterThan(7.8);
    expect(up).toBeLessThan(9.05);
  }, 20000);

  it("Noble Row nests the stepped ends and keeps the gold strips", async () => {
    const { pixels, width, height } = await loadSheet(sheetFiles.noble);
    expect(analyzeMosaicPhoto(pixels, width, height)?.background).toBe("transparent");
    let goldIndex = -1;
    for (let i = 0; i < width * height; i += 40) {
      const index = i * 4;
      if (pixels[index + 3]! < 200) continue;
      const red = pixels[index]!;
      const blue = pixels[index + 2]!;
      if (red > blue + 12 && red > 150) { goldIndex = index; break; }
    }
    expect(goldIndex).toBeGreaterThan(0);
    const gold = pixels.slice(goldIndex, goldIndex + 4);
    clearBakedSheetGrout(pixels, width, height);
    expect(Array.from(pixels.slice(goldIndex, goldIndex + 4))).toEqual(Array.from(gold));
    const repeat = measureTransparentSheetRepeat(pixels, width, height)!;
    const across = inches(11.81, repeat.core.width, repeat.box.width);
    const up = inches(11.81, repeat.core.height, repeat.box.height);
    expect(across).toBeGreaterThan(10.4);
    expect(across).toBeLessThan(11.4);
    expect(Math.abs(up - 11.81)).toBeLessThan(0.05);
  }, 20000);
});

describe("a measured transparent period wins over the hand-coded pitch", () => {
  it("keeps a plausible sheet measurement and falls back when the period is absurd", () => {
    const thassos = mosaicInterlockSpecForName("Thassos Subway")!;
    const plausible = {
      box: { x: 1, y: 1, width: 1644, height: 1328 },
      core: { x: 160, y: 1, width: 1300, height: 1328 },
      pitchFractionX: 1300 / 1644,
      pitchFractionY: 1,
    };
    const accepted = acceptTransparentRepeat(thassos, plausible);
    expect(accepted).not.toBeNull();
    expect(transparentRepeatInches(thassos, accepted!).x).toBeCloseTo(11.97 * 1300 / 1644, 2);
    expect(transparentRepeatInches(thassos, accepted!).x).not.toBe(mosaicPitchIn(thassos).x);
    expect(acceptTransparentRepeat(thassos, { ...plausible, core: { ...plausible.core, width: 400 } })).toBeNull();
    const oat = genericMosaicSheetSpec("oat stone", 11.97, 11.81);
    const oatRepeat = {
      box: { x: 0, y: 0, width: 1818, height: 1548 },
      core: { x: 129, y: 0, width: 1560, height: 1548 },
      pitchFractionX: 1560 / 1818,
      pitchFractionY: 1,
    };
    expect(acceptTransparentRepeat(oat, oatRepeat)).not.toBeNull();
    expect(transparentRepeatInches(oat, oatRepeat).x).toBeGreaterThan(10);
    expect(transparentRepeatInches(oat, oatRepeat).x).toBeLessThan(oat.outerWidthIn);
  });
});

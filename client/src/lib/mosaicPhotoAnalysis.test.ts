import { describe, expect, it } from "vitest";
import { analyzeMosaicPhoto, measuredMosaicOverhangIn } from "./mosaicPhotoAnalysis";

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

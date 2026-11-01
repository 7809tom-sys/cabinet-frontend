import { describe, expect, it } from "vitest";
import {
  MOSAIC_NO_TRANSPARENCY_WARNING,
  isPelicanTileOrMosaicItem,
  removeBakedCheckerboard,
  type RgbaImage,
} from "./mosaicCheckerboard";

const DARK: [number, number, number] = [198, 198, 198];
const LIGHT: [number, number, number] = [254, 254, 254];

function checkerboard(width: number, height: number, cell: number, paint?: (data: Uint8ClampedArray, width: number, height: number) => void): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0 ? DARK : LIGHT;
      const index = (y * width + x) * 4;
      data[index] = color[0];
      data[index + 1] = color[1];
      data[index + 2] = color[2];
      data[index + 3] = 255;
    }
  }
  paint?.(data, width, height);
  return { data, width, height };
}

function fillRect(data: Uint8ClampedArray, width: number, x0: number, y0: number, x1: number, y1: number, color: [number, number, number, number]) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = color[0];
      data[index + 1] = color[1];
      data[index + 2] = color[2];
      data[index + 3] = color[3];
    }
  }
}

describe("baked transparency checkerboard", () => {
  it("turns a synthetic checkerboard around a sheet into transparency and trims to the opaque pixels", () => {
    const image = checkerboard(80, 80, 8, (data, width) => {
      fillRect(data, width, 24, 24, 56, 56, [36, 92, 168, 255]);
    });
    const cleaned = removeBakedCheckerboard(image);
    expect(cleaned.cleaned).toBe(true);
    expect(cleaned.warning).toBeNull();
    expect(cleaned.width).toBe(32);
    expect(cleaned.height).toBe(32);
    let opaque = 0;
    let transparent = 0;
    for (let index = 0; index < cleaned.data.length; index += 4) {
      if (cleaned.data[index + 3]! === 0) {
        transparent += 1;
        continue;
      }
      opaque += 1;
      expect(cleaned.data[index]).toBe(36);
      expect(cleaned.data[index + 1]).toBe(92);
      expect(cleaned.data[index + 2]).toBe(168);
      expect(cleaned.data[index + 3]).toBe(255);
    }
    expect(opaque).toBe(32 * 32);
    expect(transparent).toBe(0);
  });

  it("still clears a checkerboard whose squares are a few levels off flat gray and white", () => {
    const image = checkerboard(64, 64, 8, (data, width, height) => {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          const wobble = ((x * 3 + y) % 5) - 2;
          data[index] = Math.min(255, data[index]! + wobble);
          data[index + 1] = Math.min(255, data[index + 1]! + wobble);
          data[index + 2] = Math.min(255, data[index + 2]! + wobble);
        }
      }
      fillRect(data, width, 16, 16, 48, 48, [120, 28, 24, 255]);
    });
    const cleaned = removeBakedCheckerboard(image);
    expect(cleaned.cleaned).toBe(true);
    expect(cleaned.warning).toBeNull();
    expect(cleaned.width).toBe(32);
    expect(cleaned.height).toBe(32);
    expect(cleaned.data[0]).toBe(120);
    expect(cleaned.data[3]).toBe(255);
  });

  it("keeps veined white marble opaque on a 128/208 checkerboard (Noir Block)", () => {
    const cell = 16;
    const width = 128;
    const height = 128;
    const dark: [number, number, number] = [128, 128, 128];
    const light: [number, number, number] = [208, 208, 208];
    const marble: [number, number, number, number] = [248, 248, 246, 255];
    const vein: [number, number, number, number] = [176, 176, 174, 255];
    // Close to the light square, and touching the checkerboard, so a loose gray flood would enter.
    const edgeVein: [number, number, number, number] = [200, 200, 198, 255];
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const color = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0 ? dark : light;
        const index = (y * width + x) * 4;
        data[index] = color[0];
        data[index + 1] = color[1];
        data[index + 2] = color[2];
        data[index + 3] = 255;
      }
    }
    const sheet = { x0: 32, y0: 32, x1: 96, y1: 96 };
    fillRect(data, width, sheet.x0, sheet.y0, sheet.x1, sheet.y1, marble);
    fillRect(data, width, sheet.x0, 48, sheet.x1, 51, vein);
    fillRect(data, width, sheet.x0, sheet.y0, sheet.x0 + 3, sheet.y1, edgeVein);
    const count = (pixels: Uint8ClampedArray, color: [number, number, number]) => {
      let matches = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] === color[0] && pixels[index + 1] === color[1] && pixels[index + 2] === color[2] && pixels[index + 3] === 255) {
          matches += 1;
        }
      }
      return matches;
    };
    const cleaned = removeBakedCheckerboard({ data, width, height });
    expect(cleaned.cleaned).toBe(true);
    expect(cleaned.warning).toBeNull();
    expect(cleaned.width * cleaned.height).toBeLessThan(width * height);
    // The gray veins, including the one that touches the checkerboard, stay opaque.
    expect(count(cleaned.data, [176, 176, 174])).toBe(count(data, [176, 176, 174]));
    expect(count(cleaned.data, [200, 200, 198])).toBe(count(data, [200, 200, 198]));
    expect(count(cleaned.data, [248, 248, 246])).toBe(count(data, [248, 248, 246]));
    expect(count(cleaned.data, [128, 128, 128])).toBeLessThan(count(data, [128, 128, 128]) / 4);
    expect(count(cleaned.data, [208, 208, 208])).toBeLessThan(count(data, [208, 208, 208]) / 4);
  });

  it("leaves a plain opaque photo untouched and warns that mosaic edges may seam", () => {
    const width = 48;
    const height = 40;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        data[index] = 30 + ((x * 3) % 180);
        data[index + 1] = 20 + y * 2;
        data[index + 2] = 90 + (x % 7) * 12;
        data[index + 3] = 255;
      }
    }
    const before = data.slice();
    const cleaned = removeBakedCheckerboard({ data, width, height });
    expect(cleaned.cleaned).toBe(false);
    expect(cleaned.warning).toBe(MOSAIC_NO_TRANSPARENCY_WARNING);
    expect(cleaned.warning).toBe("This image has no transparency - mosaic edges may show seams");
    expect(cleaned.width).toBe(width);
    expect(cleaned.height).toBe(height);
    expect(Array.from(cleaned.data)).toEqual(Array.from(before));
  });

  it("does not rewrite an image that already has real transparency", () => {
    const image = checkerboard(48, 48, 8, (data, width) => {
      fillRect(data, width, 0, 0, 48, 8, [0, 0, 0, 0]);
    });
    const cleaned = removeBakedCheckerboard(image);
    expect(cleaned.cleaned).toBe(false);
    expect(cleaned.warning).toBeNull();
    expect(cleaned.width).toBe(48);
    expect(cleaned.height).toBe(48);
    expect(cleaned.data).toBe(image.data);
  });

  it("treats Tile & Mosaic items as the designer upload that needs the check", () => {
    expect(isPelicanTileOrMosaicItem({ category: "Tile & Mosaic", name: "Misty Coast" })).toBe(true);
    expect(isPelicanTileOrMosaicItem({ category: "Wall Tile", subCategory: "Field Tile", name: "Gloss White" })).toBe(true);
    expect(isPelicanTileOrMosaicItem({ category: "Quartz Slabs (Countertops)", name: "Calacatta" })).toBe(false);
    expect(isPelicanTileOrMosaicItem({ name: "Moonstone Hex Mosaic" })).toBe(true);
  });
});

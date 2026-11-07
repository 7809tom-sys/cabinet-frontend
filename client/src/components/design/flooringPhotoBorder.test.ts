// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { threeDSurfaceImageCrop, threeDTrimmedPhotoCrop } from "./InteractiveRoom3D";

/** A square photo with a white border of `margin` pixels around a flat material. */
function whiteBorderedPhoto(size: number, margin: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const border = x < margin || y < margin || x >= size - margin || y >= size - margin;
      const value = border ? 255 : 128;
      const index = (y * size + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return data;
}

describe("Flooring photo white border", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("trims the retail photo's white border so it cannot repeat as a white seam", () => {
    let pixels = new Uint8ClampedArray(0);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({
      drawImage: () => undefined,
      getImageData: () => ({ data: pixels }),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext);

    const fallback = threeDSurfaceImageCrop("flooring");
    // Pelican's 200x200 flooring photos carry margins from about 2% to over 20%.
    for (const margin of [42, 24, 8]) {
      pixels = whiteBorderedPhoto(200, margin);
      const crop = threeDTrimmedPhotoCrop({ naturalWidth: 200, naturalHeight: 200 }, fallback);
      expect(Math.round(crop.x * 200), `left edge at margin ${margin}`).toBeGreaterThanOrEqual(margin);
      expect(Math.round((1 - crop.x - crop.width) * 200), `right edge at margin ${margin}`).toBeGreaterThanOrEqual(margin);
      expect(Math.round(crop.y * 200), `top edge at margin ${margin}`).toBeGreaterThanOrEqual(margin);
      expect(Math.round((1 - crop.y - crop.height) * 200), `bottom edge at margin ${margin}`).toBeGreaterThanOrEqual(margin);
      // The crop still keeps most of the material, so the plank field is not a sliver.
      expect(crop.width * 200).toBeGreaterThan(200 - 2 * margin - 6);
    }
  });

  it("keeps the neutral crop for a photo that is material edge to edge", () => {
    let pixels = whiteBorderedPhoto(200, 0);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({
      drawImage: () => undefined,
      getImageData: () => ({ data: pixels }),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext);

    const fallback = threeDSurfaceImageCrop("flooring");
    expect(threeDTrimmedPhotoCrop({ naturalWidth: 200, naturalHeight: 200 }, fallback)).toEqual(fallback);
    // Silence the unused assignment lint while keeping the pixel source explicit.
    expect(pixels.length).toBe(200 * 200 * 4);
  });

  it("falls back when the canvas cannot be read, such as a cross-origin photo", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => {
      throw new Error("tainted");
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext);
    const fallback = threeDSurfaceImageCrop("backsplash");
    expect(threeDTrimmedPhotoCrop({ naturalWidth: 200, naturalHeight: 200 }, fallback)).toEqual(fallback);
  });
});

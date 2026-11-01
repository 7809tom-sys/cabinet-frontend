import { describe, expect, it } from "vitest";
import { darkenHex, medianPanelColor } from "./sampleDoorColor";

function solid(w: number, h: number, rgba: [number, number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set(rgba, i * 4);
  return d;
}

describe("sampleDoorColor", () => {
  it("returns the panel colour of a flat photo (Versa Shaker's pale golden tone, not a darker tan)", () => {
    expect(medianPanelColor(solid(20, 40, [240, 224, 170, 255]), 20, 40)).toBe("#f0e0aa");
  });
  it("ignores a light frame around the panel", () => {
    const w = 20, h = 40, d = solid(w, h, [245, 245, 245, 255]);
    for (let y = 14; y < 32; y++) for (let x = 6; x < 14; x++) d.set([240, 224, 170, 255], (y * w + x) * 4);
    expect(medianPanelColor(d, w, h)).toBe("#f0e0aa");
  });
  it("returns null for transparent or empty images", () => {
    expect(medianPanelColor(solid(10, 10, [0, 0, 0, 0]), 10, 10)).toBeNull();
    expect(medianPanelColor(new Uint8ClampedArray(0), 0, 0)).toBeNull();
  });
  it("darkens for the outline and leaves bad input alone", () => {
    expect(darkenHex("#f0e0aa", 0.5)).toBe("#787055");
    expect(darkenHex("nope")).toBe("nope");
  });
});

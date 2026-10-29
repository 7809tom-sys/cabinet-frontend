import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const texture = new URL("../../public/textures/rustic_hickory_vertical_grain_v2.webp", import.meta.url);

async function pixels() {
  const { data, info } = await sharp(texture.pathname).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

describe("rustic hickory grain texture", () => {
  it("ships with the site and is what the Designer uses", () => {
    expect(existsSync(texture)).toBe(true);
    const source = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(source).toContain('const RUSTIC_HICKORY_GRAIN_URL = "/textures/rustic_hickory_vertical_grain_v2.webp";');
  });

  it("tiles without a visible seam on either axis", async () => {
    const { data, width, height } = await pixels();
    const at = (x: number, y: number, c: number) => data[(y * width + x) * 3 + c];
    let wrap = 0;
    let inner = 0;
    for (let y = 0; y < height; y++) for (let c = 0; c < 3; c++) {
      wrap += Math.abs(at(width - 1, y, c) - at(0, y, c));
      inner += Math.abs(at(width / 2, y, c) - at(width / 2 - 1, y, c));
    }
    for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) {
      wrap += Math.abs(at(x, height - 1, c) - at(x, 0, c));
      inner += Math.abs(at(x, height / 2, c) - at(x, height / 2 - 1, c));
    }
    // The wrap seam is no rougher than an ordinary interior pixel step.
    expect(wrap).toBeLessThan(inner * 1.5);
  });

  it("reads as light hickory with small knots, not large dark blotches", async () => {
    const { data } = await pixels();
    let dark = 0;
    let light = 0;
    const count = data.length / 3;
    for (let index = 0; index < data.length; index += 3) {
      const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
      if (luminance < 95) dark++;
      if (luminance > 190) light++;
    }
    expect(dark / count).toBeLessThan(0.005);
    expect(light / count).toBeGreaterThan(0.35);
  });
});

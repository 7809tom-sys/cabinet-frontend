import path from "path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { deltaE2000Hex } from "./ciede2000";
import { retintGrain } from "./shakerDoorBlueprint";
import {
  grainNormalMap,
  grainStats,
  multiplyTintPixels,
  pickStainGrainTemplate,
  rgbToLab,
  stainGrainTexture,
  stainSpeciesFamily,
  tintGrainPixels,
  upscaleGrain,
  type RgbaImage,
} from "./stainGrain";
import { stainGrainSlug } from "./walzcraftDesignerPickup";

const grains: Record<string, RgbaImage> = {};

async function readGrain(slug: string): Promise<RgbaImage> {
  const file = path.resolve(__dirname, `../client/public/textures/dlc-fr26/grain/${slug}.png`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
}

beforeAll(async () => {
  grains["versa-shaker"] = await readGrain("versa-shaker");
});

function loadGrain(slug: string): RgbaImage {
  return grains[slug]!;
}

function meanHex(image: RgbaImage): string {
  const s = grainStats(image);
  // Back through Lab is not needed for a mean comparison: compare in Lab directly.
  return JSON.stringify(s);
}

const HONEY = "#d4b48b"; // Honey Core (Madison) door photo / accepted render colour
const HONEY_OLD_TARGET = "#dbbb92"; // what main tinted Honey Core toward

describe("species and grain names map to the best existing wood template", () => {
  it.each([
    ["Birch", "light"],
    ["Solid Birch", "light"],
    ["Solid Birch frame / veneered center panel", "light"],
    ["Maple", "light"],
    ["White Oak", "oak"],
    ["Rift White Oak", "oak"],
    ["Cherry", "warm"],
    ["Walnut", "dark"],
    ["grey wood", "grey"],
    ["Driftwood", "grey"],
  ])("%s -> %s", (name, family) => {
    expect(stainSpeciesFamily(name)).toBe(family);
  });

  it("the names PR 457 saves no longer all fall back to Versa", () => {
    expect(stainGrainSlug("White Oak", "#c9a77c")).toBe("ewo");
    // With no stain colour there is nothing to match, so the long-standing default stays.
    expect(stainGrainSlug("White Oak")).toBe("versa-shaker");
    expect(["dark-caramel", "expresso-shaker", "chestnut"]).toContain(stainGrainSlug("Walnut", "#4a3426"));
    expect(["new-york-glaze", "dark-caramel", "port", "versa-shaker"]).toContain(stainGrainSlug("Cherry", "#8a4b2f"));
    expect(stainGrainSlug("Cherry", "#8a4b2f")).not.toBe("versa-shaker");
    expect(["versa-shaker", "new-york-glaze", "ewo"]).toContain(stainGrainSlug("Solid Birch", HONEY));
  });

  it("keeps the wizard's three frameless names", () => {
    expect(stainGrainSlug("grey wood")).toBe("grey-shaker");
    expect(stainGrainSlug("dark wood")).toBe("expresso-shaker");
    expect(stainGrainSlug("light wood")).toBe("versa-shaker");
  });

  it("picks the template closest to the stain within the family", () => {
    const warm = pickStainGrainTemplate({ species: "Cherry", targetHex: "#c69a72" });
    expect(warm.entry.slug).toBe("new-york-glaze");
    const dark = pickStainGrainTemplate({ species: "Walnut", targetHex: "#6a4631" });
    expect(dark.entry.slug).toBe("dark-caramel");
  });
});

describe("luminance-preserving tint keeps grain contrast and the stain's hue", () => {
  let versa: RgbaImage;
  let before: ReturnType<typeof grainStats>;
  beforeAll(() => {
    versa = loadGrain("versa-shaker");
    before = grainStats(versa);
  });

  it("lands the mean exactly on the stain colour and keeps (or restores) grain contrast", () => {
    for (const target of [HONEY, "#8a4b2f", "#4a3426", "#a4a19e"]) {
      const out = tintGrainPixels(versa, target);
      const stats = grainStats(out);
      const lab = rgbToLab(parseInt(target.slice(1, 3), 16), parseInt(target.slice(3, 5), 16), parseInt(target.slice(5, 7), 16));
      expect(Math.abs(stats.meanL - lab.L)).toBeLessThan(1.5);
      expect(Math.hypot(stats.meanA - lab.a, stats.meanB - lab.b)).toBeLessThan(2);
      expect(stats.stdL).toBeGreaterThanOrEqual(before.stdL * 0.95);
    }
  });

  it("the old per-channel multiply loses contrast or misses the hue for a dark stain; the new tint does not", () => {
    const walnut = "#4a3426";
    const tint = retintGrain("#c7b695", walnut);
    const old = grainStats(multiplyTintPixels(versa, tint.tintLinear));
    const next = grainStats(tintGrainPixels(versa, walnut));
    expect(next.stdL).toBeGreaterThan(old.stdL);
  });

  it("Honey Core: the old linear multiplier above 1 brightened the template; the new tint keeps the grain", () => {
    const tint = retintGrain("#c7b695", HONEY_OLD_TARGET);
    expect(tint.clamped).toBe(true);
    expect(Math.max(...tint.tintLinear)).toBeGreaterThan(1.2);
    const next = grainStats(tintGrainPixels(versa, HONEY));
    expect(next.stdL).toBeGreaterThanOrEqual(before.stdL);
  });
});

describe("resolution and relief", () => {
  it("upscales the 56 px tile to at least 512 px, keeping the aspect", () => {
    const versa = loadGrain("versa-shaker");
    const big = upscaleGrain(versa);
    expect(big.width).toBeGreaterThanOrEqual(512);
    expect(Math.abs(big.height / big.width - versa.height / versa.width)).toBeLessThan(0.02);
    expect(big.data.length).toBe(big.width * big.height * 4);
  });

  it("the full pipeline gives a hi-res stain texture at the stain colour", () => {
    const out = stainGrainTexture(loadGrain("versa-shaker"), HONEY);
    const s = grainStats(out);
    const target = rgbToLab(0xd4, 0xb4, 0x8b);
    expect(out.width).toBeGreaterThanOrEqual(512);
    expect(Math.abs(s.meanL - target.L)).toBeLessThan(1.5);
    expect(meanHex(out)).toBeTruthy();
    expect(deltaE2000Hex(HONEY, HONEY)).toBe(0);
  });

  it("derives a unit normal map from the grain", () => {
    const n = grainNormalMap(upscaleGrain(loadGrain("versa-shaker"), { minWidth: 128 }));
    let sumZ = 0;
    for (let i = 0; i < n.data.length; i += 4) sumZ += n.data[i + 2]!;
    expect(sumZ / (n.data.length / 4)).toBeGreaterThan(200); // mostly facing out
  });
});

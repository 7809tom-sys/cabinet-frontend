/**
 * Stained-door grain, done properly (Tom, Nov 20 2026: "the stained cabinet colours need
 * to be a lot better"; Honey Core rendered as a flat, pale, washed-out tan in 3D).
 *
 * Three things made stains poor, all fixed here without touching the frozen 3D file:
 *
 * 1. Template choice. The wizard mapped only "grey wood" / "dark wood" / "light wood";
 *    every other grain name, including the species PR 457 saves ("Birch", "Solid Birch"),
 *    fell back to the pale Versa template. `pickStainGrainTemplate` maps species and grain
 *    names to the wood templates already in the catalog, then takes the one closest to the
 *    stain colour, so the least retinting is needed.
 * 2. Tint maths. A per-channel multiply from a pale template toward a stain flattens grain
 *    contrast, shifts the hue and, for a door lighter than its template, needs a multiplier
 *    above 1 that blows the highlights out. `tintGrainPixels` tints in CIELAB instead: the
 *    door's own L*, a*, b* become the mean, and each pixel keeps its offset from the
 *    template mean, so grain contrast is kept and the hue is exactly the stain's.
 * 3. Resolution. The grain tiles are about 56 x 105 px. `upscaleGrain` resamples them
 *    bicubically to at least 512 px and adds a fine, deterministic grain-direction streak
 *    so the face is not a blur, and `grainNormalMap` derives a normal map from the result.
 *
 * Everything here is pure (works on RGBA arrays), so the browser module and the tests share it.
 */
import { DLC_FR26_CATALOG, type DlcFr26CatalogEntry } from "./dlcFr26Catalog.generated";
import { deltaE2000Hex, labFromHex, parseHex, type Lab } from "./ciede2000";

/** Catalog grains that are real wood (not a paint, glaze-white or solid). */
export const STAIN_WOOD_TEMPLATE_SLUGS = [
  "versa-shaker",
  "new-york-glaze",
  "ewo",
  "dark-caramel",
  "port",
  "driftwood",
  "chestnut",
  "expresso-shaker",
  "grey-shaker",
] as const;

export type StainSpeciesFamily = "oak" | "light" | "warm" | "dark" | "grey";

const FAMILY_TEMPLATES: Record<StainSpeciesFamily, readonly string[]> = {
  oak: ["ewo"],
  light: ["versa-shaker", "new-york-glaze", "ewo"],
  warm: ["new-york-glaze", "dark-caramel", "port", "versa-shaker"],
  dark: ["dark-caramel", "expresso-shaker", "chestnut"],
  grey: ["driftwood", "grey-shaker", "chestnut"],
};

const FAMILY_WORDS: Array<[RegExp, StainSpeciesFamily]> = [
  [/\b(?:white\s+oak|red\s+oak|oak|rift|quarter[\s-]?sawn|european\s+white\s+oak|ewo)\b/i, "oak"],
  [/\b(?:gr[ae]y\s+wood|gr[ae]y|driftwood|weathered|ash\s+gr[ae]y|smoke|slate)\b/i, "grey"],
  [/\b(?:dark\s+wood|walnut|espresso|expresso|mocha|java|chocolate|ebony|coffee|onyx)\b/i, "dark"],
  [/\b(?:cherry|honey|caramel|pecan|amber|chestnut|cognac|toffee|saddle|rust|brandy|nutmeg)\b/i, "warm"],
  [/\b(?:light\s+wood|birch|maple|alder|beech|poplar|natural|ash|pine|clear)\b/i, "light"],
];

/** The wood family a species or grain name belongs to, or null when the text says nothing. */
export function stainSpeciesFamily(text: string | null | undefined): StainSpeciesFamily | null {
  const value = (text ?? "").trim();
  if (!value) return null;
  for (const [pattern, family] of FAMILY_WORDS) if (pattern.test(value)) return family;
  return null;
}

function woodEntry(slug: string): DlcFr26CatalogEntry | undefined {
  return DLC_FR26_CATALOG.find((entry) => entry.slug === slug && entry.grainFrameFree);
}

export type StainTemplateChoice = {
  entry: DlcFr26CatalogEntry;
  family: StainSpeciesFamily | null;
  /** ΔE2000 between the template's own colour and the stain. */
  deltaE: number | null;
  reason: string;
};

/**
 * The best existing wood grain for a stain. The grain name (what the wizard saved) is read
 * first, then the species, then the finish / style name; the family limits the candidates,
 * and the closest colour among them wins. Unknown text considers every wood template.
 */
export function pickStainGrainTemplate(input: {
  grainName?: string | null;
  species?: string | null;
  finishName?: string | null;
  targetHex?: string | null;
}): StainTemplateChoice {
  const family = stainSpeciesFamily(input.grainName)
    ?? stainSpeciesFamily(input.species)
    ?? stainSpeciesFamily(input.finishName);
  const slugs = family ? FAMILY_TEMPLATES[family] : STAIN_WOOD_TEMPLATE_SLUGS;
  const pool = slugs.map(woodEntry).filter((entry): entry is DlcFr26CatalogEntry => Boolean(entry));
  const target = parseHex(input.targetHex ?? "") ? input.targetHex! : null;
  let best = pool[0] ?? woodEntry("versa-shaker") ?? DLC_FR26_CATALOG[0]!;
  let bestDelta: number | null = target ? deltaE2000Hex(best.solidColor, target) : null;
  if (target) {
    for (const entry of pool) {
      const delta = deltaE2000Hex(entry.solidColor, target);
      if (delta != null && (bestDelta == null || delta < bestDelta)) {
        best = entry;
        bestDelta = delta;
      }
    }
  }
  return {
    entry: best,
    family,
    deltaE: bestDelta,
    reason: `${family ?? "unknown species"} -> ${best.slug}${bestDelta != null ? ` (ΔE ${bestDelta.toFixed(1)} to ${target})` : ""}`,
  };
}

// ── Colour maths (sRGB <-> CIELAB, D65) ──────────────────────────────────────────

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number): number {
  const v = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

const WHITE = { x: 0.95047, y: 1, z: 1.08883 };
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const fInv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));

export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / WHITE.x;
  const y = (0.2126729 * R + 0.7151522 * G + 0.072175 * B) / WHITE.y;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / WHITE.z;
  const fx = f(x), fy = f(y), fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToRgb(lab: Lab): [number, number, number] {
  const fy = (lab.L + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;
  const x = fInv(fx) * WHITE.x, y = fInv(fy) * WHITE.y, z = fInv(fz) * WHITE.z;
  const R = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const G = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const B = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return [fromLinear(R), fromLinear(G), fromLinear(B)];
}

export type RgbaImage = { width: number; height: number; data: Uint8ClampedArray };

export type GrainStats = { meanL: number; meanA: number; meanB: number; stdL: number };

export function grainStats(image: RgbaImage): GrainStats {
  let n = 0, sL = 0, sA = 0, sB = 0, sLL = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    if ((image.data[i + 3] ?? 255) < 128) continue;
    const lab = rgbToLab(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!);
    n += 1; sL += lab.L; sA += lab.a; sB += lab.b; sLL += lab.L * lab.L;
  }
  if (n === 0) return { meanL: 0, meanA: 0, meanB: 0, stdL: 0 };
  const meanL = sL / n;
  return { meanL, meanA: sA / n, meanB: sB / n, stdL: Math.sqrt(Math.max(0, sLL / n - meanL * meanL)) };
}

export type StainTintOptions = {
  /**
   * Scale on each pixel's lightness offset from the template mean (default 1.35). Above 1 restores the
   * grain the small tiles lost; it is reduced automatically near black and white so the
   * grain never clips.
   */
  contrast?: number;
  /** Share of each pixel's own a*b* offset kept (figure colour variation). */
  chromaVariation?: number;
};

/**
 * Luminance-preserving stain tint. The output's mean colour is the stain (in CIELAB),
 * and every pixel keeps its lightness offset from the template mean (times `contrast`),
 * so the grain stays as contrasty as the template and the hue is the stain's own.
 */
export function tintGrainPixels(image: RgbaImage, targetHex: string, options: StainTintOptions = {}): RgbaImage {
  const target = labFromHex(targetHex);
  if (!target) return image;
  const stats = grainStats(image);
  const headroom = Math.min(target.L, 100 - target.L);
  // Keep ±2.5 standard deviations inside the available lightness range.
  const maxContrast = stats.stdL > 0 ? Math.max(0.5, headroom / (2.5 * stats.stdL)) : 1;
  const contrast = Math.min(options.contrast ?? 1.35, maxContrast);
  const chroma = options.chromaVariation ?? 0.6;
  const out = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < image.data.length; i += 4) {
    const lab = rgbToLab(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!);
    const [r, g, b] = labToRgb({
      L: Math.max(0, Math.min(100, target.L + (lab.L - stats.meanL) * contrast)),
      a: target.a + (lab.a - stats.meanA) * chroma,
      b: target.b + (lab.b - stats.meanB) * chroma,
    });
    out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = image.data[i + 3] ?? 255;
  }
  return { width: image.width, height: image.height, data: out };
}

/**
 * The old per-channel multiply (`retintGrain` + a material colour), reproduced for the
 * before/after evidence and the tests: albedo x tintLinear in linear light.
 */
export function multiplyTintPixels(image: RgbaImage, tintLinear: readonly [number, number, number]): RgbaImage {
  const out = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < image.data.length; i += 4) {
    for (let c = 0; c < 3; c += 1) out[i + c] = fromLinear(toLinear(image.data[i + c]!) * tintLinear[c]!);
    out[i + 3] = image.data[i + 3] ?? 255;
  }
  return { width: image.width, height: image.height, data: out };
}

// ── Resolution ───────────────────────────────────────────────────────────────────

function cubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  // Catmull-Rom
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

function mirror(index: number, size: number): number {
  if (size <= 1) return 0;
  const period = size * 2;
  let i = ((index % period) + period) % period;
  if (i >= size) i = period - 1 - i;
  return i;
}

/** Deterministic hash noise in [0, 1). */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise1D(t: number, seed: number, column: number): number {
  const i = Math.floor(t);
  const u = t - i;
  const s = u * u * (3 - 2 * u);
  return hash(column, i, seed) * (1 - s) + hash(column, i + 1, seed) * s;
}

export type UpscaleOptions = {
  /** Minimum output width in px (height keeps the aspect). */
  minWidth?: number;
  /** Lightness swing of the fine grain-direction streaks, in sRGB levels. */
  detail?: number;
  /** "vertical" streaks run along y (the default for door faces). */
  direction?: "vertical" | "horizontal";
  seed?: number;
};

/**
 * Bicubic (Catmull-Rom) upscale with mirrored edges, plus fine streaks along the grain so
 * the enlarged tile has detail at door scale. Mirrored edges keep the tile seamless under
 * the mirrored tiling the renderer already uses.
 */
export function upscaleGrain(image: RgbaImage, options: UpscaleOptions = {}): RgbaImage {
  const minWidth = options.minWidth ?? 512;
  const scale = Math.max(1, minWidth / Math.max(1, image.width));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const out = new Uint8ClampedArray(width * height * 4);
  const detail = options.detail ?? 6;
  const vertical = (options.direction ?? "vertical") === "vertical";
  const seed = options.seed ?? 7;
  const px = (x: number, y: number, c: number) => image.data[(mirror(y, image.height) * image.width + mirror(x, image.width)) * 4 + c]!;
  for (let y = 0; y < height; y += 1) {
    const sy = (y + 0.5) / scale - 0.5;
    const y0 = Math.floor(sy);
    const ty = sy - y0;
    for (let x = 0; x < width; x += 1) {
      const sx = (x + 0.5) / scale - 0.5;
      const x0 = Math.floor(sx);
      const tx = sx - x0;
      const across = vertical ? x : y;
      const along = vertical ? y : x;
      // A streak per pixel column across the grain, wandering slowly along it.
      const streak = (valueNoise1D(along / 48, seed, across) - 0.5) * 0.7 + (hash(across, 0, seed + 1) - 0.5) * 0.3;
      const offset = streak * detail * 2;
      for (let c = 0; c < 4; c += 1) {
        const rows = [-1, 0, 1, 2].map((dy) => cubic(px(x0 - 1, y0 + dy, c), px(x0, y0 + dy, c), px(x0 + 1, y0 + dy, c), px(x0 + 2, y0 + dy, c), tx));
        const value = cubic(rows[0]!, rows[1]!, rows[2]!, rows[3]!, ty);
        out[(y * width + x) * 4 + c] = c === 3 ? value : value + offset;
      }
    }
  }
  return { width, height, data: out };
}

/**
 * Tangent-space normal map from the grain's lightness (darker = lower), Sobel gradients.
 * Gives the grain relief under the room lights; `strength` scales the slopes.
 */
export function grainNormalMap(image: RgbaImage, strength = 2): RgbaImage {
  const { width, height, data } = image;
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) lum[i] = (0.2126 * data[i * 4]! + 0.7152 * data[i * 4 + 1]! + 0.0722 * data[i * 4 + 2]!) / 255;
  const at = (x: number, y: number) => lum[mirror(y, height) * width + mirror(x, width)]!;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -gx * strength, ny = -gy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * width + x) * 4;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  return { width, height, data: out };
}

/** The whole pipeline: upscale, then the luminance-preserving tint. */
export function stainGrainTexture(template: RgbaImage, targetHex: string, options: UpscaleOptions & StainTintOptions = {}): RgbaImage {
  return tintGrainPixels(upscaleGrain(template, options), targetHex, options);
}

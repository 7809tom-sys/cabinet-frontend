/**
 * Sherwin-Williams wood stain, from Sherwin-Williams' own published stain pages.
 *
 * Every code, name, and page URL in the data file is copied from the published
 * interior/exterior stain listings:
 *   https://www.sherwin-williams.com/homeowners/color/find-and-explore-colors/stain-colors/interior-stains/
 *   https://www.sherwin-williams.com/homeowners/color/find-and-explore-colors/stain-colors/exterior-stains/
 * Each of those pages serves a swatch image per stain. Sherwin-Williams publishes no
 * hex for a stain, so the hex stored here is that published swatch measured at the
 * median of its inner 50% box. Nothing is invented; re-run
 * scripts/build-sherwin-williams-colors.py to rebuild the file from the published source.
 *
 * A stain keeps the wood grain and tints it toward the stain color. The wizard's
 * stain wheel runs light maple to dark smoke over these published stains.
 */
import stainData from "../data/door-colors/sherwin-williams-stain.json";
import { deltaE2000Hex } from "./ciede2000";

export type SherwinWilliamsStain = {
  /** `MW230`, `DB2306`, `SW3501`. */
  code: string;
  name: string;
  /** Published stain page for this exact color. */
  page: string;
  /** Published swatch image this hex was measured from. */
  swatch: string;
  /** Measured swatch color. Not a published hex. */
  hex: string;
  usage: Array<"Interior" | "Exterior">;
};

export type SherwinWilliamsStainSource = {
  publisher: string;
  documents: string[];
  swatchHost: string;
  method: string;
  note: string;
  retrieved: string;
};

const DATA = stainData as unknown as { source: SherwinWilliamsStainSource; stains: SherwinWilliamsStain[] };

export const SHERWIN_WILLIAMS_STAIN_SOURCE: SherwinWilliamsStainSource = DATA.source;

export const SHERWIN_WILLIAMS_STAINS: readonly SherwinWilliamsStain[] = DATA.stains;

const byCode = new Map(SHERWIN_WILLIAMS_STAINS.map((stain) => [stain.code, stain]));

/** Stain codes have two or three letters and optional digits (`MW210B`). Spaces and dashes are ignored. */
export function normalizeStainCode(value: string | null | undefined): string | null {
  const compact = (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "");
  return /^[A-Z]{2,3}\d{3,4}[A-Z]*$/.test(compact) ? compact : null;
}

export function stainByCode(value: string | null | undefined): SherwinWilliamsStain | null {
  const code = normalizeStainCode(value);
  return code ? byCode.get(code) ?? null : null;
}

export function stainByName(name: string | null | undefined): SherwinWilliamsStain | null {
  const wanted = (name ?? "").trim().toLowerCase();
  if (!wanted) return null;
  return SHERWIN_WILLIAMS_STAINS.find((stain) => stain.name.toLowerCase() === wanted) ?? null;
}

export function stainLabel(stain: SherwinWilliamsStain): string {
  return `${stain.code} ${stain.name}`;
}

/** Perceptual lightness (CIE L*) of the measured stain swatch, 0 dark to 100 light. */
export function stainLightness(stain: SherwinWilliamsStain): number {
  const match = /^#([0-9a-f]{6})$/i.exec(stain.hex);
  if (!match) return 0;
  const raw = match[1]!;
  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(raw.slice(index, index + 2), 16) / 255) as [number, number, number];
  const linear = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  const y = luminance > 216 / 24389 ? luminance ** (1 / 3) : (24389 / 27 * luminance + 16) / 116;
  return Math.max(0, Math.min(100, 116 * y - 16));
}

/**
 * Light maple to dark smoke. Sherwin-Williams publishes no "light maple" or "dark smoke"
 * stain, so those two words describe the ends of the slide, never a color name in the data.
 * Every stop on the wheel is a real published stain.
 */
export const STAIN_WHEEL_ENDS = { light: "light maple", dark: "dark smoke" } as const;

export const SHERWIN_WILLIAMS_STAIN_WHEEL: readonly SherwinWilliamsStain[] = SHERWIN_WILLIAMS_STAINS
  .map((stain, index) => ({ stain, index, lightness: stainLightness(stain) }))
  .sort((left, right) => right.lightness - left.lightness || left.index - right.index)
  .map((entry) => entry.stain);

export function stainAtPosition(position: number): SherwinWilliamsStain {
  const wheel = SHERWIN_WILLIAMS_STAIN_WHEEL;
  const clamped = Number.isFinite(position) ? Math.max(0, Math.min(1, position)) : 0;
  return wheel[Math.round(clamped * (wheel.length - 1))]!;
}

export function stainPositionOf(stain: SherwinWilliamsStain): number {
  const index = SHERWIN_WILLIAMS_STAIN_WHEEL.findIndex((entry) => entry.code === stain.code);
  return index < 0 ? 0 : index / Math.max(1, SHERWIN_WILLIAMS_STAIN_WHEEL.length - 1);
}

/** CSS gradient from the lightest published stain to the darkest, in wheel order. */
export function stainWheelGradient(stops = 24): string {
  const wheel = SHERWIN_WILLIAMS_STAIN_WHEEL;
  const parts: string[] = [];
  for (let index = 0; index < stops; index += 1) {
    const stain = wheel[Math.round((index / (stops - 1)) * (wheel.length - 1))]!;
    parts.push(`${stain.hex} ${Math.round((index / (stops - 1)) * 100)}%`);
  }
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

/** Closest published stain to a hex, with its CIEDE2000 distance. */
export function nearestStain(hex: string): { stain: SherwinWilliamsStain; deltaE: number } | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex.trim())) return null;
  let best: SherwinWilliamsStain | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const stain of SHERWIN_WILLIAMS_STAINS) {
    const delta = deltaE2000Hex(hex, stain.hex);
    if (delta != null && delta < bestDelta) {
      best = stain;
      bestDelta = delta;
    }
  }
  return best ? { stain: best, deltaE: Math.round(bestDelta * 10) / 10 } : null;
}

/** A stain is a tint over the grain, never a flat fill. The wizard sends this with the hex. */
export const STAIN_FINISH = "stain" as const;
export const PAINT_FINISH = "paint" as const;

export type WizardFinish = typeof STAIN_FINISH | typeof PAINT_FINISH;

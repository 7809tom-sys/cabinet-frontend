/**
 * Sherwin-Williams paint, from Sherwin-Williams' own published color chart.
 *
 * Every code, name, locator, and hex in the data file is copied from
 * https://images.sherwin-williams.com/content_images/sw-pdf-sherwin-williams-colorc.pdf
 * (the chart's own "COLOR # / COLOR NAME / LOCATOR # / RED GREEN BLUE / HEX COLOR" rows).
 * Nothing here is typed by hand and no hex is estimated; re-run
 * scripts/build-sherwin-williams-colors.py to rebuild the file from the published source.
 *
 * Paint is an opaque solid. The wizard uses this for the paint wheel and for the
 * "type an SW chip code" box.
 */
import paintData from "../data/door-colors/sherwin-williams-paint.json";

export type SherwinWilliamsPaintColor = {
  /** `SW7005`. The space in "SW 7005" is a display convention, not part of the code. */
  code: string;
  name: string;
  locator: string | null;
  /** Published HEX COLOR column, lowercased. */
  hex: string;
  rgb: [number, number, number];
};

export type SherwinWilliamsPaintSource = {
  publisher: string;
  document: string;
  url: string;
  columns: string;
  note: string;
  retrieved: string;
};

const DATA = paintData as unknown as { source: SherwinWilliamsPaintSource; colors: SherwinWilliamsPaintColor[] };

export const SHERWIN_WILLIAMS_PAINT_SOURCE: SherwinWilliamsPaintSource = DATA.source;

export const SHERWIN_WILLIAMS_PAINT_COLORS: readonly SherwinWilliamsPaintColor[] = DATA.colors.map((color) => ({
  ...color,
  rgb: [color.rgb[0], color.rgb[1], color.rgb[2]] as [number, number, number],
}));

const byCode = new Map(SHERWIN_WILLIAMS_PAINT_COLORS.map((color) => [color.code, color]));

/** "SW 7005", "sw7005", "7005" and "SW-7005" all read as SW7005. Anything else is null. */
export function normalizePaintCode(value: string | null | undefined): string | null {
  const compact = (value ?? "").trim().toUpperCase().replace(/[\s.#-]+/g, "");
  if (!compact) return null;
  const match = /^(?:SW)?(\d{4})$/.exec(compact);
  return match ? `SW${match[1]}` : null;
}

/** The published chip for a typed code, or null. Never invents a color for an unknown code. */
export function paintColorByCode(value: string | null | undefined): SherwinWilliamsPaintColor | null {
  const code = normalizePaintCode(value);
  return code ? byCode.get(code) ?? null : null;
}

export function paintColorByName(name: string | null | undefined): SherwinWilliamsPaintColor | null {
  const wanted = (name ?? "").trim().toLowerCase();
  if (!wanted) return null;
  return SHERWIN_WILLIAMS_PAINT_COLORS.find((color) => color.name.toLowerCase() === wanted) ?? null;
}

/** Display form used beside a swatch: `SW 7005 Pure White`. */
export function paintLabel(color: SherwinWilliamsPaintColor): string {
  return `SW ${color.code.slice(2)} ${color.name}`;
}

export function hexToRgbChannels(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const raw = match[1]!;
  return [0, 2, 4].map((index) => Number.parseInt(raw.slice(index, index + 2), 16)) as [number, number, number];
}

function rgbToHex(channels: readonly number[]): string {
  return `#${channels.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The paint wheel is one continuous slide through the published chart, grouped the way the
 * chart itself is printed: neutrals, then each hue family, lightest chip first inside each
 * family. A slide therefore walks neutral greys and creams into warm hues, greens, blues and
 * back out through purples, instead of jumping between unrelated colors.
 */
function relativeLuminance(rgb: readonly [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Perceptual lightness (CIE L*), 0 for black and 100 for white. */
export function paintLightness(color: SherwinWilliamsPaintColor): number {
  const luminance = relativeLuminance(color.rgb);
  const y = luminance > 216 / 24389 ? luminance ** (1 / 3) : (24389 / 27 * luminance + 16) / 116;
  return Math.max(0, Math.min(100, 116 * y - 16));
}

export type PaintHueFamily = "neutral" | "red" | "orange" | "yellow" | "green" | "blue" | "purple";

/** Coarse hue family. Low chroma is neutral, so a gray stays neutral. */
export function paintHueFamily(color: SherwinWilliamsPaintColor): PaintHueFamily {
  const [r, g, b] = color.rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma < 18) return "neutral";
  let hue: number;
  if (max === r) hue = ((g - b) / chroma) % 6;
  else if (max === g) hue = (b - r) / chroma + 2;
  else hue = (r - g) / chroma + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  if (hue < 15 || hue >= 345) return "red";
  if (hue < 45) return "orange";
  if (hue < 70) return "yellow";
  if (hue < 170) return "green";
  if (hue < 255) return "blue";
  return "purple";
}

/** Neutrals first, then the hue families in wheel order. */
const HUE_ORDER: readonly PaintHueFamily[] = ["neutral", "yellow", "orange", "red", "purple", "blue", "green"];

export const SHERWIN_WILLIAMS_PAINT_WHEEL: readonly SherwinWilliamsPaintColor[] = SHERWIN_WILLIAMS_PAINT_COLORS
  .map((color, index) => ({ color, index, lightweight: paintLightness(color), family: paintHueFamily(color) }))
  .sort((left, right) => {
    const family = HUE_ORDER.indexOf(left.family) - HUE_ORDER.indexOf(right.family);
    if (family !== 0) return family;
    // Lightest first inside a family, so one continuous slide runs light to dark.
    return right.lightweight - left.lightweight || left.index - right.index;
  })
  .map((entry) => entry.color);

/**
 * Color at a 0..1 position on the paint wheel. 0 is the lightest published chip and
 * 1 is the darkest, so the slider is continuous rather than a list of stops.
 */
export function paintAtPosition(position: number): SherwinWilliamsPaintColor {
  const wheel = SHERWIN_WILLIAMS_PAINT_WHEEL;
  const clamped = Number.isFinite(position) ? Math.max(0, Math.min(1, position)) : 0;
  const index = Math.round(clamped * (wheel.length - 1));
  return wheel[index]!;
}

/** Where a published chip sits on the wheel, 0..1. */
export function paintPositionOf(color: SherwinWilliamsPaintColor): number {
  const index = SHERWIN_WILLIAMS_PAINT_WHEEL.findIndex((entry) => entry.code === color.code);
  return index < 0 ? 0 : index / Math.max(1, SHERWIN_WILLIAMS_PAINT_WHEEL.length - 1);
}

/** CSS gradient for the wheel track: every published chip, lightest first. */
export function paintWheelGradient(stops = 24): string {
  const wheel = SHERWIN_WILLIAMS_PAINT_WHEEL;
  const parts: string[] = [];
  for (let index = 0; index < stops; index += 1) {
    const color = wheel[Math.round((index / (stops - 1)) * (wheel.length - 1))]!;
    parts.push(`${color.hex} ${Math.round((index / (stops - 1)) * 100)}%`);
  }
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

/** Closest published chip to an arbitrary hex. Used only to show where a picked hex sits. */
export function nearestPaintColor(hex: string): SherwinWilliamsPaintColor | null {  const channels = hexToRgbChannels(hex);
  if (!channels) return null;
  let best = SHERWIN_WILLIAMS_PAINT_COLORS[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const color of SHERWIN_WILLIAMS_PAINT_COLORS) {
    const distance = Math.hypot(color.rgb[0] - channels[0], color.rgb[1] - channels[1], color.rgb[2] - channels[2]);
    if (distance < bestDistance) {
      best = color;
      bestDistance = distance;
    }
  }
  return best;
}

/** A hex for one RGB triple. */
export function paintHexFromChannels(channels: readonly [number, number, number] | readonly number[]): string {
  return rgbToHex(channels);
}

/** A typed hex is passed through unchanged; anything else returns null. */
export function exactPaintHex(value: string | null | undefined): string | null {
  const match = /^#([0-9a-f]{6})$/i.exec((value ?? "").trim());
  return match ? `#${match[1]!.toLowerCase()}` : null;
}

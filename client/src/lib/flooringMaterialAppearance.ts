/**
 * Floor and mosaic colors for the 3D Designer.
 *
 * A missing swatch used to paint a hash of the product name. That hue, under
 * the cool fill light, read as green, black, blue, or purple — the same
 * placeholder look flooring had when it was first added. A missing texture now
 * stays a neutral material color taken from the product picture when one
 * exists. Debug primaries are never used as that color.
 *
 * Mosaic sheets are about 12 inches with 1–2 inch chips. A close-up "candidate"
 * photo is not that sheet; stretching it across 12 inches makes the chips huge.
 */

export const THREE_D_NEUTRAL_FLOOR_COLOR = "#c4b39a";

/**
 * Photographed span of a candidate close-up (a few chips), not the catalog
 * sheet. Repeating that photo every sheet width stretches 1–2 inch chips.
 */
export const THREE_D_MOSAIC_MACRO_FIELD_IN = 4;

const DEBUG_FLOOR_COLORS = new Set([
  "#000000",
  "#00ff00",
  "#0000ff",
  "#ff00ff",
  "#800080",
  "#ff0000",
  "#0f0",
  "#00f",
  "#f0f",
]);

export function threeDCuratedIdentityMatches(
  productName: string | null | undefined,
  productId: number | null | undefined,
  expectedName: string,
  expectedId: number,
): boolean {
  const normalized = (productName ?? "").trim().toLowerCase();
  if (normalized === expectedName) return true;
  // The catalog id may select a curated map only when no other product name
  // was supplied. A different name with a reused id must not inherit it.
  return normalized.length === 0 && productId === expectedId;
}

export function threeDTextureUrlIsColorMap(url: string | null | undefined): boolean {
  const value = (url ?? "").trim().toLowerCase();
  if (!value) return false;
  return !/(_normal\b|normalmap|normal_map|_roughness\b|roughnessmap|_rough\b|_nrm\b|_ao\b|occlusionmap|_metallic\b)/.test(value);
}

export function threeDMosaicMapIsMacroCandidate(url: string | null | undefined): boolean {
  return /candidate_\d+/i.test(url ?? "");
}

export type ThreeDMosaicSheetMap = {
  url: string;
  widthIn: number;
  heightIn: number;
  /** Crop the white retail margin so chips fill the sheet instead of sitting in it. */
  cropRetailBackground: boolean;
  macroCandidate: boolean;
};

/**
 * The uploaded Designer photo (`materialImageUrl`) is the mosaic texture.
 * The catalog card (`imageUrl`) is not: Carbon Hex's card is a room photo, and
 * guessing "candidate_" in the built-in filename used to swap that card in.
 * An original URL is the designer photo only when it is not the catalog card.
 */
export function preferredDesignerMosaicUrl(
  originalUrl: string | null | undefined,
  cardImageUrl: string | null | undefined,
  materialImageUrl?: string | null,
): string {
  const material = materialImageUrl?.trim() || "";
  if (material && threeDTextureUrlIsColorMap(material)) return material;
  const original = originalUrl?.trim() || "";
  const card = cardImageUrl?.trim() || "";
  if (original && original !== card && threeDTextureUrlIsColorMap(original)) return original;
  return "";
}

/**
 * A candidate close-up repeats across the few inches it actually shows.
 * A Designer upload repeats at the printed sheet size. The catalog card is
 * never substituted in here.
 */
export function threeDMosaicSheetMap(
  curatedUrl: string,
  sheetWidthIn: number,
  sheetHeightIn: number,
  designerMaterialUrl?: string | null,
): ThreeDMosaicSheetMap {
  const sheetWidth = sheetWidthIn > 0 ? sheetWidthIn : 12;
  const sheetHeight = sheetHeightIn > 0 ? sheetHeightIn : sheetWidth;
  const designer = designerMaterialUrl?.trim() || "";
  if (designer && threeDTextureUrlIsColorMap(designer)) {
    return {
      url: designer,
      widthIn: sheetWidth,
      heightIn: sheetHeight,
      cropRetailBackground: false,
      macroCandidate: false,
    };
  }
  if (threeDMosaicMapIsMacroCandidate(curatedUrl)) {
    const widthIn = THREE_D_MOSAIC_MACRO_FIELD_IN;
    return {
      url: curatedUrl,
      widthIn,
      heightIn: Math.max(1, widthIn * (sheetHeight / sheetWidth)),
      cropRetailBackground: false,
      macroCandidate: true,
    };
  }
  return {
    url: curatedUrl,
    widthIn: sheetWidth,
    heightIn: sheetHeight,
    cropRetailBackground: false,
    macroCandidate: false,
  };
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((channel) => clampByte(channel).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const raw = match[1];
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

function rgbToHsl(red: number, green: number, blue: number): { h: number; s: number; l: number } {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
  let channel = t;
  if (channel < 0) channel += 1;
  if (channel > 1) channel -= 1;
  if (channel < 1 / 6) return p + (q - p) * 6 * channel;
  if (channel < 1 / 2) return q;
  if (channel < 2 / 3) return p + (q - p) * (2 / 3 - channel) * 6;
  return p;
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360 / 360;
  if (s <= 0) {
    const gray = l * 255;
    return rgbToHex(gray, gray, gray);
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return rgbToHex(
    hueToRgb(p, q, hue + 1 / 3) * 255,
    hueToRgb(p, q, hue) * 255,
    hueToRgb(p, q, hue - 1 / 3) * 255,
  );
}

function normalizeHex(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return `#${trimmed.slice(1).split("").map((part) => `${part}${part}`).join("")}`;
  }
  return null;
}

/**
 * A believable floor color from a sampled product picture.
 * Neon debug primaries and empty samples stay the warm neutral.
 * The product hue is kept; saturation and lightness stay in a material range.
 */
export function threeDFlooringFallbackColor(sampledHex?: string | null): string {
  const hex = normalizeHex(sampledHex);
  if (!hex || DEBUG_FLOOR_COLORS.has(hex)) return THREE_D_NEUTRAL_FLOOR_COLOR;
  const rgb = hexToRgb(hex);
  if (!rgb) return THREE_D_NEUTRAL_FLOOR_COLOR;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  if (l < 0.06 || l > 0.96) return THREE_D_NEUTRAL_FLOOR_COLOR;
  if (s > 0.82) return THREE_D_NEUTRAL_FLOOR_COLOR;
  return hslToHex(h, Math.min(s, 0.42), Math.min(0.74, Math.max(0.34, l)));
}

/** Average the non-white center of a product picture. White retail margins are ignored. */
export function threeDAverageMaterialHex(data: Uint8ClampedArray, width: number, height: number): string | null {
  if (width < 2 || height < 2 || data.length < width * height * 4) return null;
  const x0 = Math.floor(width * 0.22);
  const y0 = Math.floor(height * 0.22);
  const x1 = Math.ceil(width * 0.78);
  const y1 = Math.ceil(height * 0.78);
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < 16) continue;
      if (data[index] >= 248 && data[index + 1] >= 248 && data[index + 2] >= 248) continue;
      red += data[index];
      green += data[index + 1];
      blue += data[index + 2];
      count += 1;
    }
  }
  if (count < 8) return null;
  return threeDFlooringFallbackColor(rgbToHex(red / count, green / count, blue / count));
}

export type ThreeDRetailContentBounds = { x: number; y: number; width: number; height: number };

/**
 * Bounding box of a product shot after the white retail field is removed.
 * A picture that already fills the frame returns null so a full sheet is not cropped.
 */
export function threeDRetailContentBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ThreeDRetailContentBounds | null {
  if (width < 2 || height < 2 || data.length < width * height * 4) return null;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let content = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < 16) continue;
      if (data[index] >= 248 && data[index + 1] >= 248 && data[index + 2] >= 248) continue;
      content += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (content < width * height * 0.02 || maxX < minX) return null;
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  if (cropWidth > width * 0.92 && cropHeight > height * 0.92) return null;
  return { x: minX, y: minY, width: cropWidth, height: cropHeight };
}

/**
 * Exposed cabinet sides, end panels, fridge-side panels, and toe kicks.
 *
 * Door fronts show the uploaded door photo. These surfaces were painted with
 * the catalog hex (or the unfinished pale placeholder #c6b9a7) instead, so
 * every finish's sides diverged from its doors. The door photo's panel is the
 * door color. Skins stay hickory-frameless only, and US Cabinet Depot
 * frameless lines that already project the door photo keep that path.
 */

/** Body color used before a finish is applied. It is not a door color. */
export const CABINET_SIDE_PLACEHOLDER = "#c6b9a7";

export type ExposedSideInput = {
  /** Catalog or render hex currently passed into the 3D cabinet. */
  catalogHex: string;
  /** Median color of the uploaded door photo's center panel, when one is loaded. */
  doorPanelHex?: string | null;
  /** AltaEuro / USCD frameless with no hex: the side IS the door photo. */
  useDoorPhotoOnSides?: boolean;
  /** DLC finish solid, already taken from the door crop. */
  dlcSolidHex?: string | null;
};

function hex(value: string | null | undefined): string | null {
  const match = /^#([0-9a-f]{6})$/i.exec((value ?? "").trim());
  return match ? `#${match[1]!.toLowerCase()}` : null;
}

/**
 * Solid color for an exposed side. Null means the caller keeps the door photo
 * on that surface (USCD frameless photo sides) rather than a flat hex.
 */
export function exposedSideSolidHex(input: ExposedSideInput): string | null {
  if (input.useDoorPhotoOnSides) return null;
  const dlc = hex(input.dlcSolidHex);
  if (dlc) return dlc;
  const panel = hex(input.doorPanelHex);
  if (panel) return panel;
  return hex(input.catalogHex) ?? input.catalogHex;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function channel(value: number): string {
  return Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, "0");
}

/**
 * Median color of the center of a door photo. The center is the panel, so a
 * light margin or the shaker frame does not become the side color.
 */
export function doorPanelMedianHex(
  width: number,
  height: number,
  rgba: Uint8ClampedArray | Uint8Array,
): string | null {
  const w = Math.floor(width);
  const h = Math.floor(height);
  if (w < 4 || h < 4 || rgba.length < w * h * 4) return null;
  const x0 = Math.floor(w * 0.32);
  const y0 = Math.floor(h * 0.32);
  const x1 = Math.max(x0 + 1, Math.ceil(w * 0.68));
  const y1 = Math.max(y0 + 1, Math.ceil(h * 0.68));
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * w + x) * 4;
      const alpha = rgba[index + 3] ?? 255;
      if (alpha < 16) continue;
      red.push(rgba[index] ?? 0);
      green.push(rgba[index + 1] ?? 0);
      blue.push(rgba[index + 2] ?? 0);
    }
  }
  if (red.length === 0) return null;
  return `#${channel(median(red))}${channel(median(green))}${channel(median(blue))}`;
}

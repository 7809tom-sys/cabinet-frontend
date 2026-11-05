/**
 * Where a named color sits on the Sherwin-Williams paint or stain wheel.
 *
 * Root cause of the marker bug: the wheel position came only from a published
 * SW chip code. A brand color (a WalzCraft or vendor name, or a paint name with
 * no chip code) has no code, so the lookup missed and the marker fell to the end
 * of the wheel — the marker jumped to an extreme instead of sitting near its own
 * color. Hex picks positioned correctly because they resolved to a chip.
 *
 * This module only answers "where would this color sit on the track". It never
 * changes the selected color, its hex, or its label, and it never snaps the
 * choice onto the brand palette: the return value is a 0..1 marker position.
 */

/** Keywords that put a color in a part of the wheel, with the band each one occupies. */
const HUE_KEYWORDS: ReadonlyArray<readonly [RegExp, ColorNameFamily]> = [
  // Neutral and near-neutral first: "warm white", "greige", "taupe" beat a bare hue word.
  [/\b(?:white|alabaster|ivory|cream|linen|pearl|chalk|snow)\b/i, "white"],
  [/\b(?:black|ebony|onyx|charcoal|graphite|obsidian|ink|midnight)\b/i, "black"],
  [/\b(?:gr[ae]y|greige|taupe|slate|stone|pewter|dovetail|dove|fog|grizzle|repose|mindful|dorian)\b/i, "gray"],
  [/\b(?:beige|sand|tan|almond|bisque|khaki|wheat|biscuit|parchment|oatmeal|burlap)\b/i, "beige"],
  [/\b(?:brown|espresso|mocha|walnut|coffee|mushroom|truffle|bark|umber)\b/i, "brown"],
  [/\b(?:navy|naval|indigo|ocean|abyss|cobalt|sapphire|marine|blue|denim|teal|peacock|aqua|sky)\b/i, "blue"],
  // "rust" beats "forest": Forest Rust is a rust stain, not a green. Same rule the
  // 3D cabinet name table already uses.
  [/\b(?:rust|red|brick|crimson|burgundy|wine|claret|terra|coral)\b/i, "red"],
  [/\b(?:sage|green|forest|olive|moss|fern|juniper|cactus|pine|emerald|basil)\b/i, "green"],
  [/\b(?:orange|amber|copper|cognac|apricot|melon)\b/i, "orange"],
  [/\b(?:yellow|gold|honey|mustard|butter|lemon|wheat)\b/i, "yellow"],
  [/\b(?:purple|plum|violet|lavender|aubergine|eggplant|lilac)\b/i, "purple"],
];

export type ColorNameFamily =
  | "white" | "beige" | "gray" | "brown" | "black"
  | "red" | "orange" | "yellow" | "green" | "blue" | "purple";

/**
 * Where each family sits on the wheel, for both finishes.
 *
 * The paint wheel runs neutrals light→dark, then yellow, orange, red, purple,
 * blue, green. The stain wheel is ordered by lightness only, so hue families do
 * not own a band there; a stain name is placed by lightness instead.
 */
const PAINT_FAMILY_BAND: Record<ColorNameFamily, number> = {
  white: 0.02,
  beige: 0.10,
  gray: 0.20,
  brown: 0.34,
  black: 0.46,
  yellow: 0.58,
  orange: 0.66,
  red: 0.74,
  purple: 0.80,
  blue: 0.87,
  green: 0.94,
};

/** Light-to-dark guess for a stain name, which is the only axis its wheel uses. */
const STAIN_FAMILY_BAND: Record<ColorNameFamily, number> = {
  white: 0.02,
  beige: 0.10,
  yellow: 0.22,
  orange: 0.34,
  gray: 0.44,
  brown: 0.52,
  red: 0.60,
  purple: 0.68,
  green: 0.74,
  blue: 0.84,
  black: 0.96,
};

/** Never park a marker against an end cap; those belong to real white and black. */
const SAFE_MIN = 0.03;
const SAFE_MAX = 0.97;

export function colorNameFamily(name: string | null | undefined): ColorNameFamily | null {
  const text = (name ?? "").trim();
  if (!text) return null;
  for (const [pattern, family] of HUE_KEYWORDS) {
    if (pattern.test(text)) return family;
  }
  return null;
}

/**
 * A sensible marker position from a color NAME alone, 0..1.
 *
 * Used only when the color has neither a published chip code nor a usable hex.
 * Two words that disagree ("blue gray") follow the list order, so the more
 * specific neutral wins over a bare hue word.
 */
export function colorNamePosition(name: string | null | undefined, finish: "paint" | "stain" = "paint"): number | null {
  const family = colorNameFamily(name);
  if (!family) return null;
  const band = finish === "stain" ? STAIN_FAMILY_BAND : PAINT_FAMILY_BAND;
  return clampMarker(band[family]);
}

/** Clamp a marker so it can never sit exactly on an end cap. */
export function clampMarker(position: number): number {
  if (!Number.isFinite(position)) return 0.5;
  return Math.max(SAFE_MIN, Math.min(SAFE_MAX, position));
}

/**
 * Marker position for a hex that is not itself a published chip: the position of
 * the nearest published chip on that finish's wheel. White and black hexes are
 * allowed to reach the ends because that is genuinely where they belong.
 */
export function positionForHex(
  hex: string | null | undefined,
  nearest: (hex: string) => number | null,
): number | null {
  const value = (hex ?? "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(value)) return null;
  const position = nearest(value);
  if (position == null || !Number.isFinite(position)) return null;
  return Math.max(0, Math.min(1, position));
}

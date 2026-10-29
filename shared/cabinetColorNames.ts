/**
 * Name → hex for the 3D cabinet fallback (`sceneCabinetColor`).
 * Two-word phrases are tested before single words, and every word is a
 * whole word so "ash" does not match inside another word and "paint" does
 * not match "painted".
 */

export const CABINET_NAME_COLORS = {
  gray: "#8d8f92",
  lightGray: "#d5d4d0",
  cherry: "#7a3b32",
  hickory: "#b08968",
  white: "#f7f6f3",
  smoke: "#6f6d6a",
  aeroSage: "#4f5549",
  black: "#34363a",
  navy: "#435b77",
  green: "#78826b",
  walnut: "#75523e",
  natural: "#d1ba8f",
  cream: "#ded5c1",
  default: "#f2f0ea",
} as const;

const PHRASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:aero[\s-]+sage|aston[\s-]+green)\b/i, CABINET_NAME_COLORS.aeroSage],
  [/\bblue[\s-]+gr[ae]y\b/i, CABINET_NAME_COLORS.gray],
  [/\blight[\s-]+gr[ae]y\b/i, CABINET_NAME_COLORS.lightGray],
  [/\bnatural[\s-]+walnut\b/i, CABINET_NAME_COLORS.walnut],
  [/\bwhite[\s-]+oak\b/i, CABINET_NAME_COLORS.natural],
];

const WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:cherry|mahogany|cognac)\b/i, CABINET_NAME_COLORS.cherry],
  [/\b(?:hickory|rustic|chestnut)\b/i, CABINET_NAME_COLORS.hickory],
  [/\b(?:smoke|ash)\b/i, CABINET_NAME_COLORS.smoke],
  [/\b(?:black|charcoal|obsidian|graphite)\b/i, CABINET_NAME_COLORS.black],
  [/\b(?:navy|blue|ocean)\b/i, CABINET_NAME_COLORS.navy],
  [/\b(?:green|sage|forest)\b/i, CABINET_NAME_COLORS.green],
  [/\b(?:walnut|espresso|brown|mocha)\b/i, CABINET_NAME_COLORS.walnut],
  [/\b(?:oak|maple|honey|natural)\b/i, CABINET_NAME_COLORS.natural],
  [/\b(?:cream|beige|linen|almond)\b/i, CABINET_NAME_COLORS.cream],
  [/\b(?:gr[ae]y|greige|slate|stone|pebble)\b/i, CABINET_NAME_COLORS.gray],
  [/\b(?:white|paint)\b/i, CABINET_NAME_COLORS.white],
];

/** The first matching phrase, then the first matching whole word. Null when nothing matches. */
export function matchCabinetColorName(source: string | null | undefined): string | null {
  const text = (source ?? "").trim();
  if (!text) return null;
  for (const [pattern, hex] of PHRASES) {
    if (pattern.test(text)) return hex;
  }
  for (const [pattern, hex] of WORDS) {
    if (pattern.test(text)) return hex;
  }
  return null;
}

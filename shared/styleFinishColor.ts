/**
 * Shopper-facing finish color for a selected door style.
 *
 * The color column and the name the shopper picked win over a finish label
 * that names a different hue. Stone Gray (Preston) is stored with color "Gray"
 * and alias "Stone Gray", but its finish label is currently "Cobalt Abyss".
 * Scanning that label first paints the swatch, the designer, and finish-matched
 * accessories navy instead of gray.
 */

export const STONE_GRAY_HEX = "#a8a59c";

export type StyleFinishInput = {
  aliasName?: string | null;
  ourName?: string | null;
  name?: string | null;
  color?: string | null;
  finish?: string | null;
  woodSpecies?: string | null;
  renderHex?: string | null;
};

function hueFamily(value: string): string | null {
  const text = value.toLowerCase();
  if (/stone\s*gr[ae]y/.test(text)) return "stone-gray";
  if (/\b(?:cobalt|abyss|navy|blue|ocean)\b/.test(text)) return "blue";
  if (/\bgr[ae]y\b/.test(text)) return "gray";
  if (/\b(?:white|cream|ivory)\b/.test(text)) return "white";
  if (/\b(?:black|charcoal|obsidian)\b/.test(text)) return "black";
  if (/\b(?:green|sage)\b/.test(text)) return "green";
  if (/\b(?:walnut|oak|cherry|hickory|maple)\b/.test(text)) return "wood";
  return null;
}

/** Text the finish matcher should read. A conflicting finish label is left out. */
export function styleFinishSearchText(style: StyleFinishInput | null | undefined): string {
  if (!style) return "";
  const identity = [style.aliasName, style.ourName, style.name, style.color].filter(Boolean).join(" ");
  const finish = (style.finish ?? "").trim();
  const identityHue = hueFamily(identity);
  const finishHue = hueFamily(finish);
  const finishAgrees = !finish || !identityHue || !finishHue || identityHue === finishHue
    || (identityHue === "stone-gray" && finishHue === "gray")
    || (identityHue === "gray" && finishHue === "stone-gray");
  return [identity, finishAgrees ? finish : "", style.woodSpecies].filter(Boolean).join(" ");
}

export function explicitStyleHex(style: StyleFinishInput | null | undefined): string | null {
  for (const value of [style?.renderHex, style?.color]) {
    const trimmed = value?.trim() ?? "";
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  }
  return null;
}

/** True for spray paint and touch-up kits, which must show the selected door color. */
export function isFinishMatchedAccessory(item: { masterCode?: string | null; description?: string | null; subCategory?: string | null }): boolean {
  return /spray\s*paint|touch-?\s*up|\btuk\b/i.test(`${item.masterCode ?? ""} ${item.description ?? ""} ${item.subCategory ?? ""}`);
}

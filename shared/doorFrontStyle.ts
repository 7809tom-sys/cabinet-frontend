/**
 * Door-front labels from door_styles (doorStyle, doorPanelType, and the
 * profile text those columns carry).
 *
 * "five-piece slab", "5-piece slab", "5 piece", and "five-piece" name a
 * five-piece door: two rails, two stiles, and one flat center slab. They are
 * not a one-piece slab and not a shaker. A shaker note that merely says
 * "five-piece mortise-and-tenon" does not match.
 */

function normalizedLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
}

/** "five-piece slab" / "5-piece slab" anywhere in the field. */
const FIVE_PIECE_SLAB_PHRASE = /(?:five|5)[\s-]*piece[\s-]*slab\b/;

/**
 * The whole field is the short label: "5 piece", "five-piece", "5-piece flat",
 * "five-piece flat panel". Extra words (a shaker construction sentence) do not match.
 */
const SHORT_FIVE_PIECE = /^(?:(?:five|5)[\s-]*piece(?:[\s-]*flat(?:[\s-]*panel)?)?)$/;

export function isFivePieceSlabLabel(value: unknown): boolean {
  const raw = normalizedLabel(value);
  if (!raw) return false;
  if (FIVE_PIECE_SLAB_PHRASE.test(raw)) return true;
  return SHORT_FIVE_PIECE.test(raw);
}

const HICKORY_WORD = /\bhickory\b/i;

/**
 * Hickory keeps its own wood-grain photo. PR 209's blueprint still builds the
 * shaker frame, but it must not replace this photo with a DL grain tile or a
 * brand-palette tint. "Rustic" alone is not hickory.
 */
export function keepsOwnWoodGrainPhoto(style: {
  ourName?: string | null;
  aliasName?: string | null;
  name?: string | null;
  woodSpecies?: string | null;
  finish?: string | null;
  doorStyle?: string | null;
  distributorName?: string | null;
} | null | undefined): boolean {
  if (!style) return false;
  return HICKORY_WORD.test([
    style.woodSpecies,
    style.ourName,
    style.name,
    style.aliasName,
    style.distributorName,
    style.doorStyle,
    style.finish,
  ].filter((part) => part && String(part).trim()).join(" "));
}

export function styleHasFivePieceSlabLabel(style: {
  doorStyle?: string | null;
  doorPanelType?: string | null;
  profileDescription?: string | null;
  profileNotes?: string | null;
} | null | undefined): boolean {
  if (!style) return false;
  return [style.doorStyle, style.doorPanelType, style.profileDescription, style.profileNotes]
    .some(isFivePieceSlabLabel);
}

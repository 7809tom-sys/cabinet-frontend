// ─────────────────────────────────────────────────────────────────────────────
// Finish-match rule (pure).
//
// Skins and decorative end panels are style/species-specific: an exposed side of
// a Hickory cabinet needs a Hickory skin, a White Shaker island needs a White
// Shaker end panel, etc. These items are ordered as a raw/finishable panel and
// MUST carry the cabinet's selected door-style finish through to the quote/order
// so the supplier finishes them to match.
//
// This module is the single source of truth for:
//   • requiresFinishMatch(...) — does this catalog line need finish matching?
//   • finishMatchLabel(styleName) — the short "Finish: X" annotation to show on
//     the line and to record on the order so the matched finish is explicit.
//
// Pure + dependency-free so it can be unit-tested and reused on client + server.
// ─────────────────────────────────────────────────────────────────────────────

export interface FinishMatchInput {
  category?: string | null;
  subCategory?: string | null;
  description?: string | null;
}

/**
 * True when a catalog line is a skin or decorative end/finished panel that must
 * be finished to match the cabinet's door style. Detection is intentionally
 * broad (category/subCategory/description) because these items live under the
 * Accessory category with varied naming (BDEP, WDEP, VDEP, REPV, BSV, S-24-96…).
 */
export function requiresFinishMatch(input: FinishMatchInput): boolean {
  const hay = [input.subCategory, input.description, input.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!hay) return false;
  // Explicit subcategories we assign in the catalog.
  if (/\bskin panel\b|\bdecorative end panel\b/.test(hay)) return true;
  // Description / name patterns for panels that get a finished, style-matched face.
  if (/\bskin\b/.test(hay)) return true;
  if (/\bend panel\b|\bend\b panel|decorative panel|finished end|island panel/.test(hay)) return true;
  if (/dishwasher (end )?panel|refrigerator (end )?panel|fridge panel/.test(hay)) return true;
  return false;
}

/**
 * The short annotation recorded against a finish-match line. Returns null when
 * no door style has been chosen yet (so callers can prompt instead).
 */
export function finishMatchLabel(styleName?: string | null): string | null {
  const s = (styleName ?? "").trim();
  return s.length > 0 ? `Finish: ${s}` : null;
}

export interface FinishMatchLine {
  masterCode?: string | null;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  qty?: number;
}

/**
 * Build a human-readable order note enumerating every finish-match line and the
 * door style they must be finished to match. Returns null when there are none,
 * so the caller can skip appending anything. This is what carries the rule
 * through to the quote/order text.
 */
export function finishMatchOrderNote(
  lines: FinishMatchLine[],
  styleName?: string | null,
): string | null {
  const matched = lines.filter((l) => requiresFinishMatch(l));
  if (matched.length === 0) return null;
  const style = (styleName ?? "").trim() || "the selected door style";
  const items = matched
    .map((l) => (l.masterCode ?? l.description ?? "panel"))
    .filter((v, i, a) => a.indexOf(v) === i); // dedupe codes
  return `Finish to match ${style}: ${items.join(", ")} (skins/end panels are finished to the cabinet door style).`;
}

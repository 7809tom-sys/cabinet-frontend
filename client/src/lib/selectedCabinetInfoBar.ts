/**
 * Selected-cabinet info bar copy.
 *
 * The bar reads `Selected <SKU> — <size> <name>`. Catalog descriptions often
 * continue past the name with a door and interior clause
 * (`— 1 Door; inside per distributor: ...`). That clause stays on the cabinet
 * for the catalog, quotes, the material list, the attributes panel, and PDFs.
 * Only this bar drops it. A dash that introduces the size
 * (`Filler — 3" W x 42" H`) is the size, so the bar keeps it.
 */

/** Em dash or en dash with space on both sides. A hyphen stays: it is part of a fraction or a size (`Leg - 3"W`). */
const NAME_CLAUSE_BREAK = /\s+[—–]\s+/;

/**
 * A clause that is the cabinet's size, not its door and interior notes.
 * `3" W x 42" H`, `96" × ¾"`, `42 in. W`, and a scribe filler's `cut to` note.
 * A bare `W`/`D` is not enough: `1 Door` starts with a count, not an inch mark.
 */
const SIZE_CLAUSE =
  /^(?:requires|for)\b|^(?:\d+(?:\.\d+)?(?:\s*-\s*\d+\/\d+|\s+\d+\/\d+)?)(?:[½¼¾⅛⅜⅝⅞])?\s*(?:"|in\b)|\bcut to\b/i;

/** The door, drawer, shelf, and interior clause that follows the cabinet name. */
const DOOR_INTERIOR_CLAUSE =
  /^(?:\d+\s+)?(?:plain\s+glass|glass-ready|full-height|false\s+drawer|doors?|drawers?|shel(?:f|ves)|no\s+doors?|no\s+drawer|open\s+|double\s+drawer|quarter-octagon|drawers?\s+(?:left|right))\b/i;

function withoutDistributorAside(text: string): string {
  const stripped = text
    .replace(/\s+Looks like:.*$/i, "")
    .replace(/;\s*inside per distributor:.*$/i, "");
  return stripped === text ? text : stripped.trim();
}

/** Size and name for the selected-cabinet info bar. The stored description is not changed. */
export function selectedCabinetInfoBarDescription(description: string | null | undefined): string {
  const text = (description ?? "").trim();
  if (!text) return "";
  const match = NAME_CLAUSE_BREAK.exec(text);
  if (!match || match.index === undefined) return withoutDistributorAside(text);
  const head = text.slice(0, match.index).trim();
  const tail = text.slice(match.index + match[0].length).trim();
  if (!head) return withoutDistributorAside(text);
  if (!DOOR_INTERIOR_CLAUSE.test(tail) && SIZE_CLAUSE.test(tail)) {
    const keptTail = withoutDistributorAside(tail);
    if (keptTail === tail) return text;
    return keptTail ? `${head} — ${keptTail}` : head;
  }
  return head;
}

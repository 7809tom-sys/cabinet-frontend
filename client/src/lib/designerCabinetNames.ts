/**
 * Designer-facing cabinet names.
 *
 * Issue #354 item 1 (Tom): the designer must never show the "RB" prefix or the
 * words "range base" on a cabinet. He does not see why a cabinet is called a
 * range base, and the RB designation is what made a 24" box beside a
 * freestanding range look like the right pick.
 *
 * This module is presentation only. `PlacedCabinet.masterCode` and
 * `DesignCabinet.masterCode` are NEVER rewritten: the distributor's native code
 * (RB3DB24) is what the cart, quote, purchase order, and distributor hand-off
 * send. Nothing here deletes, renames, or aliases a nomenclature code.
 *
 * What the designer shows instead is the cabinet the book actually sells
 * (altaeuro frameless spec book V8.2, pp. 29-30):
 *   RB2DB##  "Two Drawer Range Bases"                      -> two drawers
 *   RB3DB##  "Two Drawer One False Drawer Front Range Bases" -> two drawers + one false front
 *
 * The book never calls RB3DB a three-drawer cabinet: it is one false front plus
 * one working drawer over the drawer boxes, so the designer name says two
 * drawers, which is the other half of the wording mismatch in item 6.
 */

/** The dimension block the catalog rows lead with, e.g. `24" W × 34.75" H × 24" D `. */
const LEADING_DIMENSIONS = /^(\d+(?:\.\d+)?(?:\s*-?\s*\d+\/\d+)?)\s*"?\s*W\s*[×x]\s*(\d+(?:\.\d+)?(?:\s*-?\s*\d+\/\d+)?)\s*"?\s*H\s*[×x]\s*(\d+(?:\.\d+)?(?:\s*-?\s*\d+\/\d+)?)\s*"?\s*D\s*/i;

/** `RB3DB24`, `RB-2DB-30`, `rb3db36` — the frameless drop-in cooktop base family. */
const RANGE_BASE_CODE = /^RB-?([23])DB-?(\d{1,2})$/;

export type RangeBaseFamily = "two-drawer" | "two-drawer-one-false-front";

function compactCode(masterCode: string | null | undefined): string {
  return (masterCode ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** The RB drop-in cooktop base family encoded by a code, or null for every other code. */
export function rangeBaseFamilyForCode(masterCode: string | null | undefined): RangeBaseFamily | null {
  const match = RANGE_BASE_CODE.exec(compactCode(masterCode));
  if (!match) return null;
  return match[1] === "2" ? "two-drawer" : "two-drawer-one-false-front";
}

/** Nominal width encoded by an RB code (`RB3DB24` -> 24), or null. */
export function rangeBaseNominalWidth(masterCode: string | null | undefined): number | null {
  const match = RANGE_BASE_CODE.exec(compactCode(masterCode));
  if (!match) return null;
  const width = Number(match[2]);
  return Number.isFinite(width) && width > 0 ? width : null;
}

/** True for an RB drop-in cooktop base (`RB2DB*` / `RB3DB*`). */
export function isRangeBaseCabinetCode(masterCode: string | null | undefined): boolean {
  return rangeBaseFamilyForCode(masterCode) != null;
}

/** The book wording for one RB family, with no "range base" phrasing and no RB prefix. */
export function rangeBaseDesignerName(family: RangeBaseFamily): string {
  return family === "two-drawer"
    ? "Two Drawer Base for a drop-in cooktop"
    : "Two Drawer Base with One False Front for a drop-in cooktop";
}

/** The leading `24" W × 34.75" H × 24" D ` block of a catalog description, or "". */
export function leadingDimensionBlock(description: string | null | undefined): string {
  const match = LEADING_DIMENSIONS.exec((description ?? "").trim());
  if (!match) return "";
  return `${match[1]}" W × ${match[2]}" H × ${match[3]}" D `;
}

/**
 * A name the designer may show. A range base becomes the physical cabinet the
 * book sells; every other description keeps its own words but loses the
 * "range base" phrasing and any leading RB code if a supplier baked one in.
 */
export function designerCabinetName(input: {
  masterCode?: string | null;
  description?: string | null;
}): string {
  const family = rangeBaseFamilyForCode(input.masterCode);
  if (family) {
    return `${leadingDimensionBlock(input.description)}${rangeBaseDesignerName(family)}`;
  }
  const cleaned = (input.description ?? "")
    .replace(/^\s*RB-?\d+DB-?\d+\s*[—–-]+\s*/i, "")
    .replace(/\brange[\s-]*base\b/gi, "base")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || (input.masterCode ?? "").trim();
}

/**
 * The label the designer shows next to an order code. The code itself is never
 * changed; it is only labeled as the code it is, so a range base reads as a
 * cabinet first and a distributor code second.
 */
export function designerCabinetCodeLabel(masterCode: string | null | undefined): string {
  const code = (masterCode ?? "").trim();
  if (!code) return "";
  return isRangeBaseCabinetCode(code) ? `Order code ${code}` : code;
}

/**
 * True when a text is designer-facing copy that still carries the wording item
 * 1 forbids. Used by the guard test, never to rewrite stored data.
 */
export function hasForbiddenDesignerWording(text: string | null | undefined): boolean {
  return /\brange[\s-]*base\b/i.test(text ?? "");
}

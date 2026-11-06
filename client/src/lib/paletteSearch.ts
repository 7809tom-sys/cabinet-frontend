import { normalizeCode } from "@shared/cabinetCodeMatch";
import { catalogItemMatchesCode } from "@shared/catalogCodeSearch";
import { faircrest2020EquivalentCodes, hasFaircrest2020Alias } from "@shared/faircrest2020Aliases";

// Pure, dependency-free helpers for the cabinet palette search box.
// Kept in their own module so they can be unit-tested without importing the
// heavy DesignTool page component (which pulls in CSS and other deps).

// Normalize a palette search query so users can find sizes naturally: strip
// inch markers (", in, inch) and collapse whitespace, e.g. `24"`, `24 in`,
// `24 inch` all become `24`. Returns a lowercased, trimmed token.
export function normalizePaletteSearch(raw: string): string {
  return raw
    .toLowerCase()
    // Strip inch units only when they stand alone or directly follow a number
    // (e.g. `24"`, `24 in`, `24inch`), never the "in" inside words like basin.
    .replace(/"|''|\u2033/g, " ")
    .replace(/(\d)\s*(?:inches|inch|in)\b/g, "$1 ")
    .replace(/\b(?:inches|inch)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Match a palette cabinet against a normalized query. Matches the master code,
// the description, AND the numeric width/height in inches, so typing "24" finds
// every 24"-wide cabinet even when the code doesn't literally contain "24".
export function matchesPaletteTextOrSize(
  c: { description: string; width?: string | null; height?: string | null },
  q: string,
): boolean {
  if (!q) return true;
  if (c.description.toLowerCase().includes(q)) return true;
  // Width / height token match (whole-number inch search).
  const w = c.width != null ? parseFloat(c.width) : NaN;
  const h = c.height != null ? parseFloat(c.height) : NaN;
  const num = parseFloat(q);
  if (!Number.isNaN(num) && /^\d+(\.\d+)?$/.test(q)) {
    if (!Number.isNaN(w) && Math.round(w) === Math.round(num)) return true;
    if (!Number.isNaN(h) && Math.round(h) === Math.round(num)) return true;
  }
  return false;
}

export function matchesPaletteSearch(
  c: { masterCode: string; displayMasterCode?: string | null; description: string; width?: string | null; height?: string | null; aliases?: readonly string[] | string | null; replacementMasterCode?: string | null; sku?: string | null; vendorSku?: string | null; altSku1?: string | null; altSku2?: string | null; altSku3?: string | null },
  q: string,
): boolean {
  if (!q) return true;
  const code = c.masterCode.toLowerCase();
  const displayCode = c.displayMasterCode?.toLowerCase() ?? "";
  const normalizedCodeQuery = normalizeCode(q);
  if (
    code.includes(q)
    || displayCode.includes(q)
    || (normalizedCodeQuery.length > 0 && (
      normalizeCode(c.masterCode).includes(normalizedCodeQuery)
      || normalizeCode(c.displayMasterCode ?? "").includes(normalizedCodeQuery)
    ))
    || catalogItemMatchesCode(c, q)
  ) return true;
  // A Faircrest 2020 code finds our row and vice versa (WOS0930 <-> WEOS0930).
  if (normalizedCodeQuery.length > 0 && matchesFaircrest2020Code(c, normalizedCodeQuery)) return true;
  return matchesPaletteTextOrSize(c, q);
}

/** True when the query is the Faircrest 2020 spelling of this row's code. */
export function matchesFaircrest2020Code(
  c: { masterCode: string; displayMasterCode?: string | null },
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return false;
  // Nothing to widen for a row with no Faircrest mapping; its own code was
  // already compared by the caller.
  const ourCode = c.masterCode;
  const displayCode = c.displayMasterCode ?? "";
  if (!hasFaircrest2020Alias(ourCode) && !hasFaircrest2020Alias(displayCode)) return false;
  const equivalences = [
    ...faircrest2020EquivalentCodes(ourCode),
    ...faircrest2020EquivalentCodes(displayCode),
  ].map(normalizeCode);
  return equivalences.some((equivalent) => equivalent === normalizedQuery);
}

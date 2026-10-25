import { normalizeCode } from "@shared/cabinetCodeMatch";

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
export function matchesPaletteSearch(
  c: { masterCode: string; displayMasterCode?: string | null; description: string; width?: string | null; height?: string | null },
  q: string,
): boolean {
  if (!q) return true;
  const code = c.masterCode.toLowerCase();
  const displayCode = c.displayMasterCode?.toLowerCase() ?? "";
  const desc = c.description.toLowerCase();
  const normalizedCodeQuery = normalizeCode(q);
  if (
    code.includes(q)
    || displayCode.includes(q)
    || desc.includes(q)
    || (normalizedCodeQuery.length > 0 && (
      normalizeCode(c.masterCode).includes(normalizedCodeQuery)
      || normalizeCode(c.displayMasterCode ?? "").includes(normalizedCodeQuery)
    ))
  ) return true;
  // Width / height token match (whole-number inch search).
  const w = c.width != null ? parseFloat(c.width) : NaN;
  const h = c.height != null ? parseFloat(c.height) : NaN;
  const num = parseFloat(q);
  if (!Number.isNaN(num)) {
    // Only treat the whole query as a size when it is purely numeric, so a
    // text+number query like "db24" still relies on code/description matching.
    if (/^\d+(\.\d+)?$/.test(q)) {
      if (!Number.isNaN(w) && Math.round(w) === Math.round(num)) return true;
      if (!Number.isNaN(h) && Math.round(h) === Math.round(num)) return true;
    }
  }
  return false;
}

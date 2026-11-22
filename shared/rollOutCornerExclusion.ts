/**
 * Corner cabinets never take a roll-out tray. This helper is the single
 * eligibility gate used by the designer picker, cart aggregation, catalog
 * quick-view suggestions, and checkout cross-sell, so a missed catalog flag
 * cannot offer trays on a corner SKU.
 *
 * Detection is by model code prefix or a stored cornerType, plus an explicit
 * isCornerCabinet flag when the caller already has one. Description wording is
 * not used: a plain B24 stays eligible even if its text mentions a corner.
 */

const STORED_CORNER_TYPES = new Set([
  "blind-corner",
  "l-shape",
  "diagonal",
  "pie-cut",
  "lazy-susan",
  "easy-reach",
  "triangle",
]);

/**
 * Known corner-cabinet model-code prefixes, including BLS (used in Auto Design
 * and the catalog but previously missing from some corner checks).
 */
const CORNER_CODE_PREFIX =
  /^(?:BBC|WBC|BLB|BLS|BCB|LSB?|CSB|WLS|DCW|DCB|DCSB|CDB|ERB|BER|WER|WDC|KWD|AG-|AG\d|CAG|WTC|BTC)/;

export type RollOutCornerInput = {
  masterCode?: string | null;
  isCornerCabinet?: boolean | null;
  cornerType?: string | null;
};

export function isCornerCabinetExcludedFromRollOut(input: RollOutCornerInput): boolean {
  if (input.isCornerCabinet) return true;
  const cornerType = input.cornerType != null ? String(input.cornerType).trim().toLowerCase() : "";
  if (cornerType && STORED_CORNER_TYPES.has(cornerType)) return true;
  const code = (input.masterCode ?? "").toUpperCase();
  if (!code) return false;
  if (CORNER_CODE_PREFIX.test(code)) return true;
  if (/-CNR|CORNER/.test(code)) return true;
  return false;
}

/** True when catalog text is about a roll-out / rollout tray or shelf add-on. */
export function isRollOutTrayCatalogText(text: string | null | undefined): boolean {
  return /roll[- ]?outs?\s+(?:tray(?:s|'s)?|shelves|shelf)|rollouts?\s+(?:tray(?:s|'s)?|shelves|shelf)/i.test(text ?? "");
}

/** True when a catalog row itself is a roll-out tray / roll-out shelf product. */
export function isRollOutTrayProduct(item: {
  masterCode?: string | null;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
}): boolean {
  const code = (item.masterCode ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (/^(?:UNIV-?ROT|ROT)\d|^RS(?:-?\d)/.test(code)) return true;
  return isRollOutTrayCatalogText(
    [item.masterCode, item.category, item.subCategory, item.description].filter(Boolean).join(" "),
  );
}

/**
 * Presentation-only: drop "rollout tray" / "roll-out shelf" phrases from a
 * corner cabinet's displayed description or subcategory. Stored catalog data
 * is not rewritten.
 */
export function displayTextWithoutRollOutTray(text: string | null | undefined): string {
  if (!text) return "";
  const cleaned = text
    .replace(
      /(?:^|[\s,;:()/—–-]+)(?:with\s+|w\/\s*)?roll[- ]?outs?\s+(?:tray(?:s|'s)?|shelves|shelf)\b/gi,
      " ",
    )
    .replace(
      /(?:^|[\s,;:()/—–-]+)(?:with\s+|w\/\s*)?rollouts?\s+(?:tray(?:s|'s)?|shelves|shelf)\b/gi,
      " ",
    )
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/^[ \t,;:./—–-]+|[ \t,;:./—–-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned;
}

/** Designer-facing description for a cabinet, with tray phrases removed on corners only. */
export function cornerSafeDisplayText(
  text: string | null | undefined,
  input: RollOutCornerInput,
): string {
  const raw = text ?? "";
  if (!isCornerCabinetExcludedFromRollOut(input)) return raw;
  return displayTextWithoutRollOutTray(raw);
}

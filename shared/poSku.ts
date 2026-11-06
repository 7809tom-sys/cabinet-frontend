/**
 * The PO SKU we send a distributor, e.g. "usd-sw-3db18".
 *
 * The SKU is built from three parts: the distributor's code, the door style's
 * code, and the distributor's own item code. For most distributors those are
 * three distinct tokens. Some distributors reuse a code across the parts — the
 * Clark and Son ("CS") line is both the distributor code and the style code, and
 * its item codes already start with "CS-" (CS-DB18). Concatenating blindly gave
 * "cs-cs-cs-db18" on the admin order page: the same token three times.
 *
 * The rule is deliberately conservative: keep each part's tokens in order and
 * drop a token that has already appeared. Nothing is invented and no part is
 * reordered, so a normal distributor is byte-for-byte unchanged.
 */

/** Split a SKU part into non-empty tokens, tolerating "cs-db18" and "CS DB18". */
function tokens(value: string | null | undefined): string[] {
  return String(value ?? "")
    .trim()
    .split(/[-\s_]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * Build the PO SKU, collapsing repeated tokens.
 *
 *   buildPoSku("USD", "SW", "3DB18")    → "usd-sw-3db18"
 *   buildPoSku("CS",  "CS", "CS-DB18")  → "cs-db18"
 *   buildPoSku("CS",  "WS", "DB18")     → "cs-ws-db18"
 */
export function buildPoSku(
  distributorCode: string | null | undefined,
  styleCode: string | null | undefined,
  distributorSku: string | null | undefined,
): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const token of [...tokens(distributorCode), ...tokens(styleCode), ...tokens(distributorSku)]) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(key);
  }
  return kept.join("-");
}

/**
 * Repair a PO SKU that was already stored with repeated tokens ("cs-cs-cs-db18").
 * Display paths use this so an existing order reads correctly without a data
 * migration.
 */
export function normalizePoSku(value: string | null | undefined): string {
  return buildPoSku(null, null, value);
}

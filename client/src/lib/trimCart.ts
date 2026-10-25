// Trim → cart / build-sheet pricing helper.
//
// The Design Tool auto-adds physical trim (toe kick, light rail, batten); crown is opt-in, and all trim lets
// the user add fillers/scribe. Previously those trims were computed for the
// build sheet only and never became priced cart line items, so a designed
// kitchen's trim was missing from the cart (and showed "incl." / $0). They also
// didn't reflect the selected finish.
//
// This helper resolves each ACTIVE trim to its per-style priced SKU. Because the
// price lookup is keyed by the design's styleId, the resolved trim inherits the
// cabinets' finish/color automatically. Trims with no SKU for the selected style
// resolve to null and are left as quote-only lines rather than blocking the cart
// or inventing a price.

export type TrimKind = "toeKick" | "lightRail" | "batten" | "crown" | "valance";

// Map each auto-trim to the master code that carries its per-style priced SKU.
// Ashford carries its standard 96-inch crown as LCM8 in every active finish.
export const TRIM_MASTER_CODES: Record<TrimKind, string | null> = {
  toeKick: "TK-8",
  lightRail: "LRM-8",
  batten: "BAM",
  crown: "LCM8",
  valance: "VA-48", // Arched valance (only VA-48 exists in catalog; trimmed to fit on site)
};

// A few supplier catalogs preserve the product-family suffix inside the actual
// master code. Keep the short, shared trim key for existing layouts, while also
// accepting the verified source code. The resolved cart line always returns the
// real source masterCode; this list only makes the lookup resilient.
export const TRIM_MASTER_CODE_ALIASES: Partial<Record<TrimKind, readonly string[]>> = {
  toeKick: ["TK8(TKC)", "TK-8(TKC)", "TKC"],
};

/**
 * Returns the auto-trim family for either its short shared design key or a
 * verified supplier-specific catalog code.  Build sheets created before a
 * supplier import can retain the short key (for example `TK-8`), while the
 * buyable supplier line correctly retains the source code (`TK-8(TKC)`).
 */
export function trimKindForMasterCode(masterCode: string | null | undefined): TrimKind | null {
  const code = masterCode?.trim();
  if (!code) return null;
  for (const kind of Object.keys(TRIM_MASTER_CODES) as TrimKind[]) {
    if (TRIM_MASTER_CODES[kind] === code) return kind;
    if ((TRIM_MASTER_CODE_ALIASES[kind] ?? []).includes(code)) return kind;
  }
  return null;
}

/** True when two design/source codes represent the same approved trim family. */
export function equivalentTrimMasterCodes(left: string | null | undefined, right: string | null | undefined): boolean {
  if (left === right) return true;
  const leftKind = trimKindForMasterCode(left);
  return leftKind != null && leftKind === trimKindForMasterCode(right);
}

// A resolved, priced trim SKU for one style (as returned by the
// design.trimSkusForStyles procedure, after tier resolution on the client).
export interface TrimPrice {
  cabinetId: number;
  masterCode: string;
  description: string | null;
  unitPrice: number; // already tier-resolved
}

// The minimal cart line shape this helper emits. Matches the fields the
// DesignTool cart builder needs (kept structurally compatible with CartItem).
export interface TrimCartLine {
  masterCode: string;
  name: string;
  styleId: number;
  styleLabel: string;
  unitPrice: number;
  qty: number;
}

// One active trim to consider: its kind and how many sticks/pieces are needed.
export interface ActiveTrim {
  kind: TrimKind;
  pieces: number;
}

/**
 * Resolves one priced trim product by its shared design key and any verified
 * catalog-code variants. Never manufactures a substitute price or SKU.
 */
export function trimPriceForKind(
  kind: TrimKind,
  priceByCode: Map<string, TrimPrice>,
): TrimPrice | undefined {
  const code = TRIM_MASTER_CODES[kind];
  if (code) {
    const direct = priceByCode.get(code);
    if (direct) return direct;
  }
  for (const alias of TRIM_MASTER_CODE_ALIASES[kind] ?? []) {
    const matched = priceByCode.get(alias);
    if (matched) return matched;
  }
  return undefined;
}

/**
 * Build priced cart lines for the active trims of a single-style design.
 *
 * @param trims       active trims with their piece counts (pieces > 0 to count)
 * @param styleId     the design's selected door style id (finish scope)
 * @param styleLabel  human-readable finish/color name for the line
 * @param priceByCode lookup: trim master code -> resolved priced SKU (for styleId)
 * @returns priced cart lines (one per priced, active trim with pieces > 0)
 *
 * Trims are skipped when: pieces <= 0, the kind has no buyable master code, or
 * no priced SKU exists for the style (priceByCode miss). Skipped trims are the
 * caller's cue to render a quote-only build-sheet line.
 */
export function buildTrimCartLines(
  trims: ActiveTrim[],
  styleId: number | null,
  styleLabel: string,
  priceByCode: Map<string, TrimPrice>,
): TrimCartLine[] {
  if (styleId == null) return [];
  const out: TrimCartLine[] = [];
  for (const t of trims) {
    if (!t || t.pieces <= 0) continue;
    const priced = trimPriceForKind(t.kind, priceByCode);
    if (!priced || !(priced.unitPrice > 0)) continue; // no SKU for this style → quote-only
    out.push({
      masterCode: priced.masterCode,
      name: priced.description ?? priced.masterCode,
      styleId,
      styleLabel,
      unitPrice: priced.unitPrice,
      qty: t.pieces,
    });
  }
  return out;
}

/**
 * True when a given active trim kind can be resolved to a real price for the
 * current style. Used by the build sheet to decide whether to show a price or a
 * "quote" tag for the trim line.
 */
export function trimHasPrice(
  kind: TrimKind,
  priceByCode: Map<string, TrimPrice>,
): boolean {
  const p = trimPriceForKind(kind, priceByCode);
  return !!p && p.unitPrice > 0;
}

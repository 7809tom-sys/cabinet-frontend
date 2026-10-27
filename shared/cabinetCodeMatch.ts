import { catalogCodeLookup, CATALOG_SEARCH_RANK } from "./catalogCodeSearch";

// ─────────────────────────────────────────────────────────────────────────────
// Cabinet code matching (OCR photo-to-cart)
//
// A user uploads a floor plan / cabinet list image. A vision model extracts a
// list of { code, quantity } pairs. This pure module matches each extracted
// code against the master catalog so the result is fully testable without the
// LLM.
//
// Matching strategy (in order):
//   1. Exact match on normalized masterCode
//   2. Match ignoring separators (B24 == B-24 == B 24)
//   3. Prefix/startsWith on normalized code (handles minor OCR truncation)
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogEntry {
  id: number;
  masterCode: string;
  description: string;
  category: string;
  replacementMasterCode?: string | null;
  aliases?: readonly string[] | string | null;
  aliasCodes?: readonly string[] | string | null;
  sku?: string | null;
  vendorSku?: string | null;
  altSku1?: string | null;
  altSku2?: string | null;
  altSku3?: string | null;
}

export interface ExtractedCode {
  code: string;
  quantity?: number | string | null;
}

export type MatchConfidence = "exact" | "normalized" | "fuzzy" | "none";

export interface MatchResult {
  /** The raw code as read off the image. */
  rawCode: string;
  quantity: number;
  matched: boolean;
  confidence: MatchConfidence;
  cabinetId: number | null;
  masterCode: string | null;
  description: string | null;
  category: string | null;
  /** Other plausible catalog codes when the match was fuzzy/none. */
  candidates: string[];
}

/** Uppercase + strip every non-alphanumeric character. */
export function normalizeCode(code: string): string {
  return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function matchCabinetCodes(
  extracted: ExtractedCode[],
  catalog: CatalogEntry[],
): MatchResult[] {
  // Pre-index the catalog by normalized code.
  const byNorm = new Map<string, CatalogEntry>();
  for (const c of catalog) {
    const n = normalizeCode(c.masterCode);
    if (!byNorm.has(n)) byNorm.set(n, c);
  }
  const normKeys = Array.from(byNorm.keys());
  const aliasLookup = catalogCodeLookup(catalog);

  const out: MatchResult[] = [];
  for (const item of extracted) {
    const raw = (item.code || "").trim();
    const qty =
      item.quantity == null || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 1
        ? 1
        : Math.floor(Number(item.quantity));
    if (!raw) continue;

    const norm = normalizeCode(raw);

    // 1 & 2: exact / normalized are the same after normalization.
    // A current item code still wins. Alias codes, and a row whose
    // ReplacementMasterCode points at a different master, resolve below.
    const direct = byNorm.get(norm);
    const replacement = normalizeCode(direct?.replacementMasterCode ?? "");
    const directIsCurrent = direct != null && (!replacement || replacement === normalizeCode(direct.masterCode));
    const aliasHit = aliasLookup.get(norm);
    const pushMatch = (hit: CatalogEntry, confidence: MatchConfidence) => {
      out.push({
        rawCode: raw,
        quantity: qty,
        matched: true,
        confidence,
        cabinetId: hit.id,
        masterCode: hit.masterCode,
        description: hit.description,
        category: hit.category,
        candidates: [],
      });
    };
    if (direct && directIsCurrent) {
      pushMatch(direct, normalizeCode(direct.masterCode) === norm ? "exact" : "normalized");
      continue;
    }
    if (aliasHit) {
      const hit = catalog[aliasHit.recordIndex];
      if (hit) {
        pushMatch(hit, aliasHit.rank === CATALOG_SEARCH_RANK.exactItem ? "exact" : "normalized");
        continue;
      }
    }
    if (direct) {
      pushMatch(direct, normalizeCode(direct.masterCode) === norm ? "exact" : "normalized");
      continue;
    }

    // 3: fuzzy — unique prefix match.
    const prefixHits = norm.length >= 3 ? normKeys.filter((k) => k.startsWith(norm) || norm.startsWith(k)) : [];
    if (prefixHits.length === 1) {
      const hit = byNorm.get(prefixHits[0])!;
      out.push({
        rawCode: raw,
        quantity: qty,
        matched: true,
        confidence: "fuzzy",
        cabinetId: hit.id,
        masterCode: hit.masterCode,
        description: hit.description,
        category: hit.category,
        candidates: [],
      });
      continue;
    }

    // No confident match — surface candidates for manual selection.
    out.push({
      rawCode: raw,
      quantity: qty,
      matched: false,
      confidence: "none",
      cabinetId: null,
      masterCode: null,
      description: null,
      category: null,
      candidates: prefixHits.slice(0, 5).map((k) => byNorm.get(k)!.masterCode),
    });
  }

  return out;
}

/** Summary counts for the review UI. */
export function summarizeMatches(results: MatchResult[]) {
  return {
    total: results.length,
    matched: results.filter((r) => r.matched).length,
    unmatched: results.filter((r) => !r.matched).length,
    units: results.reduce((s, r) => s + r.quantity, 0),
  };
}

// ─── Cabinet code matching ─────────────────────────────────────────────────────
// Trade buyers reference cabinets by shorthand that varies wildly across quotes,
// spreadsheets, and handwritten lists (e.g. "B24", "b-24", "DB24-3", "W 30 30",
// "BBC45"). This module normalizes those tokens and fuzzy-matches them against
// the platform's master code list so OCR/CSV/manual entry can resolve to a real
// cabinet record. It is pure (no DB / no IO) so it is trivially unit-testable.

export type CabinetCodeRecord = {
  id: number;
  masterCode: string;
  description?: string | null;
  category?: string | null;
};

export type CodeMatch = {
  rawCode: string;
  normalized: string;
  cabinetId: number | null;
  masterCode: string | null; // resolved master code, or null when unmatched
  description: string | null;
  matched: boolean;
  confidence: "exact" | "normalized" | "fuzzy" | "none";
};

// Strip everything down to uppercase alphanumerics. "DB-24-3" -> "DB243",
// "w 30 30" -> "W3030". This is the comparison key used for loose matching.
export function canonicalize(code: string): string {
  return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ─── Prefix aliases ───────────────────────────────────────────────────────────
// Trade quotes use prefixes that differ from the platform's catalog convention.
// These map a buyer's leading-letter prefix to the catalog family prefix so the
// dimensioned remainder can still resolve against real master codes.
//   RW   = Refrigerator Wall            -> AW (above-fridge / refrigerator wall, 24" deep)
//   WF   = Wall Filler                  -> F  (filler family; e.g. F-3-42)
//   WDC  = Wall Diagonal Corner cabinet -> DCW (diagonal corner wall)
//   LS   = Lazy Susan                   -> LSB (base easy-reach lazy susan)
//   HB   = (Full) Height Base           -> BFH (base full height)
//   TFHB = Tall Full Height Base roller -> BFH (base full height)
//   WP   = Wall Pantry / tall utility   -> U  (tall utility/pantry, e.g. U-24-96-24)
//   PC   = Pantry Cabinet               -> U
//   TUC  = Tall Utility Cabinet         -> U
//   PAN  = Pantry                       -> U
// RS (Roll Out Shelf) already matches the catalog RS prefix, so no alias needed.
export const PREFIX_ALIASES: Record<string, string> = {
  RW: "AW",
  WF: "F",
  WDC: "DCW",
  LS: "LSB",
  HB: "BFH",
  TFHB: "BFH",
  WP: "U",
  PC: "U",
  TUC: "U",
  PAN: "U",
};

// Directional / handedness suffixes that describe orientation, not a different
// cabinet. We strip these for matching (the base cabinet is the same SKU) but the
// caller can surface handedness separately if needed.
//
// Remove a trailing handedness marker from a raw code. "WDC2430-R" -> "WDC2430",
// "W1830-L" -> "W1830", "B21-R" -> "B21". Only strips a SINGLE trailing L/R that
// follows a digit (so we don't eat a real trailing letter like the L in a code).
export function stripHandedness(raw: string): { code: string; hand: "L" | "R" | null } {
  const trimmed = (raw || "").trim().toUpperCase();
  // Match an explicit dash + L/R, or a glued single L/R that follows a digit.
  const m = trimmed.match(/^(.*?\d[A-Z]*?)(?:-(L|R|LH|RH)|(L|R))$/);
  if (m) {
    const hand = (m[2] || m[3] || "").charAt(0) as "L" | "R";
    // Guard: don't strip if the remainder no longer contains a digit.
    if (/\d/.test(m[1])) return { code: m[1], hand: hand === "L" || hand === "R" ? hand : null };
  }
  return { code: trimmed, hand: null };
}

// Apply a prefix alias to a canonicalized code. "RW3618" -> "AW3618".
function applyPrefixAlias(canon: string): string {
  const m = canon.match(/^([A-Z]+)(\d.*)?$/);
  if (!m) return canon;
  const prefix = m[1];
  const rest = m[2] ?? "";
  const alias = PREFIX_ALIASES[prefix];
  return alias ? `${alias}${rest}` : canon;
}

// Normalize a raw user/OCR token into the platform's dash-delimited shape where
// we can confidently infer it. We DON'T guess wildly here — we only insert the
// dashes that the catalog convention uses:
//   - Prefix letters followed by digits:  B24      -> B-24,  DB243 -> DB-24-3
//   - Wall double-dimension:              W3030    -> W-30-30
// Anything we can't confidently reshape is returned canonicalized so the caller
// can still attempt a canonical-key match.
export function normalizeCode(raw: string): string {
  const trimmed = (raw || "").trim().toUpperCase();
  if (!trimmed) return "";

  // Preserve a code that already looks dash-delimited and catalog-shaped.
  if (/^[A-Z]+(-[A-Z0-9]+)+$/.test(trimmed)) {
    return trimmed.replace(/\s+/g, "");
  }

  const canon = canonicalize(trimmed);
  // Split into leading letters, then the remainder.
  const m = canon.match(/^([A-Z]+)(\d.*)?$/);
  if (!m) return canon;
  const prefix = m[1];
  const rest = m[2] ?? "";
  if (!rest) return prefix;

  // Split the remainder into explicit numeric groups (when dashes were present)
  // and a trailing alpha suffix (e.g. GD, FH, R, MINI, TRAY) which stays glued
  // to the last numeric group rather than being dashed off.
  const suffixMatch = rest.match(/^([0-9-]+)([A-Z].*)?$/);
  if (!suffixMatch) return `${prefix}-${rest}`;
  const numberPart = suffixMatch[1];
  const suffix = suffixMatch[2] ?? "";
  let nums = numberPart.split("-").filter(Boolean);

  // When the digits are glued together (no dashes), try to split them into
  // the catalog's expected groups:
  if (nums.length === 1) {
    const digits = nums[0];
    // Wall cabinets carry two dimensions: W3030 -> 30 + 30.
    if (prefix === "W" && digits.length === 4) {
      nums = [digits.slice(0, 2), digits.slice(2)];
    } else if (digits.length === 3) {
      // Drawer/specialty bases end with a small count digit: DB243 -> 24 + 3.
      nums = [digits.slice(0, 2), digits.slice(2)];
    }
  }

  const joined = nums.join("-");
  return suffix ? `${prefix}-${joined}${suffix}` : `${prefix}-${joined}`;
}

// Build a lookup index from a master-code list. Returns maps keyed by exact code
// and by canonical key for O(1) matching.
export function buildCodeIndex(records: CabinetCodeRecord[]) {
  const byExact = new Map<string, CabinetCodeRecord>();
  const byCanon = new Map<string, CabinetCodeRecord[]>();
  for (const r of records) {
    const code = r.masterCode.toUpperCase();
    byExact.set(code, r);
    const key = canonicalize(code);
    const list = byCanon.get(key) ?? [];
    list.push(r);
    byCanon.set(key, list);
  }
  return { byExact, byCanon };
}

// Match a single raw code against the index.
//
// `aliasMap` is an optional persisted lookup of canonical raw code -> cabinet
// record (populated from user-confirmed "Fix"/swap choices). A literal active
// master code always wins; aliases are then consulted before fuzzy guessing.
export function matchCode(
  rawCode: string,
  index: ReturnType<typeof buildCodeIndex>,
  aliasMap?: Map<string, CabinetCodeRecord>
): CodeMatch {
  const raw = (rawCode || "").trim();
  const normalized = normalizeCode(raw);
  const base: Omit<CodeMatch, "cabinetId" | "masterCode" | "description" | "matched" | "confidence"> = {
    rawCode: raw,
    normalized,
  };

  // 0) The Cart stores the selected catalog master code. Prefer an exact active
  // master spelling before any normalized alias: records such as W2430 and
  // W-2430 can legitimately coexist on source-specific lines, and reducing
  // both to W2430 makes a valid Cart line look ambiguous at Order Review.
  const exactRaw = index.byExact.get(raw.toUpperCase());
  if (exactRaw) {
    return {
      ...base,
      cabinetId: exactRaw.id,
      masterCode: exactRaw.masterCode,
      description: exactRaw.description ?? null,
      matched: true,
      confidence: "exact",
    };
  }

  // 1) Persisted aliases remain authoritative for a code that is not itself an
  // active master (a human already mapped that alternate spelling).
  if (aliasMap) {
    const aliasHit = aliasMap.get(canonicalize(raw));
    if (aliasHit) {
      return {
        ...base,
        cabinetId: aliasHit.id,
        masterCode: aliasHit.masterCode,
        description: aliasHit.description ?? null,
        matched: true,
        confidence: "normalized",
      };
    }
  }

  // 2) Exact match on normalized dash-delimited code.
  const exact = index.byExact.get(normalized.toUpperCase());
  if (exact) {
    return {
      ...base,
      cabinetId: exact.id,
      masterCode: exact.masterCode,
      description: exact.description ?? null,
      matched: true,
      confidence: normalized.toUpperCase() === raw.toUpperCase() ? "exact" : "normalized",
    };
  }

  // 3) Canonical-key match (handles spacing/dash differences). If exactly one
  // record shares the canonical key, accept it as a normalized match.
  const canon = canonicalize(raw);
  const canonList = index.byCanon.get(canon);
  if (canonList && canonList.length === 1) {
    const rec = canonList[0];
    return {
      ...base,
      cabinetId: rec.id,
      masterCode: rec.masterCode,
      description: rec.description ?? null,
      matched: true,
      confidence: "normalized",
    };
  }

  // 3a) Retry the canonical-key match after stripping handedness (-R/-L) and
  // applying a prefix alias (RW->AW, WDC->DCW, etc.). Handedness does not change
  // the SKU, and the alias re-points a trade prefix at the catalog family.
  const { code: deHanded } = stripHandedness(raw);
  const candidateCanons = new Set<string>();
  candidateCanons.add(canonicalize(deHanded));
  candidateCanons.add(applyPrefixAlias(canonicalize(deHanded)));
  candidateCanons.add(applyPrefixAlias(canonicalize(raw)));
  for (const ck of Array.from(candidateCanons)) {
    if (!ck || ck === canon) continue;
    const list = index.byCanon.get(ck);
    if (list && list.length === 1) {
      const rec = list[0];
      return {
        ...base,
        cabinetId: rec.id,
        masterCode: rec.masterCode,
        description: rec.description ?? null,
        matched: true,
        confidence: "normalized",
      };
    }
  }
  // 3b) Canonical key of the normalized form (e.g. raw "W 30 30" -> normalized
  // "W-30-30" -> canon "W3030").
  const normCanon = canonicalize(normalized);
  if (normCanon !== canon) {
    const normCanonList = index.byCanon.get(normCanon);
    if (normCanonList && normCanonList.length === 1) {
      const rec = normCanonList[0];
      return {
        ...base,
        cabinetId: rec.id,
        masterCode: rec.masterCode,
        description: rec.description ?? null,
        matched: true,
        confidence: "normalized",
      };
    }
  }

  // 4) Fuzzy: unique prefix-of-canonical match. Useful when a buyer drops a
  // trailing suffix or count (e.g. "DB24" -> "DB-24-3"), OR carries an extra
  // dimension the catalog family code omits (e.g. "LS3612" -> alias "LSB3612"
  // -> unique family "LSB36"). We try the raw canonical AND the de-handed /
  // prefix-aliased canonical forms as prefixes. Only accept when the candidate
  // set collapses to a single record to avoid wrong guesses.
  const prefixKeys = Array.from(
    new Set(
      [canon, ...Array.from(candidateCanons)].filter((k) => k && k.length >= 2)
    )
  );
  for (const pk of prefixKeys) {
    // Match in BOTH directions: catalog key extends the query (dropped count),
    // or the query extends the catalog key (extra dimension on a family code).
    const uniq = new Map<number, CabinetCodeRecord>();
    Array.from(index.byCanon.entries()).forEach(([key, recs]) => {
      if (key.startsWith(pk) || pk.startsWith(key)) {
        recs.forEach((r) => uniq.set(r.id, r));
      }
    });
    if (uniq.size === 1) {
      const rec = Array.from(uniq.values())[0];
      return {
        ...base,
        cabinetId: rec.id,
        masterCode: rec.masterCode,
        description: rec.description ?? null,
        matched: true,
        confidence: "fuzzy",
      };
    }
  }

  // No confident match.
  return {
    ...base,
    cabinetId: null,
    masterCode: null,
    description: null,
    matched: false,
    confidence: "none",
  };
}

// Convenience: match a batch of raw codes.
export function matchCodes(
  rawCodes: string[],
  records: CabinetCodeRecord[]
): CodeMatch[] {
  const index = buildCodeIndex(records);
  return rawCodes.map((c) => matchCode(c, index));
}

// ─── CSV parsing ────────────────────────────────────────────────────────────
// Minimal, dependency-free CSV parser tuned for "code,qty" bulk-order lists.
// Tolerates a header row, extra columns, quoted fields, and tab/semicolon
// delimiters. Returns { code, qty } rows. Rows without a usable code are
// dropped; qty defaults to 1 and is clamped to >= 1.

export type CsvOrderRow = { code: string; qty: number };

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/)[0] ?? "";
  if (firstLine.includes("\t")) return "\t";
  if (firstLine.includes(";") && !firstLine.includes(",")) return ";";
  return ",";
}

export function parseOrderCsv(text: string): CsvOrderRow[] {
  if (!text) return [];
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: CsvOrderRow[] = [];

  lines.forEach((line, idx) => {
    const cells = splitCsvLine(line, delimiter);
    if (cells.length === 0) return;
    const first = cells[0] ?? "";
    // Skip an obvious header row.
    if (
      idx === 0 &&
      /^(code|sku|item|cabinet|part|model)$/i.test(first.replace(/[^a-z]/gi, ""))
    ) {
      return;
    }
    const code = first.trim();
    if (!code) return;
    // qty: look for a numeric value in the 2nd cell, else default to 1.
    let qty = 1;
    const qtyCell = cells[1];
    if (qtyCell !== undefined && qtyCell !== "") {
      const n = parseInt(qtyCell.replace(/[^0-9.-]/g, ""), 10);
      if (Number.isFinite(n) && n > 0) qty = n;
    }
    rows.push({ code, qty });
  });

  return rows;
}

/**
 * Master nomenclature families (Part 3) and the Part 4 alternative ranking.
 *
 * Rule: every corner cabinet — Lazy Susan (carousel), blind corner, diagonal /
 * 45° (BEC/DCW/WDC), easy-reach (ERB/BER/WER), wall corners — belongs to ONE
 * family: CORNER. Base vs wall corner is a sub-group used only for placement
 * and for alternative search; it is not a separate family. Sister / variant
 * cabinets (ADA, GD glass) stay in the same family as their parent.
 *
 * The family groups; it never swaps size, price, or 3D shape. A 36" Lazy
 * Susan is never the same price as a 42" blind corner — pricing is always the
 * exact cabinet's own row.
 */
export type NomenclatureFamily =
  | "CORNER"
  | "BASE"
  | "WALL"
  | "TALL"
  | "VANITY"
  | "FILLER"
  | "PANEL"
  | "MOLDING"
  | "ACCESSORY"
  | "UNKNOWN";

export type CornerSubGroup = "base-corner" | "wall-corner" | null;

export type CornerFunction = "carousel" | "easy-reach" | "blind" | "diagonal" | "l-shape" | "sink" | "drawer" | "appliance-garage" | "other";

export type FamilySource = {
  masterCode: string;
  description: string | null;
  category: string | null;
  subCategory: string | null;
  placementType: string | null;
  width: number;
  height: number;
  depth: number;
  hingeSide: string | null;
  numberOfDoors: number | null;
  numberOfDrawers: number | null;
  isCornerCabinet: boolean;
  cornerType: string | null;
};

export type FamilyCandidate = FamilySource & {
  cabinetId: number;
  catalogImageUrl?: string | null;
};

export type FamilyTag = {
  family: NomenclatureFamily;
  cornerSubGroup: CornerSubGroup;
  cornerFunction: CornerFunction | null;
  /** True for non-cabinet parts (sink fronts, trays, loose doors, mouldings). */
  isPart: boolean;
};

const CORNER_CODE = /^(BBC|WBC|BLB|LSB?|CSB|WLS|DCW|DCB|DCSB|DCFF|DCSF|ER|ERB|BER|WER|WDC|KWD|AG-|AG\d|CAG|CDB|WCA|BEC|BA-|PGWDC|SBF)/;
const CORNER_TEXT = /corner|lazy susan|easy reach|easy-reach|blind|diagonal|angled (wall|corner)/;
const PART_TEXT = /\b(front|tray|insert|moulding|molding|leg|floor kit|glass door|door only|kit|valance|toe kick|toekick|scribe|batten|shelf|shelves|dishwasher panel|appliance panel)\b/;
const PART_CODE = /^(VA|VAS|VASH|VAL|TK|TKC|SCR|SM|WS|BS|ROT|RTK|DWR|DWP|FEP|BEP|REP|WEP|TEP)\d*/;

function text(source: Pick<FamilySource, "description" | "category" | "subCategory">): string {
  return `${source.category ?? ""} ${source.subCategory ?? ""} ${source.description ?? ""}`.toLowerCase();
}

export function cornerFunctionFor(source: FamilySource): CornerFunction {
  const code = source.masterCode.toUpperCase();
  const t = text(source);
  const ct = (source.cornerType ?? "").toLowerCase();
  // Code prefixes are the catalog's own statement of function and win over
  // marketing text (Madison's LSB36 says "Easy Reach ... with Two Lazy Susans").
  if (/^AG/.test(code)) return "appliance-garage";
  if (/^CDB/.test(code)) return "drawer";
  if (/^(CSB|DCSB|DCFF|DCSF|SBF)/.test(code)) return "sink";
  if (/^(BBC|WBC|BLB)/.test(code)) return "blind";
  if (/^(LSB?|WLS)\d/.test(code)) return "carousel";
  if (/^(ERB|BER|WER|ER)\d|^WER-/.test(code)) return "easy-reach";
  if (/^(DCW|WDC|BEC|BA-|WCA|PGWDC|CAG)/.test(code)) return "diagonal";
  if (/appliance garage/.test(t)) return "appliance-garage";
  if (/corner drawer/.test(t)) return "drawer";
  if (/sink/.test(t)) return "sink";
  if (ct === "blind-corner" || /blind/.test(t)) return "blind";
  if (ct === "lazy-susan" || /lazy susan/.test(t)) return "carousel";
  if (/easy[ -]?reach/.test(t)) return "easy-reach";
  if (ct === "diagonal" || /diagonal|angle/.test(t)) return "diagonal";
  if (ct === "l-shape") return "l-shape";
  return "other";
}

export function isCornerFamily(source: FamilySource): boolean {
  const code = source.masterCode.toUpperCase();
  // AW-* is an angled WALL-END cabinet on a straight run, not a corner.
  if (/^AW[-\d]/.test(code)) return false;
  if (source.isCornerCabinet) return true;
  if (source.cornerType && source.cornerType.trim()) return true;
  if (CORNER_CODE.test(code)) return true;
  if (/-CNR|CORNER/.test(code)) return true;
  return CORNER_TEXT.test(text(source));
}

export function nomenclatureFamilyFor(source: FamilySource): FamilyTag {
  const code = source.masterCode.toUpperCase();
  const t = text(source);
  const placement = (source.placementType ?? "").toLowerCase();
  const isPart = placement.startsWith("accessory")
    || (source.depth > 0 && source.depth < 3 && !/panel|filler/.test(t))
    || PART_TEXT.test(t)
    || (PART_CODE.test(code) && !/^(V|VSB|VDB|VB)\d/.test(code));
  if (/molding|moulding/.test(t) || /^(OCM|OCS|CM|SM|LRM|TK|TKC|BM|CRN)/.test(code)) {
    return { family: "MOLDING", cornerSubGroup: null, cornerFunction: null, isPart: true };
  }
  if (isCornerFamily(source)) {
    const wall = placement === "wall" || /^(WBC|WER|WDC|DCW|WCA|AG|PGWDC|WLS|KWD)/.test(code);
    return {
      family: "CORNER",
      cornerSubGroup: wall ? "wall-corner" : "base-corner",
      cornerFunction: cornerFunctionFor(source),
      isPart,
    };
  }
  if (/filler/.test(t) || /^(F|WF|BF|TF|VF)\d|^F-\d/.test(code)) return { family: "FILLER", cornerSubGroup: null, cornerFunction: null, isPart };
  if (/panel|skin|end cab/.test(t) || /^(REP|BEP|WEP|TEP|DEP|PNL|EP|FEP|BPS|WPS|TPS)/.test(code)) return { family: "PANEL", cornerSubGroup: null, cornerFunction: null, isPart };
  if (/vanity|^v/.test(t) || /^(V|VSB|VDB|VB|VA)\d/.test(code)) return { family: "VANITY", cornerSubGroup: null, cornerFunction: null, isPart };
  if (placement === "tall" || /pantry|utility|oven cab/.test(t) || /^(U|T|PC|OC|UOC|TP)\d/.test(code)) return { family: "TALL", cornerSubGroup: null, cornerFunction: null, isPart };
  if (placement === "wall" || /^W/.test(code)) return { family: "WALL", cornerSubGroup: null, cornerFunction: null, isPart };
  if (placement === "base" || /^(B|SB|DB|\dDB|BT|BD|FHB|BFH|BBD)\d|^B-/.test(code)) return { family: "BASE", cornerSubGroup: null, cornerFunction: null, isPart };
  if (placement.startsWith("accessory")) return { family: "ACCESSORY", cornerSubGroup: null, cornerFunction: null, isPart: true };
  return { family: "UNKNOWN", cornerSubGroup: null, cornerFunction: null, isPart };
}

const EPS = 0.26;
const same = (a: number, b: number) => Math.abs(a - b) <= EPS;

function hingeKey(value: string | null): string {
  const v = (value ?? "").trim().toLowerCase();
  if (!v || v === "none") return "";
  if (v === "both" || v === "double") return "both";
  return v;
}

export function fractionInches(value: number): string {
  const rounded = Math.round(value * 8) / 8;
  const whole = Math.trunc(rounded);
  const frac = Math.abs(rounded - whole);
  const map: Record<string, string> = { "0.125": "1/8", "0.250": "1/4", "0.375": "3/8", "0.500": "1/2", "0.625": "5/8", "0.750": "3/4", "0.875": "7/8" };
  const f = frac ? (map[frac.toFixed(3)] ?? frac.toString()) : "";
  if (!whole) return f || "0";
  return f ? `${whole} ${f}` : `${whole}`;
}

export function alternativeDifferences(source: FamilySource, candidate: FamilyCandidate): string[] {
  const out: string[] = [];
  if (!same(source.width, candidate.width)) {
    const delta = source.width - candidate.width;
    if (delta > 0) {
      const each = delta / 2;
      out.push(`${fractionInches(delta)} in. narrower — add ${fractionInches(each)} in. filler each side`);
    } else {
      out.push(`${fractionInches(-delta)} in. wider — needs ${fractionInches(-delta)} in. more wall space`);
    }
  }
  if (!same(source.height, candidate.height)) {
    out.push(`${fractionInches(Math.abs(source.height - candidate.height))} in. ${candidate.height > source.height ? "taller" : "shorter"}`);
  }
  if (!same(source.depth, candidate.depth)) {
    out.push(`${fractionInches(Math.abs(source.depth - candidate.depth))} in. ${candidate.depth > source.depth ? "deeper" : "shallower"}`);
  }
  const sh = hingeKey(source.hingeSide);
  const ch = hingeKey(candidate.hingeSide);
  if (sh && ch && sh !== ch) out.push(`${ch} hinge instead of ${sh}`);
  if (source.numberOfDoors != null && candidate.numberOfDoors != null && source.numberOfDoors !== candidate.numberOfDoors) {
    out.push(`${candidate.numberOfDoors}-door front instead of ${source.numberOfDoors}-door`);
  }
  if (source.numberOfDrawers != null && candidate.numberOfDrawers != null && source.numberOfDrawers !== candidate.numberOfDrawers) {
    out.push(`${candidate.numberOfDrawers} drawers instead of ${source.numberOfDrawers}`);
  }
  const sf = nomenclatureFamilyFor(source);
  const cf = nomenclatureFamilyFor(candidate);
  if (sf.family === "CORNER" && cf.family === "CORNER" && sf.cornerFunction !== cf.cornerFunction) {
    out.push(`${cf.cornerFunction} corner instead of ${sf.cornerFunction}`);
  }
  return out;
}

export type RankedAlternative = FamilyCandidate & {
  customerPrice: number;
  score: number;
  differences: string[];
  sameWidth: boolean;
};

/**
 * Part 4 ranking order: same width -> same height/depth -> same hinge/opening
 * side -> (door style already fixed by the caller) -> closest function.
 * Lower score is better. Candidates outside the source family or sub-group,
 * loose parts, and unpriced rows are excluded.
 */
export function rankFamilyAlternatives(
  source: FamilySource,
  candidates: readonly (FamilyCandidate & { customerPrice: number })[],
  limit = 3,
): RankedAlternative[] {
  const sourceTag = nomenclatureFamilyFor(source);
  const sourceFn = sourceTag.cornerFunction;
  const ranked: RankedAlternative[] = [];
  for (const candidate of candidates) {
    if (!(candidate.customerPrice > 0)) continue;
    const tag = nomenclatureFamilyFor(candidate);
    if (tag.isPart) continue;
    if (tag.family !== sourceTag.family) continue;
    // A cabinet box (has doors and/or drawers) is never replaced by an open
    // part with neither — a valance or shelf is not a base cabinet.
    const sourceOpenings = (source.numberOfDoors ?? 0) + (source.numberOfDrawers ?? 0);
    const candidateOpenings = (candidate.numberOfDoors ?? 0) + (candidate.numberOfDrawers ?? 0);
    if (sourceOpenings > 0 && candidateOpenings === 0) continue;
    if (sourceTag.family === "CORNER" && tag.cornerSubGroup !== sourceTag.cornerSubGroup) continue;
    if (sourceTag.family !== "CORNER") {
      const sp = (source.placementType ?? "").toLowerCase();
      const cp = (candidate.placementType ?? "").toLowerCase();
      if (sp && cp && sp !== cp) continue;
    }
    const widthDelta = Math.abs(source.width - candidate.width);
    const sameW = same(source.width, candidate.width);
    const sameHD = same(source.height, candidate.height) && same(source.depth, candidate.depth);
    const sh = hingeKey(source.hingeSide);
    const ch = hingeKey(candidate.hingeSide);
    const sameHinge = !sh || !ch || sh === ch;
    const fnRank = sourceFn == null || tag.cornerFunction === sourceFn
      ? 0
      : (sourceFn === "carousel" && tag.cornerFunction === "easy-reach") || (sourceFn === "easy-reach" && tag.cornerFunction === "carousel")
      ? 1
      : (sourceFn === "diagonal" && tag.cornerFunction === "blind") || (sourceFn === "blind" && tag.cornerFunction === "diagonal")
      ? 2
      : 3;
    // Lexicographic tuple folded into one number.
    const score =
      (sameW ? 0 : 1_000_000 + Math.round(widthDelta * 8) * 1000)
      + (sameHD ? 0 : 100_000 + Math.round((Math.abs(source.height - candidate.height) + Math.abs(source.depth - candidate.depth)) * 8) * 10)
      + (sameHinge ? 0 : 10_000)
      + fnRank * 100
      + Math.min(99, Math.round(Math.abs(candidate.customerPrice) / 100));
    ranked.push({
      ...candidate,
      score,
      differences: alternativeDifferences(source, candidate),
      sameWidth: sameW,
    });
  }
  return ranked
    .sort((a, b) => a.score - b.score || a.masterCode.localeCompare(b.masterCode, undefined, { numeric: true }))
    .slice(0, limit);
}

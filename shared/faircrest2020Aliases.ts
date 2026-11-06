/**
 * Faircrest 2020 cabinet-code aliases.
 *
 * Faircrest (Clark and Son; the `FAIRC26A` / `FAIRC26B` package behind
 * `FAIRCREST_2020_GENERAL_REVIEW.md`) names cabinets its own way, and our
 * catalog + Designer use a second spelling of the same box. This module is the
 * one place that says "our code X is Faircrest code Y", so search, OCR/cart
 * lines, vendor sheets and exports never have to guess.
 *
 * Rules this module keeps:
 *   - Resolution only. It returns code strings. It never changes geometry,
 *     doors, shelves, rendering, Auto Design, price, availability or a catalog
 *     row, and no drawing rule imports it.
 *   - Both directions. `faircrest2020MasterCode("WEOS0930")` is "WOS0930";
 *     `faircrest2020OurCodes("WOS0930")` is every spelling of ours that names
 *     it. A code with no entry resolves to null, never to a guess.
 *   - Only mappings a source can be pointed at. Everything the review could not
 *     settle is in `FAIRCREST_2020_NEEDS_TOM` and is deliberately NOT
 *     resolvable, so an unknown code can never become a confident match.
 *   - Hand-split families stay honest. Faircrest sells many specialties as a
 *     left and a right (`WBC2730-L` / `WBC2730-R`, `LS3612-L` / `LS3612-R`)
 *     while our catalog keeps one unhanded row and picks the hand at
 *     placement. Those entries carry `hands`, so an export appends the hand
 *     instead of pretending one hand is the product.
 *
 * PR 290 (`cursor/wall-end-open-shelf-weos-5e5f`) owns what a WEOS *is* — box,
 * shelf count, radiused end (`client/src/lib/wallOpenShelf.ts`). It ships no
 * alias map, so this module is standalone and compatible: it never rewrites a
 * master code on a placed cabinet, it only answers "what does Faircrest call
 * this".
 */

export type Faircrest2020Family =
  | "wall-open-shelf"
  | "wall-angle-end"
  | "wall-easy-reach-corner"
  | "diagonal-corner-wall"
  | "lazy-susan-corner"
  | "pie-cut-corner"
  | "appliance-garage"
  | "tray-base"
  | "blind-corner-base"
  | "blind-corner-wall";

export type Faircrest2020Hand = "L" | "R";

export type Faircrest2020AliasEntry = {
  /** Our catalog / Designer code. */
  ourCode: string;
  /** Faircrest's base code. A hand, where Faircrest splits it, is never in here. */
  faircrestCode: string;
  family: Faircrest2020Family;
  /** Faircrest sells this family left and right; our row is unhanded. */
  hands?: readonly Faircrest2020Hand[];
  /** Why this mapping is safe to make automatically. */
  evidence: string;
};

const CONFIRMED: readonly Faircrest2020AliasEntry[] = [
  {
    ourCode: "WEOS0930",
    faircrestCode: "WOS0930",
    family: "wall-open-shelf",
    evidence:
      'Faircrest wall open shelves are WOS + width + height, so 9" W x 30" H is WOS0930. WEOS is our spelling of the wall-end variant and the review found no WEOS line in DFM_F_ items.txt.',
  },
  {
    ourCode: "WEOS0936",
    faircrestCode: "WOS0936",
    family: "wall-open-shelf",
    evidence: 'Same WOS width + height ladder: 9" W x 36" H.',
  },
  {
    ourCode: "WEOS0942",
    faircrestCode: "WOS0942",
    family: "wall-open-shelf",
    evidence: 'Same WOS width + height ladder: 9" W x 42" H.',
  },
  {
    ourCode: "WOES0930",
    faircrestCode: "WOS0930",
    family: "wall-open-shelf",
    evidence:
      "WOES is the transposed misspelling of WOS; the same 9 x 30 shelf.",
  },
  {
    ourCode: "WOES0936",
    faircrestCode: "WOS0936",
    family: "wall-open-shelf",
    evidence:
      "WOES is the transposed misspelling of WOS; the same 9 x 36 shelf.",
  },
  {
    ourCode: "WOES0942",
    faircrestCode: "WOS0942",
    family: "wall-open-shelf",
    evidence:
      "WOES is the transposed misspelling of WOS; the same 9 x 42 shelf.",
  },
  {
    ourCode: "AW1230",
    faircrestCode: "WAC1230",
    hands: ["L", "R"],
    family: "wall-angle-end",
    evidence:
      "Faircrest's doored wall angle end is WAC + width + height, sold L/R. client/src/lib/wallAngleEndLayout.ts already serves the WAC1230 / WAC1236 / WAC1242 drawings and names AW1230 / AW-12-30 as their alias.",
  },
  {
    ourCode: "AW1236",
    faircrestCode: "WAC1236",
    hands: ["L", "R"],
    family: "wall-angle-end",
    evidence:
      'Same ladder and the same shipped drawing as AW1230 (wallAngleEndLayout.ts lists WAC1236); 12" W x 36" H wall angle end with one door.',
  },
  {
    ourCode: "AW1242",
    faircrestCode: "WAC1242",
    hands: ["L", "R"],
    family: "wall-angle-end",
    evidence:
      'Same ladder and the same shipped drawing as AW1230 (wallAngleEndLayout.ts lists WAC1242); 12" W x 42" H wall angle end with one door.',
  },
  {
    ourCode: "LSB33",
    faircrestCode: "LS3312",
    hands: ["L", "R"],
    family: "lazy-susan-corner",
    evidence:
      'Faircrest lazy susan corner bases are LS + width + 12, sold L/R: pictures LS3312-L/R. Our LSB33 is the 33" lazy susan corner base and its own catalog description says the Faircrest build is the "pie-cut L-door" body.',
  },
  {
    ourCode: "LSB36",
    faircrestCode: "LS3612",
    hands: ["L", "R"],
    family: "lazy-susan-corner",
    evidence:
      'Faircrest pictures LS3612-L/R are the 36" pie-cut lazy susan corner base; our LSB36 is the same 36" lazy susan corner body. The review notes Faircrest has no "LS-36" string.',
  },
  {
    ourCode: "LS3612",
    faircrestCode: "LS3612",
    hands: ["L", "R"],
    family: "lazy-susan-corner",
    evidence:
      "Our own 36\" lazy susan corner code is already Faircrest's spelling (ls3612Replacement.ts); only the hand is missing, and Faircrest pictures LS3612-L/R.",
  },
  {
    ourCode: "LS36",
    faircrestCode: "LS3612",
    hands: ["L", "R"],
    family: "lazy-susan-corner",
    evidence:
      'LS36 / LS-36 is our Designer shorthand for the 36" lazy susan corner body, the same cabinet as LSB36 and LS3612 where a line spells it that way.',
  },
  {
    ourCode: "BER33",
    faircrestCode: "BER33",
    hands: ["L", "R"],
    family: "pie-cut-corner",
    evidence:
      'Faircrest pictures BER33-L/R are the 33" easy-reach pie-cut corner base; BER33 is already our own spelling, so only the hand is missing.',
  },
  {
    ourCode: "BER36",
    faircrestCode: "BER36",
    hands: ["L", "R"],
    family: "pie-cut-corner",
    evidence:
      'Faircrest pictures BER36-L/R are the 36" pie-cut / easy-reach corner base; BER36 is already our own spelling, so only the hand is missing.',
  },
  {
    ourCode: "ERB33",
    faircrestCode: "BER33",
    hands: ["L", "R"],
    family: "pie-cut-corner",
    evidence:
      'ERB33 is the other spelling of our 33" easy-reach pie-cut corner body; shared/codeEquivalence.ts already documents ERB -> BER as one cabinet across lines. Faircrest pictures BER33-L/R.',
  },
  {
    ourCode: "ERB36",
    faircrestCode: "BER36",
    hands: ["L", "R"],
    family: "pie-cut-corner",
    evidence:
      'shared/codeEquivalence.ts states it outright: "ERB36 (Skyline code) never reached BER36 (Madison code)". They are one cabinet, and Faircrest pictures BER36-L/R.',
  },
  {
    ourCode: "DCW2430",
    faircrestCode: "WDC2430",
    hands: ["L", "R"],
    family: "diagonal-corner-wall",
    evidence:
      "Faircrest pictures WDC2430-L/R (wall corner diagonal, single door on the hypotenuse); DCW is our spelling of the same family and shared/codeMatch.ts already carries WDC -> DCW as a prefix alias.",
  },
  {
    ourCode: "DCW2436",
    faircrestCode: "WDC2436",
    hands: ["L", "R"],
    family: "diagonal-corner-wall",
    evidence: 'Same WDC ladder: Faircrest pictures WDC2436-L/R; 24" W x 36" H.',
  },
  {
    ourCode: "DCW2442",
    faircrestCode: "WDC2442",
    hands: ["L", "R"],
    family: "diagonal-corner-wall",
    evidence: 'Same WDC ladder: Faircrest pictures WDC2442-L/R; 24" W x 42" H.',
  },
  {
    ourCode: "WER2430",
    faircrestCode: "WER2430",
    hands: ["L", "R"],
    family: "wall-easy-reach-corner",
    evidence:
      'Faircrest pictures WER2430-L/R (wall corner easy reach 90°) sit on the same code; 24" W x 30" H wall easy reach on both sides.',
  },
  {
    ourCode: "WER2436",
    faircrestCode: "WER2436",
    hands: ["L", "R"],
    family: "wall-easy-reach-corner",
    evidence:
      'Faircrest pictures WER2436-L/R; the same 24" W x 36" H wall easy reach.',
  },
  {
    ourCode: "WER2442",
    faircrestCode: "WER2442",
    hands: ["L", "R"],
    family: "wall-easy-reach-corner",
    evidence:
      'Faircrest pictures WER2442-L/R; the same 24" W x 42" H wall easy reach.',
  },
  {
    ourCode: "AG2418",
    faircrestCode: "AG2418",
    hands: ["L", "R"],
    family: "appliance-garage",
    evidence:
      "Faircrest pictures AG2418-L/R are the countertop tambour appliance garage; AG2418 is already our own spelling, so only the hand is missing. This is not a diagonal corner cabinet.",
  },
  {
    ourCode: "BT9",
    faircrestCode: "TB09",
    hands: ["L", "R"],
    family: "tray-base",
    evidence:
      'Faircrest tray bases are Tray Base + width, sold L/R, written TB9L/TB9R in the 20-20 list and TB09R/TB15L in the DFM_F_ items ladder. Our BT9 is the 9" tray base (DB alias cell already carries B9/BFH9/TB09/FH9-style spellings). The family is certain; which width spells which is the open piece (see needs Tom).',
  },
  {
    ourCode: "BBC36",
    faircrestCode: "BBC36",
    hands: ["L", "R"],
    family: "blind-corner-base",
    evidence:
      'Faircrest pictures BBC36-L/R; our unhanded BBC36 is the same 36" blind corner base and picks the blind side at placement.',
  },
  {
    ourCode: "WBC2730",
    faircrestCode: "WBC2730",
    hands: ["L", "R"],
    family: "blind-corner-wall",
    evidence:
      'Faircrest pictures WBC2730-L/R; our unhanded WBC2730 is the same 27" W x 30" H wall blind corner.',
  },
  {
    ourCode: "WBC2736",
    faircrestCode: "WBC2736",
    hands: ["L", "R"],
    family: "blind-corner-wall",
    evidence:
      'Faircrest pictures WBC2736-L/R; the same 27" W x 36" H wall blind corner.',
  },
  {
    ourCode: "WBC2742",
    faircrestCode: "WBC2742",
    hands: ["L", "R"],
    family: "blind-corner-wall",
    evidence:
      'Faircrest pictures WBC2742-L/R; the same 27" W x 42" H wall blind corner.',
  },
];

/**
 * Our wall open shelf spellings, resolved onto Faircrest's mechanical
 * WOS + width + height name. The review quotes the ladder (widths 09-30,
 * heights 24/30/36/42/48/54/60); a code outside it is refused, so a typo can
 * never invent a Faircrest SKU. KitchenCrest OE6## codes are DELIBERATELY not
 * here: the review calls that a different line book, not a Faircrest WOS.
 */
const OUR_WALL_OPEN_SHELF_PREFIXES = ["WEOS", "WOES"] as const;
const WOS_WIDTHS_IN = new Set([9, 10, 12, 15, 18, 21, 24, 27, 30]);
const WOS_HEIGHTS_IN = new Set([24, 30, 36, 42, 48, 54, 60]);

function wallOpenShelfFaircrestCode(compact: string): string | null {
  const prefix = OUR_WALL_OPEN_SHELF_PREFIXES.find((candidate) =>
    compact.startsWith(candidate),
  );
  if (!prefix) return null;
  const sizes = compact.slice(prefix.length);
  if (!/^\d{4}$/.test(sizes)) return null;
  const width = Number(sizes.slice(0, 2));
  const height = Number(sizes.slice(2));
  if (!WOS_WIDTHS_IN.has(width) || !WOS_HEIGHTS_IN.has(height)) return null;
  return `WOS${sizes}`;
}

/**
 * Mappings the review could not settle, or that one alias row cannot express.
 * None of these resolve. They exist so the next person sees the open question
 * instead of re-deriving it, and so a test can prove they stay inert. Tom
 * decides each one.
 */
export const FAIRCREST_2020_NEEDS_TOM: readonly {
  ourCode: string;
  faircrestCandidate: string;
  why: string;
  /**
   * True when the code mapping itself IS in the alias map and only a detail is
   * open. The alias resolves; the note is the open question.
   */
  codeMappingExists?: true;
}[] = [
  {
    ourCode: "BBC42",
    faircrestCandidate: "BCB42L / BCB42R",
    why: "Faircrest's 42\" blind base picture code is a rollout / swing-out box (BCB42), which our plain BBC42 is not. The template list also carries banded BBC1-48R codes with no published inch mapping.",
  },
  {
    ourCode: "BBC45",
    faircrestCandidate: "BCB45-HMSL / BCB45-HMSR",
    why: "BCB45 in the 20-20 list is a blind box with a half-moon swing-out. Unknown whether our plain BBC45 is that product or a banded BBC2-48R.",
  },
  {
    ourCode: "27-inch wall blind corner band",
    faircrestCandidate: "WBC2430L / WBC3630L",
    why: 'The 20-20 list also carries banded 24/27 and 33/36 wall blind corners. Only the WBC2730-WBC2742 picture codes are confirmed; which band a 27" box falls in on a Faircrest order is open.',
  },
  {
    ourCode: "LSB33 / LSB36 (the 12)",
    faircrestCandidate: "LS3312 / LS3612",
    codeMappingExists: true,
    why: 'The code mapping is added, but what the "12" in LS3612 means is undocumented in the package: leg return, back depth, or something else. No geometry reads this alias; confirm before anyone treats it as an inch value. A "needs Tom" number, not a "needs Tom" code.',
  },
  {
    ourCode: "ER36",
    faircrestCandidate: "BER36",
    why: "ER36 and BER36 are interchangeable shelf-corner bodies of ours (ls3612Replacement.ts), but nothing in the package proves our ER36 IS Faircrest BER36 rather than a second line's code. Left unmapped on purpose.",
  },
  {
    ourCode: "CSB36",
    faircrestCandidate: "DCSB36-L / DCSB36-R",
    why: 'Our 36" corner sink base is stored as diagonal, yet Faircrest also lists DSB33R (Sink Base Corner Diagonal) and BCS33-FHD (Corner Sink Easy Reach). Which Faircrest sink corner our CSB36 is cannot be settled from the code alone.',
  },
  {
    ourCode: "BMC27 / MB30 / BMC30 / BMW30",
    faircrestCandidate: "BM27 / BMC271DWR",
    why: 'Faircrest has one 27" base microwave (BM27) plus a drawer variant. Several of our base-microwave codes may collapse onto those two; the drawer count decides it and is not published per code.',
  },
  {
    ourCode: "BSR9 / BSR12 / BSP6 / BSD6",
    faircrestCandidate: "BSR9 / BSR12 / BSP6 / DS1-DS3",
    why: "Faircrest pictures BSR9/BSR12 (narrow spice) and lists BSP6 as a base spice drawer plus DS1-DS3 door spice. Our BSD6 is a 5-drawer spice cabinet, our BSP6 is a pull-out base, and BT9 already claims BSR9 as an alias. Overlapping evidence, no single answer.",
  },
  {
    ourCode: "TB9 / TB15 width ladder",
    faircrestCandidate: "TB09L/R through TB15L/R",
    why: 'BT9 -> TB09 is added. Which of our tray widths map to Faircrest TB09/TB12/TB15, and whether a 9" tray base can also be written TB9, is not documented per width.',
  },
  {
    ourCode: "WRC3015",
    faircrestCandidate: "LWR3015",
    why: "Faircrest's 30x15 lattice picture is LWR3015 and our own LWR3015 row already carries that code. docs/sql/0230 deliberately removed the WRC3015 -> LWR3015 alias so Skyline's WRC3015 stays its own priced master; re-adding it would undo that decision.",
  },
  {
    ourCode: "WRC3018 / LWR3018 / WWC630 / WXR3018",
    faircrestCandidate: "WR18 / WR24 / WR30, WR3315 / WR3612-WR3624",
    why: "Faircrest uses two wine schemes in one package: add-on widths WR18/24/30 and picture SKUs WR33##/WR36##. They are not interchangeable and neither matches our WRC/WWC/WXR widths one-for-one.",
  },
  {
    ourCode: "LZS33 / LZS3612",
    faircrestCandidate: "(none found)",
    why: "Both appear in cabinet_code_mismatches.csv as 'DL SKU not found in 20-20 list'. LZS is not decodable from any file in the repository and no LZS row exists in our fixtures.",
  },
  {
    ourCode: "SP09 / SP2436",
    faircrestCandidate: "(none found)",
    why: "Unknown DL specialty codes with no 20-20 match and no description in the repo. Not enough to place them in a Faircrest family.",
  },
  {
    ourCode: "MW3030 / MW3036 / MW3042 / MW2436 / MWD2448",
    faircrestCandidate:
      "MW3030 / MW3036 / MW3042 (pictures), MW2436-MW3636 (template)",
    why: "Faircrest's template list and its picture set use two microwave schemes. Our catalog already sells MW3030/3036/3042, which ARE Faircrest's picture codes, so nothing needs adding for those. The template widths (MW2436 / MWD2448 ...) need the actual package to map.",
  },
  {
    ourCode: "ESR1 / WAS12##",
    faircrestCandidate: "WAS1224-WAS1260, WAC12##-GL",
    why: "ESR1 is a spec variable (end shelf radius), not a cabinet code, and Faircrest's wall angle shelf is WAS (open) vs WAC (doored). We sell no WAS/ESR1 SKU, so there is nothing of ours to alias yet.",
  },
];

function compact(value: string | null | undefined): string {
  return `${value ?? ""}`
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Strip one trailing hand from a compact code, and only when it follows a digit
 * or matches an explicit -L/-R style suffix. A code that merely ends in a letter
 * (BES, LS) is never truncated.
 */
function withoutHand(compactCode: string): string {
  return compactCode.replace(/^(.*\d)(?:LH|RH|L|R)$/, "$1");
}

/** Uppercase, punctuation-free form used for every comparison in this module. */
export function faircrest2020CodeKey(value: string | null | undefined): string {
  return compact(value);
}

const BY_OUR_CODE = new Map<string, Faircrest2020AliasEntry>();
const BY_FAIRCREST_CODE = new Map<string, Faircrest2020AliasEntry>();

for (const entry of CONFIRMED) {
  const ourKey = compact(entry.ourCode);
  if (!ourKey) continue;
  if (!BY_OUR_CODE.has(ourKey)) BY_OUR_CODE.set(ourKey, entry);
  const faircrestKey = compact(entry.faircrestCode);
  if (!BY_FAIRCREST_CODE.has(faircrestKey))
    BY_FAIRCREST_CODE.set(faircrestKey, entry);
}

/** Every hand-free mapping, for docs, SQL generation and admin views. */
export const FAIRCREST_2020_ALIASES: readonly Faircrest2020AliasEntry[] =
  CONFIRMED;

/**
 * Catalog search asks for the equivalent codes of every row on every keystroke,
 * so the answer is memoized. The mapping is static data; nothing mutates it.
 */
const EQUIVALENT_CODES_CACHE = new Map<string, string[]>();

/** The Faircrest spellings of one base code, hand included (WBC2730 -> L, R). */
export function faircrest2020HandCodes(
  faircrestCode: string,
  hands: readonly Faircrest2020Hand[] | undefined,
): string[] {
  if (!hands || hands.length === 0) return [];
  const base = `${faircrestCode ?? ""}`.trim().toUpperCase();
  return hands.map((hand) => `${base}${hand}`);
}

export type Faircrest2020Alias = {
  ourCode: string;
  /** Faircrest's base code, without a hand. */
  faircrestCode: string;
  /** Every Faircrest spelling that sells this cabinet (base + L/R when split). */
  faircrestCodes: string[];
  hands: Faircrest2020Hand[];
  family: Faircrest2020Family;
  evidence: string;
};

function aliasOf(entry: Faircrest2020AliasEntry): Faircrest2020Alias {
  const hands = [...(entry.hands ?? [])];
  return {
    ourCode: entry.ourCode,
    faircrestCode: entry.faircrestCode,
    faircrestCodes: [
      entry.faircrestCode,
      ...faircrest2020HandCodes(entry.faircrestCode, hands),
    ],
    hands,
    family: entry.family,
    evidence: entry.evidence,
  };
}

function wallOpenShelfAlias(
  code: string | null | undefined,
): Faircrest2020Alias | null {
  const faircrestCode = wallOpenShelfFaircrestCode(compact(code));
  if (!faircrestCode) return null;
  return {
    ourCode: `${code ?? ""}`.trim().toUpperCase(),
    faircrestCode,
    faircrestCodes: [faircrestCode],
    hands: [],
    family: "wall-open-shelf",
    evidence:
      "Faircrest wall open shelves are WOS + width + height across widths 09-30 and heights 24-60. WEOS / WOES are our spellings of the same SKU.",
  };
}

/**
 * The Faircrest mapping for one of our codes, or null when we have no confident
 * mapping. A handed spelling of either side (`BBC36-R`, `WAC1230L`) resolves
 * through its base, because a hand is not a different cabinet.
 */
export function faircrest2020AliasFor(
  ourCode: string | null | undefined,
): Faircrest2020Alias | null {
  const ourKey = compact(ourCode);
  if (!ourKey) return null;

  const direct = BY_OUR_CODE.get(ourKey);
  if (direct) return aliasOf(direct);

  const base = withoutHand(ourKey);
  if (base !== ourKey) {
    const viaOurBase = BY_OUR_CODE.get(base);
    if (viaOurBase) return aliasOf(viaOurBase);
  }

  const patternAlias =
    wallOpenShelfAlias(ourCode) ??
    (base !== ourKey ? wallOpenShelfAlias(base) : null);
  if (patternAlias) return patternAlias;

  // The caller handed us Faircrest's own spelling (WAC1230L, WBC2736-R, WOS1230).
  const faircrestKey = withoutHand(ourKey);
  const byFaircrest = BY_FAIRCREST_CODE.get(faircrestKey);
  if (byFaircrest) return aliasOf(byFaircrest);
  return null;
}

/** Faircrest's base code for one of our codes, or null. */
export function faircrest2020MasterCode(
  ourCode: string | null | undefined,
): string | null {
  return faircrest2020AliasFor(ourCode)?.faircrestCode ?? null;
}

/** Every Faircrest code (base and hands) for one of our codes. */
export function faircrest2020MasterCodes(
  ourCode: string | null | undefined,
): string[] {
  return faircrest2020AliasFor(ourCode)?.faircrestCodes ?? [];
}

/**
 * Our spellings that name one Faircrest code, so a Faircrest order, drawing or
 * spreadsheet can be matched to a catalog row. Handed Faircrest spellings
 * (`LS3612-L`, `WBC2736-R`) resolve through the base.
 *
 * Returns confirmed table rows plus the mechanical WOS ladder spelling — it
 * only ever names a code, never creates a cabinet. Nothing here resolves to a
 * catalog row unless that row already exists.
 */
export function faircrest2020OurCodes(
  faircrestCode: string | null | undefined,
): string[] {
  const faircrestKey = withoutHand(compact(faircrestCode));
  if (!faircrestKey) return [];
  const out = new Set<string>();
  for (const entry of CONFIRMED) {
    if (compact(entry.faircrestCode) === faircrestKey) out.add(entry.ourCode);
    if (wallOpenShelfFaircrestCode(compact(entry.ourCode)) === faircrestKey)
      out.add(entry.ourCode);
  }
  // Faircrest's WOS ladder is mechanical on our side too: WOS1230 is WEOS1230 /
  // WOES1230 here. This names a spelling, not a cabinet - nothing resolves
  // until a catalog row actually carries it.
  for (const spelling of wallOpenShelfOurSpellings(faircrestKey))
    out.add(spelling);
  return Array.from(out).sort();
}

/**
 * Wall open shelf spellings of ours for a Faircrest WOS code, across the whole
 * published ladder. Search-only: a spelling here matches nothing unless the
 * catalog actually has that row.
 */
function wallOpenShelfOurSpellings(
  faircrestCode: string | null | undefined,
): string[] {
  const faircrestKey = withoutHand(compact(faircrestCode));
  if (!/^WOS\d{4}$/.test(faircrestKey)) return [];
  const sizes = faircrestKey.slice(3);
  const width = Number(sizes.slice(0, 2));
  const height = Number(sizes.slice(2));
  if (!WOS_WIDTHS_IN.has(width) || !WOS_HEIGHTS_IN.has(height)) return [];
  return OUR_WALL_OPEN_SHELF_PREFIXES.map((prefix) => `${prefix}${sizes}`);
}

/**
 * Every spelling of one cabinet: our codes and Faircrest's, handed forms
 * included. Search calls this so either spelling finds the row.
 */
export function faircrest2020EquivalentCodes(
  code: string | null | undefined,
): string[] {
  const trimmed = `${code ?? ""}`.trim();
  if (!compact(trimmed)) return [];
  const cached = EQUIVALENT_CODES_CACHE.get(trimmed.toUpperCase());
  if (cached) return cached;
  const out = new Set<string>([trimmed]);
  const alias = faircrest2020AliasFor(code);
  if (alias) {
    out.add(alias.ourCode);
    for (const faircrestCode of alias.faircrestCodes) out.add(faircrestCode);
    // Every other spelling of ours that names the same Faircrest cabinet, so
    // WEOS0930 and WOES0930 are each other's result.
    for (const ourCode of faircrest2020OurCodes(alias.faircrestCode))
      out.add(ourCode);
  }
  for (const ourCode of faircrest2020OurCodes(code)) {
    out.add(ourCode);
    for (const faircrestCode of faircrest2020MasterCodes(ourCode))
      out.add(faircrestCode);
  }
  // Faircrest's own WOS spelling of a shelf we have no table row for: offer the
  // ladder spellings so an existing catalog row can still be found.
  for (const ourCode of wallOpenShelfOurSpellings(code)) {
    out.add(ourCode);
    for (const faircrestCode of faircrest2020MasterCodes(ourCode))
      out.add(faircrestCode);
  }
  const resolved = Array.from(out).filter(Boolean).sort();
  EQUIVALENT_CODES_CACHE.set(trimmed.toUpperCase(), resolved);
  return resolved;
}

/** True when the code has a Faircrest mapping in either direction. */
export function hasFaircrest2020Alias(
  code: string | null | undefined,
): boolean {
  return (
    faircrest2020AliasFor(code) != null ||
    faircrest2020OurCodes(code).length > 0
  );
}

/** True when two codes name the same cabinet, in either direction. */
export function faircrest2020SameCabinet(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ak = compact(a);
  const bk = compact(b);
  if (!ak || !bk) return false;
  if (ak === bk) return true;
  const aEquivalents = new Set(faircrest2020EquivalentCodes(a).map(compact));
  if (aEquivalents.has(bk)) return true;
  const bEquivalents = new Set(faircrest2020EquivalentCodes(b).map(compact));
  return bEquivalents.has(ak);
}

/**
 * Resolve one raw Faircrest-or-ours code against a catalog.
 *
 * An exact master-code match always wins — that row keeps its identity, and the
 * alias layer never re-points it. Otherwise the unique row that sells an
 * equivalent spelling is returned. `null` means either "no mapping" or "two rows
 * could be meant"; ambiguity is never guessed, the same rule `matchCode` uses.
 */
export function resolveFaircrest2020CatalogCode<
  T extends { masterCode?: string | null },
>(rawCode: string | null | undefined, catalog: readonly T[]): T | null {
  const rawKey = compact(rawCode);
  if (!rawKey) return null;
  const exact = catalog.filter((row) => compact(row.masterCode) === rawKey);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const candidates = faircrest2020EquivalentCodes(rawCode).map(compact);
  if (candidates.length === 0) return null;
  const hits: T[] = [];
  for (const row of catalog) {
    if (candidates.includes(compact(row.masterCode))) hits.push(row);
  }
  return hits.length === 1 ? hits[0] : null;
}

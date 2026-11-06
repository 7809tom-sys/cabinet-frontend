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
 *   - No interactive pull-out. The app does not open a door, slide a unit out,
 *     or animate one. Pull-out codes (SPO9, BT9PO, and any Faircrest pullout
 *     naming) are aliases and descriptions only: each draws as a static
 *     cabinet, exactly like the box it looks like from the front. Nothing here
 *     carries a mechanism flag, an open state, or animation metadata.
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
  | "corner-sink-base"
  | "appliance-garage"
  | "base-microwave"
  | "full-height-base-9"
  | "tray-base"
  | "wall-wine-rack"
  | "spice-pullout"
  | "blind-corner-base"
  | "blind-corner-wall";

export type Faircrest2020Hand = "L" | "R";

/**
 * The blind corner families (blind-corner-base, blind-corner-wall).
 *
 * Note only — this PR is aliases and descriptions, and changes no geometry, no
 * filler logic and no Auto Design behaviour.
 *
 * Every blind corner cabinet is a STRAIGHT cabinet: the box is rectangular, with
 * no angled or L-shaped footprint, whatever the code or the Faircrest picture
 * suggests. The run closes with a 3-inch filler on the opposite side of the
 * blind. That is the standard blind-corner treatment and it is the same for
 * every blind code here (BBC36, BBC45, WBC273x). The alias layer only decides
 * which Faircrest code names the cabinet; it never decides how the box is drawn.
 */
export const FAIRCREST_2020_BLIND_CORNER_NOTE =
  "Blind corner cabinets are straight cabinets. A 3-inch filler goes on the opposite side; this is standard for blind corners." as const;

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
    ourCode: "LZS33",
    faircrestCode: "LS3312",
    hands: ["L", "R"],
    family: "lazy-susan-corner",
    evidence:
      'Tom confirmed LZS = Lazy Susan, so LZS33 is the 33" lazy susan corner base and resolves to Faircrest LS3312 exactly like our LSB33 does. LZS only appears in cabinet_code_mismatches.csv as "DL SKU not found in 20-20 list", so this follows Tom\'s decision rather than a file match.',
  },
  {
    ourCode: "LZS3612",
    faircrestCode: "LS3612",
    hands: ["L", "R"],
    family: "lazy-susan-corner",
    evidence:
      'Tom confirmed LZS = Lazy Susan, so LZS3612 is the 36" lazy susan corner base and resolves to Faircrest LS3612, the same code our LS3612 / LSB36 rows use. The 12" door height is standard across the family.',
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
      "Tom confirmed: LS3612 = Lazy Susan 36. The 12\" door height is standard across the Lazy Susan family, not a unique attribute of LS3612. It is Faircrest's own code, so our row of that name resolves to itself and only the hand is missing; Faircrest pictures LS3612-L/R.",
  },
  {
    ourCode: "LS36",
    faircrestCode: "LS3612",
    hands: ["L", "R"],
    family: "lazy-susan-corner",
    evidence:
      'Tom confirmed: LS36 is the same cabinet as LS3612 — the same Lazy Susan 36, just written without the 12" door-front callout. Both are our spelling of the one 36" lazy susan corner body, so the mapping is unchanged.',
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
    ourCode: "ER36",
    faircrestCode: "BER36",
    hands: ["L", "R"],
    family: "pie-cut-corner",
    evidence:
      'Tom resolved this one: the Easy-Reach 36 base — written ER36, "ER 36" or "ER-36" — is Faircrest BER36. It shares the body our BER36 / ERB36 rows already sell (ls3612Replacement.ts pairs them), and Faircrest pictures BER36-L/R.',
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
    ourCode: "ER2430",
    faircrestCode: "WER2430",
    hands: ["L", "R"],
    family: "wall-easy-reach-corner",
    evidence:
      'Tom confirmed: Faircrest WER = Wall Easy Reach, 24" wide, sold L/R. ER2430 is our short spelling of the same 24" W x 30" H wall easy reach, on the same pattern as ERB -> BER.',
  },
  {
    ourCode: "ER2436",
    faircrestCode: "WER2436",
    hands: ["L", "R"],
    family: "wall-easy-reach-corner",
    evidence:
      'Tom confirmed: ER2436 is Faircrest WER2436, the 24" W x 36" H wall easy reach, on the same ER -> WER pattern.',
  },
  {
    ourCode: "ER2442",
    faircrestCode: "WER2442",
    hands: ["L", "R"],
    family: "wall-easy-reach-corner",
    evidence:
      'Tom confirmed: ER2442 is Faircrest WER2442, the 24" W x 42" H wall easy reach, on the same ER -> WER pattern.',
  },
  {
    ourCode: "ERW2430",
    faircrestCode: "WER2430",
    hands: ["L", "R"],
    family: "wall-easy-reach-corner",
    evidence:
      'Tom confirmed: ERW2430 is the transposed spelling of Faircrest WER2430 (Easy-Reach Wall, 24" W x 30" H), same cabinet as our WER2430 / ER2430.',
  },
  {
    ourCode: "ERW2436",
    faircrestCode: "WER2436",
    hands: ["L", "R"],
    family: "wall-easy-reach-corner",
    evidence:
      'Tom confirmed: ERW2436 is the transposed spelling of Faircrest WER2436, the 24" W x 36" H wall easy reach.',
  },
  {
    ourCode: "ERW2442",
    faircrestCode: "WER2442",
    hands: ["L", "R"],
    family: "wall-easy-reach-corner",
    evidence:
      'Tom confirmed: ERW2442 is the transposed spelling of Faircrest WER2442, the 24" W x 42" H wall easy reach.',
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
    family: "full-height-base-9",
    evidence:
      "Tom resolved this family: BFH9, B9FH, BT9FH, BT9, BT09, TB9 and TB09 are ALL the same full-height base 9, whatever the nomenclature. Faircrest writes it TB09-L / TB09-R, so every spelling resolves to TB09 with the hand preserved. BT9PO (spice-rack pull-out) is a different cabinet and stays out.",
  },
  {
    ourCode: "BT09",
    faircrestCode: "TB09",
    hands: ["L", "R"],
    family: "full-height-base-9",
    evidence:
      "Zero-padded spelling of BT9; the same full-height base 9, so the same Faircrest TB09-L/TB09-R.",
  },
  {
    ourCode: "TB9",
    faircrestCode: "TB09",
    hands: ["L", "R"],
    family: "full-height-base-9",
    evidence:
      "Tray Base 9 spelling of the same full-height base 9; Faircrest's zero-padded TB09-L/TB09-R.",
  },
  {
    ourCode: "BFH9",
    faircrestCode: "TB09",
    hands: ["L", "R"],
    family: "full-height-base-9",
    evidence:
      "BFH9 (Base Full Height 9) is a full-height spelling of the same base 9; Tom confirmed it is the same cabinet as TB09-L/TB09-R.",
  },
  {
    ourCode: "B9FH",
    faircrestCode: "TB09",
    hands: ["L", "R"],
    family: "full-height-base-9",
    evidence:
      "B9FH is BFH9 with the tokens transposed: the same full-height base 9, so the same Faircrest TB09-L/TB09-R.",
  },
  {
    ourCode: "BT9FH",
    faircrestCode: "TB09",
    hands: ["L", "R"],
    family: "full-height-base-9",
    evidence:
      "BT9FH is the full-height spelling of B(T)9. Tom confirmed it is the same cabinet as TB09-L/TB09-R; the catalog carries it as its own row on a different line, and this alias never merges that row.",
  },
  {
    ourCode: "BBC36",
    faircrestCode: "BBC36",
    hands: ["L", "R"],
    family: "blind-corner-base",
    evidence:
      'Faircrest pictures BBC36-L/R; our unhanded BBC36 is the same 36" blind corner base and picks the blind side at placement. Blind corners are straight cabinets: the box itself has no angle, and the run closes with a 3-inch filler on the opposite side. That is standard for blind corners and does not change per code.',
  },
  {
    ourCode: "BBC45",
    faircrestCode: "BCB45-HMS",
    hands: ["L", "R"],
    family: "blind-corner-base",
    evidence:
      "Tom confirmed: our BBC45 IS Faircrest's 45\" blind corner box with the half-moon swing-out. Faircrest splits it by hand, so BCB45-HMS + L/R resolves as BCB45-HMSL (left) and BCB45-HMSR (right). The banded BBC2-48R template codes are a different box and are deliberately not mapped. Like every blind corner it is a straight cabinet: the run closes with a 3-inch filler on the opposite side.",
  },
  {
    ourCode: "CSB36",
    faircrestCode: "DCSB36",
    hands: ["L", "R"],
    family: "corner-sink-base",
    evidence:
      "Tom decided: CSB36 is Faircrest DCSB36, the 36\" diagonal corner sink base, split by hand as DCSB36-L / DCSB36-R. Corner sink bases are the same cabinet across all distributors, so the code only changes spelling between lines. DCSB36 does not appear in the extractable 20-20 list — this follows Tom's decision, not a file match. DSB33R (Sink Base Corner Diagonal) and BCS33-FHD (Corner Sink Easy Reach) are different cabinets and are deliberately not mapped.",
  },
  {
    ourCode: "BMC27",
    faircrestCode: "BMC27",
    family: "base-microwave",
    evidence:
      'Tom decided: BMC27, MB30, BMC30 and BMW30 are the same base microwave cabinet, differing only in width (27 or 30). Faircrest\'s own package (FAIRC26A/B kit14rec.dat) carries BMC27 and BMC30 as "27"/30" Base Microwave Cabinet" on template BMC#W#H#D, so 27" resolves to its own code. All base microwaves carry a drawer at the bottom as standard, which is why BMC271DWR is the same 27" cabinet with that standard drawer spelled out.',
  },
  {
    ourCode: "BM27",
    faircrestCode: "BMC27",
    family: "base-microwave",
    evidence:
      'Faircrest\'s 20-20 list names the 27" base microwave BM27 and the package also carries BMC27; they are one 27" base microwave cabinet, so BM27 and BMC27 resolve to each other. Same standard bottom drawer.',
  },
  {
    ourCode: "BMC271DWR",
    faircrestCode: "BMC27",
    family: "base-microwave",
    evidence:
      'BMC271DWR is the 27" base microwave with its (standard) drawer spelled out, not a different cabinet. Every base microwave has that bottom drawer, so it resolves with BMC27.',
  },
  {
    ourCode: "BMC30",
    faircrestCode: "BMC30",
    family: "base-microwave",
    evidence:
      'Faircrest\'s package carries BMC30 as the 30" Base Microwave Cabinet (template BMC#W#H#D), so the 30" body resolves to its own code. Same standard bottom drawer.',
  },
  {
    ourCode: "MB30",
    faircrestCode: "BMC30",
    family: "base-microwave",
    evidence:
      'MB30 is our spelling of the 30" base microwave; Tom confirmed it is the same cabinet as BMC30, so it resolves there. Same standard bottom drawer.',
  },
  {
    ourCode: "BMW30",
    faircrestCode: "BMC30",
    family: "base-microwave",
    evidence:
      'BMW30 is our spelling of the 30" base microwave; Tom confirmed it is the same cabinet as BMC30, so it resolves there. Same standard bottom drawer.',
  },
  {
    ourCode: "BT12",
    faircrestCode: "TB12",
    hands: ["L", "R"],
    family: "tray-base",
    evidence:
      "Tom decided: our 12\" tray base is Faircrest TB12, sold by hand as TB12L / TB12R. A tray base has a tray/divider in the middle. The tray base image is the same whether it is the standard base or the full-height version; which one applies depends on the option the customer picked in the designer. For reference, U.S. Cabinet Depot's tray base image shows the tray inside. For the record, TB12 is not in the extractable 20-20 list (which carries TB9L/TB9R plus the TD09 tray dividers), so this follows Tom's decision rather than a file match.",
  },
  {
    ourCode: "BT15",
    faircrestCode: "TB15",
    hands: ["L", "R"],
    family: "tray-base",
    evidence:
      "Tom decided: our 15\" tray base is Faircrest TB15, sold by hand as TB15L / TB15R. A tray base has a tray/divider in the middle. The tray base image is the same whether it is the standard base or the full-height version; which one applies depends on the option the customer picked in the designer (U.S. Cabinet Depot's tray base image shows the tray inside). TB15 is not in the extractable 20-20 list either, so this follows Tom's decision rather than a file match.",
  },
  {
    ourCode: "BSR12",
    faircrestCode: "BSR12",
    family: "spice-pullout",
    evidence:
      'Tom decided: BSR12 is the 12" spice pull-out base, and Faircrest\'s own package (FAIRC26B kit14rec.dat) lists BSR12 as "Base Spice Rack" at 12". The codes already match, so this records the pairing rather than inventing one. Not handed. BSD6 is the same cabinet and maps to the same Faircrest code.',
  },
  {
    ourCode: "BSD6",
    faircrestCode: "BSD6",
    family: "spice-pullout",
    evidence:
      'Tom decided: our BSD6 (5-drawer spice cabinet) is Faircrest BSD6, "Base Spice Drawer". The codes already match, so this records the pairing rather than inventing one. Not handed. BSP6 is the same cabinet and maps here too; SP09 remains open.',
  },
  {
    ourCode: "BSP6",
    faircrestCode: "BSD6",
    family: "spice-pullout",
    evidence:
      'Tom decided: BSP6 = 6" spice cabinet with five drawers, the SAME cabinet as BSD6. It therefore resolves to Faircrest BSD6, the 6" Base Spice Drawer Cabinet, exactly as our BSD6 row does. The two of our codes name one cabinet, so neither is retired here — the alias only answers which Faircrest code names it. Not handed. SP09 remains open.',
  },
  {
    ourCode: "BSR9",
    faircrestCode: "BSR9",
    family: "spice-pullout",
    evidence:
      'Tom: BSR9 is a 9" base spice rack / spice pull-out — same look as a BT9 but with a pull-out, and "S" means spice (only "T" means tray). It is therefore NOT a tray base and must never resolve to BT9. Faircrest\'s code is BSR9, so it maps there. Not handed. Our software has no interactive pull-out, so BSR9 draws as a static cabinet. Note for the record: main\'s test fixtures used to list BSR9 inside BT9\'s alias cell; that list is corrected in this PR. SP09 (9" spice pull-out, every supplier) would also point at Faircrest BSR9 once Tom confirms it, and stays unmapped until then.',
  },
  {
    ourCode: "WRC3015",
    faircrestCode: "LWR3015",
    family: "wall-wine-rack",
    evidence:
      "Tom decided (reversing the old hold): WRC3015 aliases to Faircrest LWR3015, the same 30 x 15 lattice wall wine rack family. This is the CODE-LEVEL Faircrest lookup only. Our master code still reads WRC3015 — the catalog row, the master code on placed cabinets and every quote keep WRC3015, and nothing is written to sku_master_aliases or retired. docs/sql/0230 removed a DATABASE retirement for this pair; that decision stands and is untouched, because this alias never reaches the database.",
  },
  {
    ourCode: "WBC2730",
    faircrestCode: "WBC2430",
    hands: ["L", "R"],
    family: "blind-corner-wall",
    evidence:
      'Tom decided: our 27" wall blind corners belong to Faircrest\'s 24/27 band. WBC2730 -> WBC2430, split by hand as WBC2430L / WBC2430R. WBC2430L/R does appear in the 20-20 list ("Wall Blind Corner 1 Door"). As with every blind corner it is a straight cabinet, closed with a 3-inch filler on the opposite side.',
  },
  {
    ourCode: "WBC2736",
    faircrestCode: "WBC2436",
    hands: ["L", "R"],
    family: "blind-corner-wall",
    evidence:
      "Tom decided: WBC2736 -> WBC2436 on the 24/27 band, split by hand as WBC2436L / WBC2436R. Note for the record: Faircrest's package only carries WBC2430 and WBC3630 in the 20-20 list, so WBC2436 is not present in the extractable files — the mapping follows Tom's decision, not a file match. As with every blind corner it is a straight cabinet, closed with a 3-inch filler on the opposite side.",
  },
  {
    ourCode: "WBC2742",
    faircrestCode: "WBC2442",
    hands: ["L", "R"],
    family: "blind-corner-wall",
    evidence:
      "Tom decided: WBC2742 -> WBC2442 on the 24/27 band, split by hand as WBC2442L / WBC2442R. Note for the record: WBC2442 does not appear in Faircrest's package files (only WBC2430 and WBC3630 are listed), so this follows Tom's decision rather than a file match. As with every blind corner it is a straight cabinet, closed with a 3-inch filler on the opposite side.",
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
 * Codes that are deliberately NOT aliases of anything, recorded so nobody
 * "helpfully" folds them into a neighbouring family later.
 *
 * These are not open questions (that is `FAIRCREST_2020_NEEDS_TOM`); they are
 * settled decisions. Each one resolves to nothing, on purpose.
 */
export const FAIRCREST_2020_DISTINCT_CODES: readonly {
  ourCode: string;
  /** The cabinet it is often confused with, and why it is not that cabinet. */
  looksLike: string;
  why: string;
}[] = [
  {
    ourCode: "BBC42",
    looksLike: "BBC36 / BCB42L / BCB42R",
    why: 'Tom decided: Faircrest does NOT have a 42" blind corner. BBC42 therefore has no Faircrest match and must never resolve to any Faircrest code — not B42, not BCB42L/BCB42R (Faircrest\'s 42" blind picture is a rollout / swing-out box, a different cabinet), and not the banded BBC1-48R template codes. BBC42 (base blind corner) and B42 (standard base) are two different cabinets used in different areas and must never be merged or aliased in either direction. Our side is unambiguous, though: when a catalog entry\'s code or nomenclature says BBC42, the name itself defines the cabinet as a base blind corner, 42" wide. Treat it as a blind corner by name — the missing Faircrest code does not make it some other kind of box, and "what does Faircrest call this" is honestly answered "nothing".',
  },
  {
    ourCode: "SPO9",
    looksLike: "BT9 / BT9PO",
    why: "SPO9 = Spice Pullout 9: the whole unit pulls out and carries three spice shelves. Tom confirmed it is its own code, NOT an alias of BT9PO, so it is never mapped here and no Faircrest spice-unit code (B9-SP, BSP6) is mapped to BT9PO either. From the front SPO9 looks the same as a BT9 — same picture, same appearance; the difference is only the code and the description, not the look. Because the look is identical, folding it into BT9 or BT9PO would be invisible in the Designer and wrong on the order. Our software has no interactive pull-out, so SPO9 draws as a static cabinet that looks like a BT9 and nothing animates or opens.",
  },
  {
    ourCode: "BT9PO",
    looksLike: "BT9 / TB09",
    why: 'BT9PO is its own 9" pull-out base (catalog row id 10110001, subCategory "Pull-Out"). It is never folded into BT09/TB09, which is the plain full-height base 9. The PO-suffix rule Tom gave applies only to regular base-9 pullouts; a 9" spice unit is SPO9, not BT9PO. No interactive pull-out either: BT9PO draws as a static cabinet.',
  },
];

/**
 * Cabinet conflict list — needs research.
 *
 * Separate from `FAIRCREST_2020_NEEDS_TOM`, which holds questions Tom can answer
 * from his own product knowledge. These are codes that conflict or are opaque at
 * the DATA level: the code cannot be decoded, no source in the repo describes it,
 * and no Faircrest candidate can even be proposed. They stay unmapped forever
 * until real research (a price list, a spec sheet, the manufacturer) settles
 * them, and they must never be guessed.
 */
export const FAIRCREST_2020_NEEDS_RESEARCH: readonly {
  ourCode: string;
  /** What is known, and where the code shows up. */
  known: string;
  /** What would settle it. */
  needs: string;
}[] = [
  {
    ourCode: "SP2436",
    known:
      'Opaque DL code. Appears in data/dlc-fr26/reports/cabinet_code_mismatches.csv as "DL SKU not found in 20-20 list", and there is no row for it in the catalog fixtures and no description anywhere in the repo. The digits do not decode to a size that matches any Faircrest family (36 could be a width or a height, and SP is unambiguous nowhere).',
    needs:
      "A DL price list or spec sheet line for SP2436 (dimensions, door/drawer count, category) — or confirmation that it is obsolete. Nothing may be mapped before that.",
  },
  {
    ourCode: "MW2436",
    known:
      'Tom: do NOT map this by size. It may be a decorative-door microwave cabinet, and it appears only in Faircrest\'s size template (MW2436-MW3636), not in an actual package. A template row describes a slot the catalog can build, not a product Faircrest sells, so treating "24 x 36" as a matching size would invent a mapping for a cabinet nobody has confirmed exists.',
    needs:
      "Check Faircrest's actual package and the DL spec book: does MW2436 exist as a real sellable SKU, and if so is it a decorative-door microwave cabinet or the standard microwave wall box? Nothing may be mapped before that is settled.",
  },
  {
    ourCode: "MWD2448",
    known:
      "Same situation as MW2436, with a drawer: Tom says do NOT map by size. It appears only in Faircrest's template list (the MWD2448-MWD3648 drawer family), not in an actual package, and may be a decorative-door microwave cabinet.",
    needs:
      "Check Faircrest's actual package and the DL spec book: does MWD2448 exist as a real sellable SKU, how many drawers does it carry, and is it decorative-door? Nothing may be mapped before that is settled.",
  },
];

/**
 * Decided: unmapped.
 *
 * Tom has ruled on these and the answer is "no alias, now or later". They are
 * not open questions (`FAIRCREST_2020_NEEDS_TOM`) and not research items
 * (`FAIRCREST_2020_NEEDS_RESEARCH`) — they are settled negatives, recorded so
 * nobody re-opens them. Each resolves to nothing, on purpose.
 */
export const FAIRCREST_2020_DECIDED_UNMAPPED: readonly {
  ourCode: string;
  /** What the Faircrest thing actually is. */
  faircrest: string;
  why: string;
}[] = [
  {
    ourCode: "ESR1",
    faircrest:
      'A drawing setting for end shelf radius (End Shelf Radius 1) on Faircrest\'s curved open ends — "when set to 0" the shelf squares off. It is a spec variable on an HTML spec page, not a cabinet and not a SKU.',
    why: "Decided unmapped: ESR1 is not a cabinet, so there is nothing to alias. It stays a drawing setting only; this module never maps it and no code reads it for geometry.",
  },
  {
    ourCode: "WAS1224-WAS1260",
    faircrest:
      "Faircrest's wall angle CABINET family (WAS + width + height), sold L/R, with a doored WAC variant. These are cabinets, not shelves — a wall angle cabinet is a full box with an angled face. We do not sell a wall angle cabinet yet.",
    why: "Decided unmapped: we have no SKU in this family, so there is nothing of ours to alias. When a wall angle cabinet is added to our catalog, that new code maps here — not before.",
  },
];

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
}[] = [
  {
    ourCode: "WRC3018 / LWR3018 / WXR3018",
    faircrestCandidate: "WR30 / WR3318 / WR3618",
    why: 'Decided unmapped for now. These are all 30" W x 18" H wine racks. Faircrest\'s wine codes must be read as measurements exactly from the label, and no code in the extractable package is confirmed as a 30 x 18 wine rack: the only 3018 wine-ish candidate is WCC3018, whose description ("Wall Criss Cross") never says wine, and Faircrest\'s known wine pictures are LWR3015, WR3315/WR3324 and WR3612-WR3624 — none at 30 x 18. Per Tom, never guess: these stay unmapped until a Faircrest 30W x 18H wine rack code is confirmed. (Note: all wine rack cabinets can be flipped vertical or horizontal, and all carry a lattice insert for bottles, so the box is not orientation-specific — but that does not license a size guess.)',
  },
  {
    ourCode: "WWC630",
    faircrestCandidate: "WWR630",
    why: 'Decided unmapped. Our WWC630 code reads 6" W x 30" H, while the catalog row itself is 30" W x 6" H — the label and the row disagree, so no Faircrest code can be matched on a measurement we are not sure of. WWR630 is the nearest Faircrest candidate ("Wall Wine Rack", 6 x 30) and is recorded here for whoever resolves the row dimensions; it is NOT mapped, because guessing which reading is right is exactly what Tom ruled out.',
  },
  {
    ourCode: "SP09",
    faircrestCandidate: 'BSR9 (9" Base Spice Rack) — pending Tom confirmation',
    why: 'SP09 = 9" spice pull-out cabinet, carried by every supplier. It is NOT the same as SPO9 (SPO9 is the whole-unit spice pullout with three shelves). It may go by different nomenclature at Faircrest but is the same cabinet. Proposed Faircrest match: BSR9, the 9" Base Spice Rack — pending Tom confirmation, so NO alias is added yet and SP09 must not resolve to anything in the meantime. Note that once confirmed, SP09 and our BSR9 would BOTH point at Faircrest BSR9: two of our spellings naming one Faircrest cabinet, which is expected, not a conflict.',
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

/**
 * Strip a trailing hand even when the base ends in a letter (B9FH-R, SPO9-R).
 * Tried only AFTER a base lookup fails, and only against a real base, so a code
 * that legitimately ends in L or R (BES, LS) is never truncated.
 */
function withoutTrailingHand(compactCode: string): string {
  const stripped = compactCode.replace(/(?:LH|RH|L|R)$/, "");
  return stripped.length < compactCode.length ? stripped : compactCode;
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
  if (faircrestKey && !BY_FAIRCREST_CODE.has(faircrestKey))
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

  // Try every plausible base of a handed spelling. `withoutHand` only strips a
  // hand after a digit (BBC36-R); `withoutTrailingHand` also handles a base that
  // ends in a letter (B9FH-R). Each candidate must exist as a real base, so a
  // code that ends in L/R on its own (BES, LS) is never truncated.
  const bases = Array.from(
    new Set([withoutHand(ourKey), withoutTrailingHand(ourKey)]),
  ).filter((candidate) => candidate !== ourKey);
  for (const candidate of bases) {
    const viaOurBase = BY_OUR_CODE.get(candidate);
    if (viaOurBase) return aliasOf(viaOurBase);
  }

  for (const candidate of [ourKey, ...bases]) {
    const patternAlias = wallOpenShelfAlias(candidate);
    if (patternAlias) return patternAlias;
  }

  // The caller handed us Faircrest's own spelling (WAC1230L, WBC2736-R, WOS1230).
  for (const candidate of [withoutHand(ourKey), withoutTrailingHand(ourKey)]) {
    const byFaircrest = BY_FAIRCREST_CODE.get(candidate);
    if (byFaircrest) return aliasOf(byFaircrest);
  }
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
  const compactKey = compact(faircrestCode);
  if (!compactKey) return [];
  const out = new Set<string>();
  // A handed spelling (TB09-L, B9-SP-R) resolves through whichever base exists.
  const keys = Array.from(
    new Set([withoutHand(compactKey), withoutTrailingHand(compactKey)]),
  );
  for (const faircrestKey of keys) {
    for (const entry of CONFIRMED) {
      if (compact(entry.faircrestCode) === faircrestKey) out.add(entry.ourCode);
      if (wallOpenShelfFaircrestCode(compact(entry.ourCode)) === faircrestKey)
        out.add(entry.ourCode);
    }
    // Faircrest's WOS ladder is mechanical on our side too: WOS1230 is WEOS1230
    // / WOES1230 here. This names a spelling, not a cabinet - nothing resolves
    // until a catalog row actually carries it.
    for (const spelling of wallOpenShelfOurSpellings(faircrestKey))
      out.add(spelling);
  }
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

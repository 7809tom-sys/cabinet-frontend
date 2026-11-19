/**
 * Budget friendly: the sink is picked for the customer, never asked (Tom, voice, Nov 19 2026, 8:40 AM CT).
 *
 * Mirrors the faucet default (`ensureMandatorySinkFaucets`): a real catalog row first, otherwise a
 * source-verified Pelican profile as the catalog-wide default, and the choice is reported.
 *
 *  1. The line's own sink rows (the Pelican/surfaces sink catalog the build is given). A row is a
 *     candidate when its kind matches the base (apron-front only in an FSB, standard only in an SB)
 *     and it FITS (rule below). Among candidates (Tom, 8:45 AM CT): the LOWEST-PRICED double bowl;
 *     if no double bowl fits, the lowest-priced fitting sink, and the report says why. Real catalog
 *     prices only; an unpriced row ranks after every priced row.
 *  2. If the line sells no sink that fits, the same choice is made from the source-verified Pelican
 *     kitchen sink profiles (real published dimensions). That default is drawn and reported but has
 *     no catalog row, so nothing is billed and no price is invented, exactly like the default faucet.
 *  3. If nothing fits anywhere, the build keeps the plain placeholder basin and says so.
 *
 * FIT RULE (documented for Tom): sink exterior width <= base width - 3″ (1½″ per side for the
 * cabinet sides and the clips), AND the sink's published minimum cabinet width <= base width.
 * SB36 -> sinks up to 33″ wide. Only rows with a known width (verified profile or a parsed plan
 * size) can be checked, so a row with no width is never picked.
 */
import { dim, isFarmerSinkBase, type DesignCabinet, type PlacedCabinet } from "./design";
import { isAutoBuildStraightSinkBaseCandidate, pickAutoDesignSinkBase } from "./autoDesignAutoBuild";
import { parsePelicanPlanSize } from "./pelicanAutoPlace";
import { verifiedPelicanKitchenSinkProfiles, verifiedPelicanSinkProfile, type VerifiedPelicanSinkProfile } from "./pelicanFixtureProfiles";
import { catalogSinkInstallation, isAutoDesignSinkProduct, sinkBasePairing, type AutoDesignSinkProduct } from "./autoDesignSink";

export const BUDGET_SINK_SIDE_CLEARANCE_IN = 3;

type Candidate = {
  code: string;
  name: string;
  widthIn: number;
  minimumCabinetWidthIn: number;
  bowls: number;
  farmhouse: boolean;
  product: AutoDesignSinkProduct | null;
  profile: VerifiedPelicanSinkProfile | null;
};

export type BudgetSinkPick =
  | { source: "line"; product: AutoDesignSinkProduct; profile: VerifiedPelicanSinkProfile | null; widthIn: number; doubleBowl: boolean; note: string }
  | { source: "default"; product: null; profile: VerifiedPelicanSinkProfile; widthIn: number; doubleBowl: boolean; note: string }
  | { source: "none"; product: null; profile: null; widthIn: 0; doubleBowl: false; note: string };

function isFarmBase(base: Pick<PlacedCabinet, "masterCode" | "description" | "subCategory">): boolean {
  return /^fsb[-_]?\d/i.test(base.masterCode ?? "") || /farm(?:house)?|apron/i.test(`${base.description ?? ""} ${base.subCategory ?? ""}`);
}

function bowlsFromText(text: string): number {
  return /double[-\s]?bowl|\b50\/50\b|\b60\/40\b|\b40\/60\b/i.test(text) ? 2 : 1;
}

export function budgetSinkFits(candidate: { widthIn: number; minimumCabinetWidthIn: number }, baseWidthIn: number): boolean {
  return candidate.widthIn > 0
    && candidate.widthIn <= baseWidthIn - BUDGET_SINK_SIDE_CLEARANCE_IN + 0.001
    && candidate.minimumCabinetWidthIn <= baseWidthIn + 0.001;
}

const priceOf = (c: Candidate): number | null => {
  const price = Number(c.product?.sellPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
};

/**
 * Tom, voice, Nov 19 2026, 8:45 AM CT: the LOWEST-PRICED DOUBLE-BOWL sink that fits; if no double bowl
 * fits, the lowest-priced sink that fits. Only real catalog prices rank (an unpriced row sorts after
 * every priced one); verified defaults have no price, so they rank double bowl, then widest.
 */
function choose(candidates: Candidate[], baseWidthIn: number, farm: boolean): { pick: Candidate; doubleFits: boolean } | null {
  const fit = candidates.filter((c) => c.farmhouse === farm && budgetSinkFits(c, baseWidthIn));
  const doubleFits = fit.some((c) => c.bowls === 2);
  const pool = doubleFits ? fit.filter((c) => c.bowls === 2) : fit;
  pool.sort((a, b) => {
    const pa = priceOf(a);
    const pb = priceOf(b);
    if (pa != null || pb != null) {
      if (pa == null) return 1;
      if (pb == null) return -1;
      if (pa !== pb) return pa - pb;
    }
    return (b.widthIn - a.widthIn) || a.name.localeCompare(b.name) || ((a.product?.id ?? 0) - (b.product?.id ?? 0));
  });
  return pool[0] ? { pick: pool[0], doubleFits } : null;
}

function fromProduct(product: AutoDesignSinkProduct): Candidate | null {
  if (!isAutoDesignSinkProduct(product)) return null;
  const profile = verifiedPelicanSinkProfile(product.pelicanCode);
  const parsed = parsePelicanPlanSize(product.size ?? null);
  const widthIn = profile?.exteriorWidthIn ?? parsed?.width ?? 0;
  if (!(widthIn > 0)) return null;
  const pairing = sinkBasePairing(product);
  return {
    code: product.pelicanCode ?? String(product.id),
    name: product.name,
    widthIn,
    minimumCabinetWidthIn: profile?.minimumCabinetWidthIn ?? pairing.minimumWidthIn ?? widthIn + BUDGET_SINK_SIDE_CLEARANCE_IN,
    bowls: profile?.bowlCount ?? bowlsFromText(`${product.name} ${product.description ?? ""}`),
    farmhouse: catalogSinkInstallation(product) === "farmhouse",
    product,
    profile,
  };
}

function fromProfile(profile: VerifiedPelicanSinkProfile): Candidate {
  return {
    code: profile.pelicanCode,
    name: profile.name,
    widthIn: profile.exteriorWidthIn,
    minimumCabinetWidthIn: profile.minimumCabinetWidthIn,
    bowls: profile.bowlCount ?? 1,
    farmhouse: profile.sinkType === "farmhouse" || profile.apronFront,
    product: null,
    profile,
  };
}

const inch = (n: number) => `${Number(n.toFixed(3))}″`;

export function pickBudgetDefaultSink(input: {
  base: Pick<PlacedCabinet, "width" | "masterCode" | "description" | "subCategory">;
  lineProducts: readonly AutoDesignSinkProduct[];
}): BudgetSinkPick {
  const baseWidthIn = Number(input.base.width) || 0;
  const farm = isFarmBase(input.base);
  const rule = `fits ${input.base.masterCode}: sink width ≤ base width − ${BUDGET_SINK_SIDE_CLEARANCE_IN}″ (${inch(baseWidthIn - BUDGET_SINK_SIDE_CLEARANCE_IN)}) and its minimum cabinet width ≤ ${inch(baseWidthIn)}`;
  const kind = (c: Candidate) => (c.farmhouse ? "apron-front" : c.bowls === 2 ? "double-bowl" : "single-bowl");
  const money = (n: number) => `$${n.toFixed(2)}`;
  const lineChoice = choose(input.lineProducts.map(fromProduct).filter((c): c is Candidate => c != null), baseWidthIn, farm);
  if (lineChoice && lineChoice.pick.product) {
    const line = lineChoice.pick;
    const price = priceOf(line);
    const why = farm
      ? `the lowest-priced apron-front sink in the line's catalog that ${rule}`
      : lineChoice.doubleFits
        ? `the lowest-priced double-bowl sink in the line's catalog that ${rule}`
        : `the lowest-priced sink in the line's catalog that ${rule} — no double-bowl sink in the line fits this base`;
    return {
      source: "line", product: line.product!, profile: line.profile, widthIn: line.widthIn,
      doubleBowl: line.bowls === 2,
      note: `Budget friendly: the sink was picked for you, no question asked: ${line.name} (${line.code})${price != null ? `, ${money(price)}` : ", no catalog price"}, a ${inch(line.widthIn)} ${kind(line)} sink, ${why}.`,
    };
  }
  const fallbackChoice = choose(verifiedPelicanKitchenSinkProfiles().map(fromProfile), baseWidthIn, farm);
  if (fallbackChoice && fallbackChoice.pick.profile) {
    const fallback = fallbackChoice.pick;
    const why = input.lineProducts.length ? "the line sells no sink that fits this base" : "the line sells no sink";
    const noDouble = !farm && !fallbackChoice.doubleFits ? " (no double-bowl sink fits this base)" : "";
    return {
      source: "default", product: null, profile: fallback.profile!, widthIn: fallback.widthIn,
      doubleBowl: fallback.bowls === 2,
      note: `Budget friendly: ${why}, so the default ${fallback.name} (${fallback.code}), a ${inch(fallback.widthIn)} ${kind(fallback)} sink from the verified Pelican catalog that ${rule}${noDouble}, was placed (drawn, not priced: no catalog row).`,
    };
  }
  return {
    source: "none", product: null, profile: null, widthIn: 0, doubleBowl: false,
    note: `Budget friendly: no sink in the line or the verified Pelican catalog ${rule}, so the sink base keeps a plain placeholder basin. Pick a sink to finish it.`,
  };
}

/**
 * Budget friendly: the sink BASE is picked for the customer too (Tom, voice, Nov 19 2026, 9:01 AM CT; code go
 * 1:26 PM CT): the SMALLEST regular sink base the line sells that takes the lowest-priced double-bowl sink and,
 * among bases of that width, the LOWEST-PRICED one. No manual pick.
 *
 *  - The sink comes first, exactly as `pickBudgetDefaultSink` picks it: the line's lowest-priced double-bowl sink
 *    (real catalog price), regardless of which base it needs. The base is then the smallest regular sink base the
 *    line sells that fits that sink under the same fit rule (sink width <= base width - 3 in, and the sink's
 *    published minimum cabinet width <= base width). So the lowest-priced double bowl is never traded for a
 *    smaller base that would force a dearer sink.
 *  - The line sells no double-bowl sink with a known width that fits any of its bases: null, so the measured base
 *    is kept and `pickBudgetDefaultSink` falls back to the verified Pelican default exactly as before (that default
 *    is drawn, not billed, so there is no price to justify moving the base).
 *  - Only real catalog prices rank bases. `priceByCabinetId` is the line's real price per cabinet id; a base with no
 *    price ranks after every priced base and nothing is invented. With no price for any base at the width, the
 *    existing plain-SB preference (`pickAutoDesignSinkBase`) breaks the tie and the note says no price was available.
 *  - Farmhouse/apron-front bases are never chosen here (an explicit farmhouse request is left alone by the caller),
 *    nor are vanity, corner or ADA sink bases.
 *  - No width fits a double bowl: null, and the caller keeps the measured base width.
 */
export type BudgetSinkBasePick = { row: DesignCabinet; widthIn: number; priceUsd: number | null; note: string };

function isSpecialtySinkBase(row: Pick<DesignCabinet, "masterCode" | "description" | "subCategory">): boolean {
  return /\bADA\b/i.test(`${row.subCategory ?? ""} ${row.description ?? ""}`)
    || /ADA$/i.test(row.masterCode)
    || /^V/i.test(row.masterCode)
    || /vanity/i.test(`${row.description ?? ""} ${row.subCategory ?? ""}`);
}

export function pickBudgetSinkBase(input: {
  baseCatalog: readonly DesignCabinet[];
  lineSinkProducts: readonly AutoDesignSinkProduct[];
  priceByCabinetId?: ReadonlyMap<number, number> | null;
}): BudgetSinkBasePick | null {
  const regular = input.baseCatalog.filter((row) => isAutoBuildStraightSinkBaseCandidate(row as never)
    && /^(?:ADA-)?SB[-_ ]?\d/i.test(row.masterCode)
    && !isFarmerSinkBase(row as never)
    && !isSpecialtySinkBase(row)
    && dim(row.width as never, 0) > 0);
  const widths = Array.from(new Set(regular.map((row) => Math.round(dim(row.width as never, 0) * 8) / 8))).sort((a, b) => a - b);
  const money = (n: number) => `$${n.toFixed(2)}`;
  const priced = (row: DesignCabinet): number | null => {
    const price = Number(input.priceByCabinetId?.get(row.id));
    return Number.isFinite(price) && price > 0 ? price : null;
  };

  // 1. Which sink the base has to take (same order and ranking as the sink pick).
  const lineDoubles = input.lineSinkProducts
    .map(fromProduct)
    .filter((c): c is Candidate => c != null && c.bowls === 2 && !c.farmhouse)
    .sort((a, b) => {
      const pa = priceOf(a);
      const pb = priceOf(b);
      if (pa != null || pb != null) {
        if (pa == null) return 1;
        if (pb == null) return -1;
        if (pa !== pb) return pa - pb;
      }
      return (b.widthIn - a.widthIn) || a.name.localeCompare(b.name) || ((a.product?.id ?? 0) - (b.product?.id ?? 0));
    });
  const smallestFit = (sink: Candidate) => widths.find((w) => budgetSinkFits(sink, w));
  let sink: Candidate | null = null;
  let widthIn: number | undefined;
  for (const candidate of lineDoubles) {
    widthIn = smallestFit(candidate);
    if (widthIn != null) { sink = candidate; break; }
  }
  if (sink == null || widthIn == null) return null;

  // 2. The lowest-priced regular sink base of that width.
  const atWidth = regular.filter((row) => Math.abs(dim(row.width as never, 0) - widthIn!) < 0.1);
  const ranked = [...atWidth].sort((a, b) => {
    const pa = priced(a);
    const pb = priced(b);
    if (pa != null || pb != null) {
      if (pa == null) return 1;
      if (pb == null) return -1;
      if (pa !== pb) return pa - pb;
    }
    return a.masterCode.localeCompare(b.masterCode) || a.id - b.id;
  });
  const anyPrice = ranked.some((row) => priced(row) != null);
  const row = anyPrice ? ranked[0]! : (pickAutoDesignSinkBase(atWidth, widthIn, "regular") ?? ranked[0]!);
  const price = priced(row);
  const note = `Budget friendly: the sink base was picked for you, no question asked: ${row.masterCode}, ${inch(widthIn)}`
    + `${price != null ? `, ${money(price)}` : ", no catalog price available to rank it"}, the smallest regular sink base the line sells that takes the double-bowl sink`
    + ` ${sink.name} (${inch(sink.widthIn)} wide)${atWidth.length > 1 && anyPrice ? ", and the lowest-priced base at that width" : ""}.`;
  return { row, widthIn, priceUsd: price, note };
}

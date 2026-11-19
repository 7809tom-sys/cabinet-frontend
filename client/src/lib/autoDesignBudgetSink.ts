/**
 * Budget friendly: the sink is picked for the customer, never asked (Tom, voice, Nov 19 2026, 8:40 AM CT).
 *
 * Mirrors the faucet default (`ensureMandatorySinkFaucets`): a real catalog row first, otherwise a
 * source-verified Pelican profile as the catalog-wide default, and the choice is reported.
 *
 *  1. The line's own sink rows (the Pelican/surfaces sink catalog the build is given). A row is a
 *     candidate when its kind matches the base (apron-front only in an FSB, standard only in an SB)
 *     and it FITS (rule below). Among candidates: a double bowl on a 33″+ base, a single bowl below
 *     that; then the widest sink (best use of the base); then name and id for a stable pick.
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
import type { PlacedCabinet } from "./design";
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
  | { source: "line"; product: AutoDesignSinkProduct; profile: VerifiedPelicanSinkProfile | null; widthIn: number; note: string }
  | { source: "default"; product: null; profile: VerifiedPelicanSinkProfile; widthIn: number; note: string }
  | { source: "none"; product: null; profile: null; widthIn: 0; note: string };

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

function choose(candidates: Candidate[], baseWidthIn: number, farm: boolean): Candidate | null {
  const wantBowls = baseWidthIn >= 33 - 0.001 ? 2 : 1;
  const fit = candidates.filter((c) => c.farmhouse === farm && budgetSinkFits(c, baseWidthIn));
  fit.sort((a, b) => (Number(b.bowls === wantBowls) - Number(a.bowls === wantBowls))
    || (b.widthIn - a.widthIn)
    || a.name.localeCompare(b.name)
    || ((a.product?.id ?? 0) - (b.product?.id ?? 0)));
  return fit[0] ?? null;
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
  const line = choose(input.lineProducts.map(fromProduct).filter((c): c is Candidate => c != null), baseWidthIn, farm);
  if (line && line.product) {
    return {
      source: "line", product: line.product, profile: line.profile, widthIn: line.widthIn,
      note: `Budget friendly: the sink was picked for you, no question asked: ${line.name} (${line.code}), a ${inch(line.widthIn)} ${kind(line)} sink from the line's catalog that ${rule}.`,
    };
  }
  const fallback = choose(verifiedPelicanKitchenSinkProfiles().map(fromProfile), baseWidthIn, farm);
  if (fallback && fallback.profile) {
    const why = input.lineProducts.length ? "the line sells no sink that fits this base" : "the line sells no sink";
    return {
      source: "default", product: null, profile: fallback.profile, widthIn: fallback.widthIn,
      note: `Budget friendly: ${why}, so the default ${fallback.name} (${fallback.code}), a ${inch(fallback.widthIn)} ${kind(fallback)} sink from the verified Pelican catalog that ${rule}, was placed (drawn, not priced: no catalog row).`,
    };
  }
  return {
    source: "none", product: null, profile: null, widthIn: 0,
    note: `Budget friendly: no sink in the line or the verified Pelican catalog ${rule}, so the sink base keeps a plain placeholder basin. Pick a sink to finish it.`,
  };
}

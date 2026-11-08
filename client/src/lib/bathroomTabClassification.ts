import {
  PELICAN_VANITY_FAUCET_SKUS,
  PELICAN_VANITY_SINK_SKUS,
} from "@shared/pelicanBathroomFixtures";
import { verifiedPelicanBathroomFixtureProfile } from "./pelicanBathroomFixtureProfiles";

/**
 * Which Bathroom Fixtures tab a catalog row belongs to.
 *
 * The catalog's own `category` and `subCategory` cannot be trusted for this. They
 * are the vendor's import buckets, not product types: PL-CI6004 and PL-CI6008 are
 * 33" x 22" cast iron KITCHEN sinks filed under `subCategory: "Faucets"` (which is
 * why they showed up labelled FAUCET on the Vanity Sinks tab), 16 soaking tubs are
 * filed under `Sink & Faucet Accessories`, and the `Shower & Bath` category holds
 * no tubs at all. Keyword matching on the description is not good enough either:
 * "bathtub" appears in tub-filler faucet names, and "stainless" appears in faucet
 * finishes.
 *
 * So the decision is made from, in order of reliability:
 *
 * 1. The exact-SKU tables in `@shared/pelicanBathroomFixtures`, which were checked
 *    against Pelican's own specification sheets. These are the same lists the
 *    designer already uses to decide what can be placed in 3D.
 * 2. The verified fixture profiles (toilet, bidet, tub, shower door/wall...), which
 *    are per-SKU and carry measured envelope dimensions.
 * 3. A small number of explicit SKU-family rules for products that are real but
 *    have no verified profile yet (tubs awaiting a sheet, shower pans, accessories).
 *
 * Rows that none of those recognise are *excluded* rather than guessed into a tab.
 */
export type BathroomTabRole =
  | "bathroom-sink"
  | "bathroom-faucet"
  | "toilet-bidet"
  | "bathtub"
  | "shower-door"
  | "shower-surround"
  | "shower-system"
  | "shower-pan"
  | "shower-tile"
  | "shower-niche"
  | "bathroom-accessory";

/** Minimal shape of a catalog row, so this module stays testable without tRPC. */
export type BathroomTabRow = {
  pelicanCode?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
};

const VANITY_SINK_SKUS = new Set<string>(PELICAN_VANITY_SINK_SKUS);
const VANITY_FAUCET_SKUS = new Set<string>(PELICAN_VANITY_FAUCET_SKUS);

/**
 * The same lists keyed by base model ("PL-3099"), so a row that arrives without a
 * finish suffix still matches. The exact codes stay authoritative when present.
 */
const VANITY_SINK_MODELS = new Set(PELICAN_VANITY_SINK_SKUS.map((code) => code.trim().split(/\s+/)[0]!));
const VANITY_FAUCET_MODELS = new Set(PELICAN_VANITY_FAUCET_SKUS.map((code) => code.trim().split(/\s+/)[0]!));

/**
 * Priced bathroom faucet rows that are in the live catalog but not on the
 * specification-sheet list. Kept here so the Faucets tab and the basin picker
 * agree on one set.
 */
const ADDITIONAL_BATHROOM_FAUCET_SKUS = [
  "PL-8114 BN",
  "PL-8114 CHR",
  "PL-8164 BN",
  "PL-8303 BN",
  "PL-8303 CHR",
] as const;

/** Floor-mounted tub fillers, sold as PL-8515 / PL-8522 / PL-8538 with a finish. */
const FLOOR_TUB_FILLER = /^(?:PL-8515|PL-8522|PL-8538)\s+\S+$/i;

/**
 * Bath accessories: towel bars, paper holders, robe hooks, grab bars, and the
 * matching sets. These are real, priced rows. They belong in an Accessories group,
 * never in Bathtubs — which is where the old role filter was putting them.
 *
 * Deliberately narrow: an earlier attempt used PL-03A42/PL-03A11 prefixes and
 * swept real shower doors and shower bases into Accessories with them.
 */
const ACCESSORY_CODE_PREFIXES = [
  "PL-03A11S48", // Aura towel bar / paper holder / robe hook set by finish
  "PL-03A12",
  "PL-03A43", // Haven accessory set
] as const;

/** Drain grates, strainers, disposals, and trim: not a fixture you place in a room. */
const DRAIN_OR_TRIM_PREFIXES = [
  "PL-02638",
  "PL-02640",
  "PL-02800",
  "PL-02805",
  "PL-03A99",
] as const;

/** A bathtub that has no verified profile yet still belongs in Bathtubs. */
const TUB_DESCRIPTION = /\b(?:soaking tub|bathtub|freestanding tub|alcove tub|skirted bathtub)\b/i;
/** ...but a tub filler / tub faucet is a faucet, not a tub. */
const FAUCET_DESCRIPTION = /\b(?:faucet|filler|trim kit|valve|spout|shower ?head|hand ?shower)\b/i;

function normalize(code: string | null | undefined): string {
  return (code ?? "").trim();
}

/** The base model of a SKU, dropping finish/size suffixes: "PL-02849LNSO" -> "PL-02849". */
function baseModel(code: string): string {
  const trimmed = normalize(code);
  // PL-02138 67" -> PL-02138 ; a trailing finish token (BN/CHR/MB/BG) is not part
  // of the model number.
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function hasPrefix(code: string, prefix: string): boolean {
  return baseModel(code).toUpperCase().startsWith(prefix.toUpperCase());
}

function rowText(row: BathroomTabRow): string {
  return `${row.name ?? ""} ${row.description ?? ""}`.trim();
}

/**
 * True when the row's own description names a kitchen, utility, laundry,
 * farmhouse/apron-front, or bar/prep sink. These are kitchen-only by the existing
 * rule and must never appear on a bathroom tab.
 */
export function isKitchenOrUtilitySink(row: BathroomTabRow): boolean {
  const text = rowText(row);
  return /\b(?:kitchen|laundry|utility|farmhouse|apron[- ]front|bar\/prep|bar sink|prep sink|workstation|butler)\b/i.test(text);
}

/** A stainless sink is a kitchen sink. Bathroom vanity basins are porcelain. */
export function isStainlessSink(row: BathroomTabRow): boolean {
  return /\bstainless\b/i.test(rowText(row));
}

function isTubFillerFaucet(row: BathroomTabRow): boolean {
  return FLOOR_TUB_FILLER.test(normalize(row.pelicanCode))
    || /\b(?:floor[- ]mount(?:ed)? tub filler|tub filler)\b/i.test(rowText(row));
}

/**
 * A wall-hung lavatory: a basin with no cabinet, mounted to the wall. Pelican's
 * live catalog has none of these among the vanity-sink SKUs, so if one ever
 * appears it is excluded from Vanity Sinks (which are all deck/cabinet mounted)
 * rather than being drawn as an undermount basin.
 */
export function isWallHungLavatory(row: BathroomTabRow): boolean {
  const text = rowText(row);
  return /\bwall[- ]mount(?:ed)?\b/i.test(text) && /\b(?:lavatory|sink|basin)\b/i.test(text)
    && !/\b(?:faucet|tub filler)\b/i.test(text);
}

/**
 * The tab a row belongs on, or `null` when it belongs on none of them.
 *
 * `null` is a real answer: a drain grate or a strainer basket is a real product
 * but it is not a bathroom fixture you place in a room, so it is excluded from
 * every fixture tab instead of being forced into the nearest one.
 */
export function bathroomTabForRow(row: BathroomTabRow): BathroomTabRole | null {
  const code = normalize(row.pelicanCode);
  const text = rowText(row);
  const profile = verifiedPelicanBathroomFixtureProfile(code);

  // 0. A tub SURROUND or wall kit is a wall, not a tub, even though its name says
  //    "Tub". Tested first so a 60" x 32" glue-up surround never becomes a bath.
  if (/\b(?:surround|shower wall|wall kit|glue up)\b/i.test(text) && /\b(?:shower|tub|alcove)\b/i.test(text)) {
    return "shower-surround";
  }

  // 1. Verified per-SKU fixture profiles win outright: these carry a measured
  //    envelope and are already placeable in the designer.
  if (profile) {
    switch (profile.kind) {
      case "toilet":
      case "bidet":
        return "toilet-bidet";
      case "freestanding-tub":
      case "alcove-tub":
        return "bathtub";
      case "shower-door":
      case "tub-door":
        return "shower-door";
      case "shower-wall":
        return "shower-surround";
      case "floor-tub-filler":
        return "bathroom-faucet";
    }
  }

  // 2. Exact specification-sheet SKU tables for the vanity items.
  if (VANITY_SINK_SKUS.has(code) || VANITY_SINK_MODELS.has(baseModel(code))) {
    // A kitchen/utility sink must never be filed as a vanity basin even if it
    // somehow reaches one of those lists.
    if (isKitchenOrUtilitySink(row) || isStainlessSink(row)) return null;
    if (isWallHungLavatory(row)) return null;
    return "bathroom-sink";
  }
  if (
    VANITY_FAUCET_SKUS.has(code)
    || VANITY_FAUCET_MODELS.has(baseModel(code))
    || (ADDITIONAL_BATHROOM_FAUCET_SKUS as readonly string[]).includes(code)
  ) {
    return "bathroom-faucet";
  }

  // 3. Tub fillers are faucets, and must be tested before any "tub" rule.
  if (isTubFillerFaucet(row)) return "bathroom-faucet";

  // 4. Shower pans and bases are three-wall fixtures like an alcove tub, and must be
  //    recognised before the accessory rules: their descriptions contain "shower"
  //    and their SKUs share prefixes with accessory sets.
  if (/\bshower pan\b|\bshower base\b|\bshower receptor\b|\bpan only\b/i.test(text)) return "shower-pan";
  if (/\b(?:shower|tub) base\b|\bshower kit\b/i.test(text)) return "shower-surround";

  // 5. Shower doors before accessories for the same reason: PL-03A11S60 is a door.
  if (/\bshower (?:door|glass|enclosure)\b|\bframeless\b.*\bdoor\b|\b(?:single|double) sliding\b.*\bdoor\b/i.test(text)) {
    return "shower-door";
  }

  // 6. Accessories, before any description keyword can claim them for Bathtubs.
  if (ACCESSORY_CODE_PREFIXES.some((prefix) => hasPrefix(code, prefix))) return "bathroom-accessory";
  if (/\b(?:towel (?:bar|ring|rack)|robe hook|paper holder|toilet paper|grab bar|accessor(?:y|ies) set)\b/i.test(text)) {
    return "bathroom-accessory";
  }

  // 7. Drains, strainers, disposals, and trim are not placeable fixtures. Tested
  //    BEFORE the tub description rule: a row named "PL-36 Tub Drain" must not be
  //    swept into Bathtubs just because its name contains the word "tub".
  if (DRAIN_OR_TRIM_PREFIXES.some((prefix) => hasPrefix(code, prefix))) return null;
  if (/\b(?:drain|strainer|flange|disposal|air switch|deck plate|trim kit|overflow)\b/i.test(text)) {
    return null;
  }

  // 8. A real tub with no profile yet: a soaking tub or bathtub in the description
  //    that is not a faucet. This is what brings the 16 free-standing tubs out of
  //    `Sink & Faucet Accessories` and into Bathtubs.
  if (TUB_DESCRIPTION.test(text) && !FAUCET_DESCRIPTION.test(text)) return "bathtub";

  // Niches and soap trays before walls: their names mention the shower wall.
  if (/\b(?:niche|soap (?:tray|dish))\b/i.test(text)) return "shower-niche";
  // Shower wall tile is tile, not a panel.
  if (/\b(?:shower|wall) tile\b|\bmosaic\b/i.test(text) && /shower/i.test(text)) return "shower-tile";

  // 8. Remaining shower surrounds.
  if (/\bshower (?:wall|surround|panel|kit)\b|\balcove shower\b|\bglue up\b/i.test(text)) return "shower-surround";
  // Shower valves, valve sets, and systems. Pelican names these "… Valve Shower
  // Set", which does not contain the literal phrase "shower valve", so the set
  // wording is matched explicitly.
  if (/\b(?:shower (?:system|column|tower)|valve (?:tub\/)?shower\s*set|shower valve|thermostatic|pressure balance valve)\b/i.test(text)) {
    return "shower-system";
  }

  // 10. Toilets and bidets that have no verified profile (no published envelope yet,
  //    e.g. PL-12243) still belong on the Toilets & Bidets tab, flagged as pending.
  if (/\b(?:toilet|bidet)\b/i.test(text) && !FAUCET_DESCRIPTION.test(text)) return "toilet-bidet";

  // 11. A sink that reached none of the above is not a verified vanity basin, so it
  //    does not go on Vanity Sinks. Kitchen/utility/stainless sinks are excluded
  //    outright; anything else is left out rather than guessed.
  return null;
}

/** Every tab in display order. */
export const BATHROOM_TAB_ROLES: readonly BathroomTabRole[] = [
  "bathroom-sink",
  "bathroom-faucet",
  "toilet-bidet",
  "bathtub",
  "shower-pan",
  "shower-surround",
  "shower-tile",
  "shower-system",
  "shower-door",
  "shower-niche",
  "bathroom-accessory",
] as const;

/** True when the row belongs on the given tab. */
export function rowBelongsToBathroomTab(row: BathroomTabRow, role: BathroomTabRole): boolean {
  return bathroomTabForRow(row) === role;
}

/**
 * Keep only the rows that belong on this tab.
 *
 * Applied to the already-merged candidate list for the tab, so a result from the
 * wrong family can never leak in through a search or a stale filter.
 */
export function filterRowsForBathroomTab<T extends BathroomTabRow>(rows: readonly T[], role: BathroomTabRole): T[] {
  return rows.filter((row) => bathroomTabForRow(row) === role);
}

/** Tab counts for the audit table: how many rows each tab would show. */
export function bathroomTabCounts(rows: readonly BathroomTabRow[]): Record<BathroomTabRole, number> {
  const counts = Object.fromEntries(BATHROOM_TAB_ROLES.map((role) => [role, 0])) as Record<BathroomTabRole, number>;
  for (const row of rows) {
    const role = bathroomTabForRow(row);
    if (role) counts[role] += 1;
  }
  return counts;
}

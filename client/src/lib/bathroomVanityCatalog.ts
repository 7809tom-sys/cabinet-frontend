import type { DesignCabinet } from "./design";
import {
  PELICAN_BATHROOM_TAG,
  PELICAN_DOUBLE_BOWL_MIN_VANITY_WIDTH_IN,
  isPelicanVanityFaucetSku,
  isPelicanVanitySinkSku,
  pelicanVanityFaucetProfile,
  pelicanVanitySinkProfile,
  vanityFaucetSinkMatch,
} from "@shared/pelicanBathroomFixtures";

/** The Bathroom Vanity tab contains only source-categorized, placeable vanity items.
 * A reference to a vanity in an accessory's description is not enough to make
 * that accessory a vanity, and a decorative valance is never a vanity.
 */
export function isBathroomVanityCabinet(
  cabinet: Pick<DesignCabinet, "category" | "subCategory" | "description" | "placement">,
): boolean {
  if (cabinet.category?.trim().toLowerCase() !== "vanity") return false;
  if (cabinet.placement !== "base") return false;
  return !/\bvalance\b/i.test(`${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`);
}

/**
 * A catalog row that may appear in the Bathroom Designer's sink or faucet picker.
 *
 * Every active, priced row in the browser's own family is reachable: a row with
 * a source-verified profile installs in 3D, and a row without one still joins the
 * design's materials list. The tags and the exact-SKU table below decide which
 * family a row belongs to, not whether the shopper can see it.
 */
export type PelicanBathroomTaggedRow = {
  pelicanCode?: string | null;
  category?: string | null;
  subCategory?: string | null;
  name?: string | null;
  /** Comma-delimited tags on the Pelican catalog row, when the API returns them. */
  bathroomFixtureTags?: string | null;
};

function rowTags(row: PelicanBathroomTaggedRow): Set<string> {
  if (typeof row.bathroomFixtureTags !== "string") return new Set();
  return new Set(row.bathroomFixtureTags.split(",").map((tag) => tag.trim()).filter(Boolean));
}

/** True when the row is tagged as a bathroom vanity sink, or is an exact catalog SKU. */
export function isBathroomVanitySinkRow(row: PelicanBathroomTaggedRow): boolean {
  const tags = rowTags(row);
  if (tags.has(PELICAN_BATHROOM_TAG.vanitySink)) return true;
  return isPelicanVanitySinkSku(row.pelicanCode);
}

/** True when the row is tagged as a bathroom vanity faucet, or is an exact catalog SKU. */
export function isBathroomVanityFaucetRow(row: PelicanBathroomTaggedRow): boolean {
  const tags = rowTags(row);
  if (tags.has(PELICAN_BATHROOM_TAG.vanityFaucet)) return true;
  return isPelicanVanityFaucetSku(row.pelicanCode);
}

/** True when the row's tags say it is a double-bowl basin. */
export function isDoubleBowlVanitySinkRow(row: PelicanBathroomTaggedRow): boolean {
  if (rowTags(row).has(PELICAN_BATHROOM_TAG.doubleBowl)) return true;
  return pelicanVanitySinkProfile(row.pelicanCode)?.bowlCount === 2;
}

/**
 * Double-bowl vanity basins are offered only on a vanity at least
 * `PELICAN_DOUBLE_BOWL_MIN_VANITY_WIDTH_IN` wide. Pelican publishes no
 * double-bowl bathroom basin today, so this rule is dormant until one exists;
 * it is enforced here so a future import cannot place a two-bowl basin in a
 * 24-inch vanity.
 */
export function vanitySinkFitsVanityWidth(row: PelicanBathroomTaggedRow, vanityWidthIn: number | null | undefined): boolean {
  if (!isDoubleBowlVanitySinkRow(row)) return true;
  const width = Number(vanityWidthIn ?? 0);
  return Number.isFinite(width) && width >= PELICAN_DOUBLE_BOWL_MIN_VANITY_WIDTH_IN;
}

/** The vanity sinks the picker may show for this vanity base width. */
export function bathroomVanitySinkOptions<T extends PelicanBathroomTaggedRow>(
  rows: readonly T[],
  vanityWidthIn: number | null | undefined,
): T[] {
  return rows.filter((row) => isBathroomVanitySinkRow(row) && vanitySinkFitsVanityWidth(row, vanityWidthIn));
}

/**
 * The vanity faucets the picker may show for the basin already chosen.
 *
 * A three-hole basin only receives faucets with the same hole count, and a basin
 * whose sheet states a spread only receives faucets drilled to that spread. A
 * tap on an integrated top or a drop-in basin is drilled into the top itself, so
 * the source hole count is the one that has to match.
 */
export function bathroomVanityFaucetOptions<T extends PelicanBathroomTaggedRow>(
  rows: readonly T[],
  selectedSinkCode?: string | null,
): T[] {
  const sink = pelicanVanitySinkProfile(selectedSinkCode);
  return rows
    .filter(isBathroomVanityFaucetRow)
    .filter((row) => {
      const faucet = pelicanVanityFaucetProfile(row.pelicanCode);
      if (!faucet) return false;
      return vanityFaucetSinkMatch(faucet, sink).fits;
    });
}

/**
 * Plain-language note shown under the vanity faucet picker. Says whether the
 * chosen basin's drilling was matched exactly or needs a site check, so nobody
 * reads "no spread published" as "confirmed to fit".
 */
export function bathroomVanityFaucetMatchNote(selectedSinkCode?: string | null): string | null {
  const sink = pelicanVanitySinkProfile(selectedSinkCode);
  if (!sink) return null;
  if (sink.faucetHoles == null) {
    return "This basin is drilled in the countertop, so every Pelican vanity faucet is offered. Confirm the deck drilling with the fabricator.";
  }
  if (sink.faucetSpreadIn != null) {
    return `This basin is pre-drilled with ${sink.faucetHoles} holes on ${sink.faucetSpreadIn}″ centers, so only that spread is offered.`;
  }
  return `This top is pre-drilled with ${sink.faucetHoles} faucet holes but Pelican does not publish the hole spacing, so both 4″ centerset and 8″ widespread faucets are offered. Confirm the spacing before ordering.`;
}

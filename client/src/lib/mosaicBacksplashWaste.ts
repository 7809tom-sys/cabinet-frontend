/**
 * Owner rule (Tom, Nov 6 2026): a MOSAIC backsplash carries 5% waste.
 *
 * "When mosaic tile is used for a backsplash, the cart must automatically add 5% waste to the
 * square footage. If the backsplash needs X sq ft of mosaic, the cart quantity = X * 1.05."
 *
 * Read that formula literally: the mosaic backsplash waste factor is 1.05, so the sellable-unit
 * count is ceil(X * 1.05 / sq ft per sheet). It replaces the 15% tile/backsplash overage for that
 * one product and changes nothing else:
 *
 *  - field tile and any other non-mosaic wall tile keep the existing 15% overage,
 *  - flooring keeps its layout waste (10%, 20% for herringbone),
 *  - countertops, sinks, faucets and fixtures are untouched,
 *  - a mosaic installed as the FLOOR is a flooring surface, not a backsplash, so it keeps the
 *    flooring waste rather than this rule.
 *
 * ROUNDING: the cart already rounds area-priced tile up to whole sellable units, so the mosaic
 * quantity is ceil(X * 1.05 / sq ft per sheet). A mosaic is sold by the sheet; its row carries the
 * published sheet size but no `coverageSqFt`, so `mosaicSheetSquareFeet` supplies the unit area. A
 * vendor-entered `coverageSqFt` (sq ft per box) still wins when it exists. See
 * `buildSurfaceCartLines` in lib/surfaceCartLines.ts.
 *
 * MOSAIC DETECTION — exactly what is used, and what is still uncertain
 *
 * There is NO `isMosaic` / product-type column on `pelican_products`. The rule therefore reads the
 * two pieces of distributor-published product data the app already relies on:
 *
 *  1. "catalog-subcategory": category "Tile & Mosaic" with subCategory "Mosaic" — the identical test
 *     `isMosaicCatalogItem` already uses to decide what the Designer may install as a mosaic sheet.
 *  2. "catalog-record": the row resolves to a verified Pelican mosaic in the Designer catalog
 *     (`MOSAIC_CATALOG`, distributor SKUs read from buildpelican.com), matched on exact SKU or by the
 *     catalog name embedded in a decorated product name. Rows the distributor files under Tile &
 *     Mosaic but which are NOT mosaics (the cultured-marble vanity tops in `NON_MOSAIC_TILE_ROWS`)
 *     are excluded first.
 *
 * A product that is neither of those is NOT treated as a mosaic. In particular a product whose only
 * mosaic evidence is the word "mosaic" in its name is reported by `uncertainMosaicCandidate` and
 * left alone: guessing there would take 10 points of waste off a row that may be field tile, and
 * the owner's rule is about mosaics, not about names. Those rows keep the 15% tile overage until
 * their sub-category is corrected.
 *
 * Known gaps, stated rather than papered over:
 *  - subCategory is free text a vendor types. A mosaic saved with subCategory "Tile", or a field
 *    tile saved with subCategory "Mosaic", is only as right as that typed value.
 *  - a mosaic with no sub-category and no catalog record keeps the 15% tile overage (see above).
 *  - a mosaic with no `coverageSqFt` and no parseable published sheet size cannot be converted from
 *    square feet into sellable units at all; it keeps the existing qty 1 fallback and the cart note
 *    says the 5% could not be added.
 */

import { catalogCategoryValuesEqual } from "@shared/catalogCategorySpelling";
import { FLOORING_CATEGORY } from "@/lib/designerTileMosaicCatalog";
import { isMosaicCatalogItem } from "@/lib/mosaicFloorTile";
import { mosaicCatalogFor, nonMosaicTileRowFor } from "@/lib/mosaicCatalog";
import { surfaceRole } from "@/lib/pelican";

/** The owner's 5% mosaic backsplash waste, as a fraction of the measured square footage. */
export const MOSAIC_BACKSPLASH_WASTE_PCT = 0.05;

/** Cart note that tells the customer the quantity already carries the mosaic waste. */
export const MOSAIC_BACKSPLASH_WASTE_NOTE = `includes ${Math.round(MOSAIC_BACKSPLASH_WASTE_PCT * 100)}% waste`;

/** X * 1.05 — the multiplier the owner's rule states. */
export function mosaicBacksplashWasteFactor(): number {
  return 1 + MOSAIC_BACKSPLASH_WASTE_PCT;
}

/** Square footage to buy for a measured mosaic backsplash area, before rounding to units. */
export function mosaicBacksplashWasteSqFt(measuredSqFt: number): number {
  const area = Number(measuredSqFt);
  if (!Number.isFinite(area) || area <= 0) return 0;
  return area * mosaicBacksplashWasteFactor();
}

/**
 * Sellable area of ONE mosaic unit, in square feet.
 *
 * A mosaic is sold by the sheet, and the catalog row's `size` is the distributor's published
 * sheet size (`"11.81 x 11.81 x 8"` — the third number is the 8 mm thickness, not a dimension).
 * `coverageSqFt` is the structured square-feet-per-box field the cart already divides by, and it
 * is empty on every current Pelican mosaic, so without this the cart could not turn the measured
 * backsplash area into sheets at all.
 *
 * Deliberately narrow: the size string must parse cleanly, the mosaic must be one of the products
 * the product data positively identifies, and anything else returns null so the caller keeps its
 * honest "no unit size on this product" behaviour instead of inventing a number.
 */
export function mosaicSheetSquareFeet(product: MosaicProductLike | null | undefined): number | null {
  if (!product || !isMosaicProduct(product)) return null;
  const raw = (product.size ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(?:"|”|in\.?)?\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const widthIn = Number(match[1]);
  const heightIn = Number(match[2]);
  if (!Number.isFinite(widthIn) || !Number.isFinite(heightIn) || widthIn <= 0 || heightIn <= 0) return null;
  const sqFt = (widthIn * heightIn) / 144;
  return sqFt > 0 ? Math.round(sqFt * 10000) / 10000 : null;
}

export type MosaicProductLike = {
  category?: string | null;
  subCategory?: string | null;
  name?: string | null;
  pelicanCode?: string | null;
  slug?: string | null;
  size?: string | null;
};

/** Product data that positively identifies a mosaic sheet. */
export type MosaicProductSignal = "catalog-subcategory" | "catalog-record";

export type MosaicProductReading = {
  isMosaic: boolean;
  /** Which piece of product data decided it; null when this product is not a mosaic. */
  signal: MosaicProductSignal | null;
};

const NOT_A_MOSAIC: MosaicProductReading = { isMosaic: false, signal: null };

/**
 * Whether a catalog row is a mosaic sheet, from distributor product data only. Never inferred from
 * price, size, finish, pattern, or a word in the name.
 */
export function readMosaicProduct(product: MosaicProductLike | null | undefined): MosaicProductReading {
  if (!product) return NOT_A_MOSAIC;
  const category = product.category ?? "";
  // A Flooring row is a plank, stair nose, reducer or underlayment — never a mosaic sheet, even
  // when its name advertises a "mosaic look".
  if (catalogCategoryValuesEqual(category, FLOORING_CATEGORY)) return NOT_A_MOSAIC;
  // The distributor files cultured-marble vanity tops under Tile & Mosaic with subCategory "Tile".
  if (nonMosaicTileRowFor({ name: product.name, sku: product.pelicanCode })) return NOT_A_MOSAIC;
  // Same test the Designer's floor picker uses, so the cart and the picker agree.
  if (isMosaicCatalogItem(product)) return { isMosaic: true, signal: "catalog-subcategory" };
  const catalogEntry = mosaicCatalogFor({
    name: product.name,
    sku: product.pelicanCode,
    pelicanCode: product.pelicanCode,
    slug: product.slug,
  });
  if (catalogEntry) return { isMosaic: true, signal: "catalog-record" };
  return NOT_A_MOSAIC;
}

export function isMosaicProduct(product: MosaicProductLike | null | undefined): boolean {
  return readMosaicProduct(product).isMosaic;
}

/**
 * A tile row that LOOKS like a mosaic (the word is in its name) but has no mosaic sub-category and
 * no verified catalog record. Reported, never guessed: these keep the 15% tile overage.
 */
export function uncertainMosaicCandidate(product: MosaicProductLike | null | undefined): boolean {
  if (!product || isMosaicProduct(product)) return false;
  if (catalogCategoryValuesEqual(product.category, FLOORING_CATEGORY)) return false;
  if (!/\bmosaics?\b/i.test(product.name ?? "")) return false;
  return /tile|mosaic|backsplash/i.test(`${product.category ?? ""} ${product.subCategory ?? ""}`);
}

/**
 * Plain-language statement of how sure the mosaic reading is, for a reviewer or an admin. Null when
 * there is nothing to say (not a mosaic, and not a mosaic candidate either).
 */
export function mosaicDetectionUncertainty(product: MosaicProductLike | null | undefined): string | null {
  const reading = readMosaicProduct(product);
  if (reading.signal === "catalog-subcategory") {
    return "Mosaic read from the distributor's Tile & Mosaic > Mosaic sub-category. This is typed by the vendor, so a mis-typed row follows that typo.";
  }
  if (reading.signal === "catalog-record") {
    return "Mosaic read from a verified Pelican catalog row (distributor SKU) for this exact product. A non-mosaic row whose name embeds a catalog mosaic name would match it.";
  }
  if (uncertainMosaicCandidate(product)) {
    return "UNCERTAIN: the name says mosaic but there is no mosaic sub-category and no verified catalog row. No 5% waste is applied (the row keeps the 15% tile overage) until its sub-category is corrected to Mosaic.";
  }
  return null;
}

/** Categories the cart already prices off the measured backsplash area instead of the floor. */
export function isWallTileSurface(product: MosaicProductLike | null | undefined): boolean {
  if (!product) return false;
  const role = surfaceRole(product);
  if (role === "backsplash") return true;
  // Older saved picks ("Backsplash", "Wall Tile") carry a category that predates the Pelican
  // "Tile & Mosaic" line; the cart still prices those from the backsplash area.
  if (role !== "other") return false;
  return /backsplash|tile|mosaic/i.test(`${product.category ?? ""} ${product.subCategory ?? ""}`);
}

/**
 * The one condition the cart applies the 5% waste under: the product is a VERIFIED mosaic AND it is
 * installed as wall tile. A mosaic chosen as the floor is `surfaceRole` "flooring" and keeps the
 * flooring waste; countertop, sink, faucet and fixture picks are never touched.
 */
export function isMosaicBacksplashPick(product: MosaicProductLike | null | undefined): boolean {
  if (!product) return false;
  if (!isWallTileSurface(product)) return false;
  return isMosaicProduct(product);
}

/** The cart's note for a mosaic backsplash line. Null when this pick is not a mosaic backsplash. */
export function mosaicBacksplashWasteNote(product: MosaicProductLike | null | undefined): string | null {
  return isMosaicBacksplashPick(product) ? MOSAIC_BACKSPLASH_WASTE_NOTE : null;
}

/**
 * The mosaic waste note already recorded on a cart line, for the cart and checkout surfaces that
 * only carry the saved line. The cart line's own `qtyNote` is the single source, so this reads it
 * back rather than re-deriving the rule from data the saved line does not carry.
 */
export function mosaicBacksplashWasteInNote(qtyNote: string | null | undefined): string {
  if (!qtyNote) return "";
  const match = qtyNote.match(new RegExp(`includes\\s+\\d+%\\s+waste`, "i"));
  return match ? match[0].replace(/\s+/g, " ") : "";
}

/**
 * The same cart note with the waste sentence taken out, so the cart can show it once as its own
 * highlighted line instead of printing it twice.
 */
export function cartNoteWithoutMosaicWaste(qtyNote: string | null | undefined): string {
  if (!qtyNote) return "";
  return qtyNote
    .replace(new RegExp(`\\s*\\(includes\\s+\\d+%\\s+waste\\)`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
}

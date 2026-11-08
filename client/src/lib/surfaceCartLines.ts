import type { PricingTier } from "@shared/pricingTier";
import { flooringCartonFacts } from "@/lib/flooringCartonFacts";
import { flooringLayoutName, flooringOverageLabel, flooringOverageRate } from "@/lib/flooringLayout";
import type { FlooringLayoutPattern } from "@/lib/design";
import { isMosaicBacksplashPick, mosaicBacksplashWasteFactor, mosaicSheetSquareFeet, MOSAIC_BACKSPLASH_WASTE_NOTE, MOSAIC_BACKSPLASH_WASTE_PCT } from "@/lib/mosaicBacksplashWaste";
import { normalizeFinalMaterialSelections } from "@/lib/surfaceSelection";
import { isRangeTopSurfacePick } from "@/lib/rangeTopDisplayOnly";
import { surfaceRole } from "@/lib/pelican";

/** Minimal shape of a picked surface/fixture (subset of SelectedSurface). */
export type SurfacePick = {
  id: number;
  name: string;
  category: string;
  subCategory?: string | null;
  size?: string | null;
  sellPrice: number | null;
  /** Explicit active marker retained on legacy surface selections. */
  threeDActive?: boolean;
  /** Sq ft per box/carton for tile, backsplash, and flooring products. Empty on every Pelican mosaic, which is sold by the sheet. */
  coverageSqFt?: number | null;
  /** Supplier description. Flooring carton size is parsed from here when coverageSqFt is empty. */
  description?: string | null;
  /** Countertop assignment; legacy undefined applies the product to the combined design area. */
  countertopScope?: "perimeter" | "island" | "all";
  /** Mosaic installed from the floor picker. Category stays Tile & Mosaic. */
  installedAs?: "flooring" | "backsplash" | null;
};

/** Minimal cart line shape (subset of CartItem) produced for a surface pick. */
export type SurfaceCartLine = {
  masterCode: string;
  name: string;
  styleId: number;
  styleLabel: string;
  distributorId: number | null;
  tier: "wholesale" | "contractor" | "homeowner";
  unitPrice: number | null;
  /** Selected catalog surface prices are locked when the design is sent to cart. */
  priceLocked: true;
  /** Distinguishes Pelican surface/fixture products from cabinet catalog lines. */
  productKind: "surface";
  /** Exact Pelican catalog row needed to resolve source-backed shipping facts. */
  pelicanProductId: number;
  category: string;
  qty: number;
  /** When qty was auto-calculated from area, this note explains the math. */
  qtyNote?: string;
};

/**
 * Overage percentages by Pelican category.
 * - Mosaic / Backsplash tile: 15%
 * - Flooring: 10%
 * - Everything else: 0%
 *
 * A mosaic installed as the wall backsplash is the exception: the owner's rule puts 5% waste on it
 * instead (lib/mosaicBacksplashWaste.ts), applied in `buildSurfaceCartLines` before this table.
 */
const OVERAGE: Record<string, number> = {
  Backsplash: 0.15,
  Tile: 0.15,
  Mosaic: 0.15,
  Flooring: 0.10,
};

/** Return the overage factor (1.15 or 1.10) for a given category. */
function overageFor(category: string): number {
  // Check exact match first, then substring match for flexibility.
  if (OVERAGE[category] != null) return 1 + OVERAGE[category];
  const lower = category.toLowerCase();
  if (lower.includes("backsplash") || lower.includes("mosaic") || lower.includes("tile")) return 1.15;
  if (lower.includes("floor")) return 1.10;
  return 1;
}

/** Parse authoritative whole-slab dimensions such as 126" x 63" into square feet. */
export function countertopSlabSquareFeet(size: string | null | undefined): number | null {
  if (!size) return null;
  const match = size.match(/(\d+(?:\.\d+)?)\s*["”]?\s*[x×]\s*(\d+(?:\.\d+)?)\s*["”]?/i);
  if (!match) return null;
  const width = Number(match[1]);
  const depth = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) return null;
  return (width * depth) / 144;
}

/**
 * Area info passed from the Design Tool so we can compute box quantities.
 * All values in square feet.
 */
export type RoomAreas = {
  /** Total backsplash area (sq ft) — all exposed wall between counter and uppers. */
  backsplashSqFt: number;
  /** Total flooring area (sq ft) — room footprint. */
  flooringSqFt: number;
  /** Exact rendered countertop area (sq ft), including the configured island overhang. */
  countertopSqFt?: number;
  /** Exact rendered wall-run countertop area when materials are split by scope. */
  perimeterCountertopSqFt?: number;
  /** Exact rendered island countertop area when materials are split by scope. */
  islandCountertopSqFt?: number;
  /** Customer-chosen plank layout. Herringbone uses a higher waste factor. */
  flooringPattern?: FlooringLayoutPattern | null;
};

/**
 * Turn the Design Tool's picked Surfaces & Fixtures into cart line items so they
 * land on the shopping list. Pelican surfaces are a DIFFERENT supply line than
 * the cabinet distributor, so each line carries `distributorId: null` (it never
 * triggers the cabinet distributor-lock) and a `PEL-<id>` code namespace so it
 * can never collide with a cabinet masterCode.
 *
 * Tile, backsplash, and flooring products with `coverageSqFt` use:
 *   boxes = ceil( area × overageFactor / coverageSqFt )
 *
 * A MOSAIC backsplash is the one exception to the tile overage: its factor is 1.05 (5% waste),
 * per the owner's rule in lib/mosaicBacksplashWaste.ts. Field tile keeps 1.15.
 *
 * Countertop products use their authoritative stored whole-slab dimensions:
 *   slabs = ceil( exact rendered countertop area / slab square feet )
 *
 * Otherwise quantity defaults to 1 per selected product.
 * Unpriced (quote-only) picks are skipped.
 */
export function buildSurfaceCartLines(
  surfaces: SurfacePick[],
  tier: "wholesale" | "contractor" | "homeowner",
  areas?: RoomAreas | null,
  /** Explicit fixture quantities keyed by source product ID; zero suppresses stale selections. */
  fixtureQuantities?: ReadonlyMap<number, number> | null,
): SurfaceCartLine[] {
  const lines: SurfaceCartLine[] = [];
  // A replaced flooring or backsplash product is not part of the final kitchen.
  // Normalize defensively here as well as in the Designer state so stale saved
  // selections cannot leak into cart pricing or checkout.
  const normalized = normalizeFinalMaterialSelections(surfaces);
  const sharedIds = new Set<number>();
  const seenIds = new Set<number>();
  for (const surface of normalized) {
    if (seenIds.has(surface.id)) sharedIds.add(surface.id);
    seenIds.add(surface.id);
  }
  for (const s of normalized) {
    // Owner rule (Tom): a range top in the Surfaces & Fixtures list is displayed
    // (and rendered) but is never sold, so it contributes no cart, quote, or
    // order line — the same way an auto-filled faucet is drawn at qty 0.
    if (isRangeTopSurfacePick(s)) continue;
    if (s.sellPrice == null) continue; // skip unpriced (quote-only) picks
    const label = s.size ? `${s.category} · ${s.size}` : s.category;
    let qty = 1;
    let qtyNote: string | undefined;
    if (fixtureQuantities?.has(s.id)) {
      qty = Math.max(0, Math.floor(fixtureQuantities.get(s.id) ?? 0));
      if (qty === 0) continue;
      qtyNote = `${qty} installed ${qty === 1 ? "fixture" : "fixtures"}`;
    }
    const cat = s.category.toLowerCase();
    // Pelican flooring trim is a separately selected quoted item, not an
    // installed floor material. Only source-classified Planks & Flooring use
    // room area and overage to calculate carton quantity. A mosaic installed
    // as the floor uses the floor area, not the wall-tile area.
    const isFlooring = surfaceRole(s) === "flooring";
    const isBacksplash = !isFlooring && (cat.includes("backsplash") || cat.includes("mosaic") || cat.includes("tile"));
    const isCountertop = cat.includes("countertop") || cat.includes("quartz slab");

    if (!fixtureQuantities?.has(s.id) && areas && isCountertop) {
      const rawArea = s.countertopScope === "perimeter"
        ? areas.perimeterCountertopSqFt ?? areas.countertopSqFt ?? 0
        : s.countertopScope === "island"
          ? areas.islandCountertopSqFt ?? areas.countertopSqFt ?? 0
          : areas.countertopSqFt ?? 0;
      const slabSqFt = countertopSlabSquareFeet(s.size);
      if (rawArea > 0 && slabSqFt) {
        qty = Math.ceil(rawArea / slabSqFt);
        const scopeNote = s.countertopScope === "perimeter" ? " wall-run" : s.countertopScope === "island" ? " island" : "";
        qtyNote = `${rawArea.toFixed(1)} sq ft${scopeNote} ÷ ${slabSqFt.toFixed(1)} sq ft/slab = ${qty} ${qty === 1 ? "slab" : "slabs"}`;
      }
    } else if (!fixtureQuantities?.has(s.id) && areas && (isBacksplash || isFlooring)) {
      const carton = isFlooring
        ? flooringCartonFacts(s)
        : null;
      const coverageSqFt = isFlooring
        ? carton?.sqFtPerBox ?? null
        : (s.coverageSqFt && s.coverageSqFt > 0 ? s.coverageSqFt : null);
      const rawArea = isBacksplash ? areas.backsplashSqFt : isFlooring ? areas.flooringSqFt : 0;
      // Owner rule (Tom): mosaic backsplash carries 5% waste, not the 15% tile overage.
      const mosaicBacksplash = isBacksplash && isMosaicBacksplashPick(s);
      // A mosaic is sold by the sheet. Its catalog row has the published sheet size but no
      // coverageSqFt, so the per-unit area comes from that sheet size; a structured coverage value
      // still wins when the vendor has entered one.
      const sheetSqFt = mosaicBacksplash
        ? (s.coverageSqFt && s.coverageSqFt > 0 ? null : mosaicSheetSquareFeet(s))
        : null;
      const unitSqFt = coverageSqFt ?? sheetSqFt;
      const unitLabel = sheetSqFt ? "sheet" : "box";
      if (rawArea > 0 && unitSqFt) {
        const factor = isFlooring
          ? 1 + flooringOverageRate(areas.flooringPattern)
          : mosaicBacksplash
            ? mosaicBacksplashWasteFactor()
            : overageFor(s.category);
        const pct = Math.round((factor - 1) * 100);
        qty = Math.ceil((rawArea * factor) / unitSqFt);
        const overageNote = pct > 0 ? ` × ${pct}% overage` : "";
        const layoutNote = isFlooring
          ? flooringLayoutName(areas.flooringPattern)
            ? `Layout: ${flooringLayoutName(areas.flooringPattern)}. `
            : "Layout not chosen. "
          : "";
        const piecesNote = carton?.piecesPerBox ? `${carton.piecesPerBox} pieces/box · ` : "";
        const unitSuffix = qty === 1 ? unitLabel : unitLabel === "box" ? "boxes" : "sheets";
        qtyNote = `${layoutNote}${piecesNote}${rawArea.toFixed(1)} sq ft${overageNote} ÷ ${unitSqFt} sq ft/${unitLabel} = ${qty} ${unitSuffix}`;
        if (mosaicBacksplash) qtyNote += ` (${MOSAIC_BACKSPLASH_WASTE_NOTE})`;
        if (isFlooring && areas.flooringPattern === "herringbone") {
          qtyNote += ` (herringbone waste ${flooringOverageLabel(areas.flooringPattern)}, other layouts ${flooringOverageLabel(null)})`;
        }
      } else if (isFlooring && rawArea > 0) {
        const layout = flooringLayoutName(areas.flooringPattern);
        qtyNote = layout
          ? `Layout: ${layout}. Sq ft per box was not on this product, so box count was not calculated.`
          : "Layout not chosen. Sq ft per box was not on this product, so box count was not calculated.";
      } else if (mosaicBacksplash && rawArea > 0) {
        // Neither a box coverage nor a published sheet size, so there is nothing to convert the
        // 5% waste into. Say so instead of claiming waste the quantity does not carry.
        qtyNote = `${rawArea.toFixed(1)} sq ft. Sq ft per box was not on this product, so the ${Math.round(MOSAIC_BACKSPLASH_WASTE_PCT * 100)}% mosaic waste could not be added to a unit count.`;
      }
    }

    const floorAndWall = sharedIds.has(s.id) && isFlooring;
    lines.push({
      masterCode: floorAndWall ? `PEL-${s.id}-floor` : `PEL-${s.id}`,
      name: s.name,
      styleId: floorAndWall ? -(1_000_000 + s.id) : -s.id, // stable + unique so two picks never collapse
      styleLabel: label,
      distributorId: null,
      tier,
      unitPrice: s.sellPrice,
      priceLocked: true,
      productKind: "surface",
      pelicanProductId: s.id,
      category: s.category,
      qty,
      ...(qtyNote ? { qtyNote } : {}),
    });
  }
  return lines;
}

// Re-export the design-tier mapping type for callers that need it.
export type { PricingTier };

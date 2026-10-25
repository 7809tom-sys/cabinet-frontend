import type { PricingTier } from "@shared/pricingTier";
import { normalizeFinalMaterialSelections } from "@/lib/surfaceSelection";
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
  /** Sq ft per box/carton for tile, backsplash, and flooring products. */
  coverageSqFt?: number | null;
  /** Countertop assignment; legacy undefined applies the product to the combined design area. */
  countertopScope?: "perimeter" | "island" | "all";
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
  for (const s of normalizeFinalMaterialSelections(surfaces)) {
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
    const isBacksplash = cat.includes("backsplash") || cat.includes("mosaic") || cat.includes("tile");
    // Pelican flooring trim is a separately selected quoted item, not an
    // installed floor material. Only source-classified Planks & Flooring use
    // room area and overage to calculate carton quantity.
    const isFlooring = surfaceRole(s) === "flooring";
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
    } else if (!fixtureQuantities?.has(s.id) && areas && s.coverageSqFt && s.coverageSqFt > 0) {
      const rawArea = isBacksplash ? areas.backsplashSqFt : isFlooring ? areas.flooringSqFt : 0;
      if (rawArea > 0 && (isBacksplash || isFlooring)) {
        const factor = overageFor(s.category);
        const pct = Math.round((factor - 1) * 100);
        qty = Math.ceil((rawArea * factor) / s.coverageSqFt);
        const overageNote = pct > 0 ? ` × ${pct}% overage` : "";
        qtyNote = `${rawArea.toFixed(1)} sq ft${overageNote} ÷ ${s.coverageSqFt} sq ft/box = ${qty} boxes`;
      }
    }

    lines.push({
      masterCode: `PEL-${s.id}`,
      name: s.name,
      styleId: -s.id, // stable + unique so two picks never collapse
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

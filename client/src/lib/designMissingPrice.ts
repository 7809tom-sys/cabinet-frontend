/**
 * Part 1 — no unpriced cabinet on a material list.
 *
 * Shared between the 3D Designer and the Continuous Wall Builder (one engine).
 * A placed cabinet is "missing a price" when the active line's price lookup
 * (which already walks the Part 2 two-way equivalence group on the server)
 * returned nothing for it. Appliances, closet placeholder parts, and
 * Designer-only visuals are not sold from the cabinet price list and are not
 * flagged here; they follow their own quote rules.
 */
import type { PlacedCabinet } from "./design";
import { isApplianceCode } from "./design";
import { isClosetPart } from "./closet";

export type MissingPriceFlag = {
  uid: string;
  cabinetId: number;
  masterCode: string;
  description: string;
  styleId: number | null;
};

export type MissingPriceSummary = {
  flags: MissingPriceFlag[];
  uids: Set<string>;
  /** Distinct codes missing a price (for the banner and admin log). */
  codes: string[];
  count: number;
};

export function isPriceRequiredPlacedCabinet(cabinet: PlacedCabinet): boolean {
  if (!cabinet.masterCode) return false;
  if (isApplianceCode(cabinet.masterCode)) return false;
  if (isClosetPart(cabinet.masterCode)) return false;
  // Secondary halves of a split filler are billed through their primary.
  if (cabinet.fillerBillingRole === "secondary") return false;
  // Designer-only layout visuals (no SKU) carry cabinetId 0.
  if (!cabinet.cabinetId || cabinet.cabinetId <= 0) return false;
  return true;
}

export function summarizeMissingPrices(args: {
  placed: readonly PlacedCabinet[];
  /** Whether a style/line is selected at all; nothing can be priced without one. */
  styleId: number | null;
  /** True once the price query has returned for the current pair set. */
  pricesReady: boolean;
  unitPriceFor: (cabinet: PlacedCabinet) => number | null;
  styleIdFor: (cabinet: PlacedCabinet) => number | null;
}): MissingPriceSummary {
  const flags: MissingPriceFlag[] = [];
  const uids = new Set<string>();
  const codes = new Set<string>();
  if (!args.styleId || !args.pricesReady) {
    return { flags, uids, codes: [], count: 0 };
  }
  for (const cabinet of args.placed) {
    if (!isPriceRequiredPlacedCabinet(cabinet)) continue;
    const price = args.unitPriceFor(cabinet);
    if (price != null && Number.isFinite(price) && price > 0) continue;
    flags.push({
      uid: cabinet.uid,
      cabinetId: cabinet.cabinetId,
      masterCode: cabinet.masterCode,
      description: cabinet.description,
      styleId: args.styleIdFor(cabinet),
    });
    uids.add(cabinet.uid);
    codes.add(cabinet.masterCode);
  }
  return { flags, uids, codes: Array.from(codes), count: flags.length };
}

export function missingPriceBannerText(count: number): string {
  return `${count} cabinet${count === 1 ? "" : "s"} missing price${count === 1 ? "" : "s"}.`;
}

export function missingPriceLineLabel(masterCode: string): string {
  return `PRICE MISSING — ${masterCode}`;
}

/** Checkout is blocked while any flag is open; saving the design is still allowed. */
export function checkoutBlockedByMissingPrices(summary: Pick<MissingPriceSummary, "count">): boolean {
  return summary.count > 0;
}

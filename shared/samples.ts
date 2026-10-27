/**
 * Physical door samples and sample kits.
 *
 * Ordering is back-office only (admin, or an affiliate for their own
 * customers/showroom). Nothing here is published to the public catalog or
 * the customer cart.
 *
 * Kit and sample prices are the amount charged, as entered (including free).
 * They are not vendor wholesale and they do not pass through the site-wide
 * retail multiplier.
 */

import { VENDOR_FEATURE_SAMPLES, isCabinetVendorScope, vendorFeatureEnabled } from "./vendorFeatures";

/** Catalog master kept out of the 3D Designer. Link to it; do not create another. */
export const EXISTING_SAMPLE_DOOR_MASTER_CODE = "SD";

export type SampleOrderChannel = "storefront" | "cart" | "backoffice";

/** Sample prices and ordering stay off the public storefront and the customer cart. */
export function mayExposeSampleToPublicCustomer(_channel: SampleOrderChannel): boolean {
  return false;
}

export function sampleOrderingChannelAllowed(channel: SampleOrderChannel): boolean {
  return channel === "backoffice";
}

export type SampleActor = {
  role: string | null | undefined;
  affiliateId?: number | null;
  isAffiliateMember?: boolean;
};

/** Admin, or a signed-in affiliate member. Public customers and vendors cannot place these orders. */
export function canPlaceSampleOrder(actor: SampleActor): boolean {
  if (actor.role === "admin") return true;
  return Boolean(actor.isAffiliateMember && actor.affiliateId != null && actor.affiliateId > 0);
}

export function sampleOrderAffiliateId(actor: SampleActor, requestedAffiliateId?: number | null): number | null {
  if (!canPlaceSampleOrder(actor)) {
    throw new Error("PUBLIC_CUSTOMER");
  }
  if (actor.role === "admin") {
    return requestedAffiliateId != null && requestedAffiliateId > 0 ? requestedAffiliateId : null;
  }
  return actor.affiliateId ?? null;
}

export type SampleOrderView = {
  id: number;
  affiliateId: number | null;
  distributorIds: number[];
};

export function visibleSampleOrders<T extends SampleOrderView>(
  orders: readonly T[],
  viewer: { role: "admin" | "affiliate" | "vendor" | "customer"; affiliateId?: number | null; distributorId?: number | null },
): T[] {
  if (viewer.role === "admin") return [...orders];
  if (viewer.role === "affiliate") {
    return orders.filter((order) => order.affiliateId != null && order.affiliateId === viewer.affiliateId);
  }
  if (viewer.role === "vendor") {
    return orders.filter((order) => viewer.distributorId != null && order.distributorIds.includes(viewer.distributorId));
  }
  return [];
}

export type SampleLineClaim = {
  masterCode?: string | null;
  description?: string | null;
  sampleOfferId?: number | null;
  sampleKitId?: number | null;
};

export function lineClaimsSample(line: SampleLineClaim): boolean {
  if (line.sampleOfferId != null || line.sampleKitId != null) return true;
  const code = (line.masterCode ?? "").trim().toUpperCase();
  if (code === EXISTING_SAMPLE_DOOR_MASTER_CODE || code.startsWith("SAMPLE-KIT")) return true;
  return /\bsample door\b/i.test(line.description ?? "") || /\bsample kit\b/i.test(line.description ?? "");
}

/** Price as entered. Free is 0. Not multiplied. */
export function sampleChargePrice(input: { price?: number | string | null; free?: boolean }): number {
  if (input.free) return 0;
  if (input.price == null || input.price === "") return 0;
  const n = Number(input.price);
  if (!Number.isFinite(n) || n < 0) throw new Error("INVALID_SAMPLE_PRICE");
  return Math.round(n * 100) / 100;
}

export type SampleDoorCatalogRow = {
  id: number;
  masterCode: string;
  distributorId: number | null;
  showInDesigner?: boolean | null;
  showInCatalog?: boolean | null;
  description?: string | null;
};

/**
 * Find an existing sample-door catalog row for this vendor. Never invents a
 * new cabinet. The known SD master is preferred; any other match must already
 * be kept out of the designer.
 */
export function resolveSampleDoorLink(
  catalog: readonly SampleDoorCatalogRow[],
  distributorId: number,
  requestedSku?: string | null,
): { cabinetId: number; masterCode: string } | null {
  const wanted = (requestedSku ?? EXISTING_SAMPLE_DOOR_MASTER_CODE).trim().toUpperCase();
  const own = catalog.filter((row) => row.distributorId === distributorId);
  const exact = own.find((row) => row.masterCode.trim().toUpperCase() === wanted);
  if (!exact) return null;
  const code = exact.masterCode.trim().toUpperCase();
  const keptOutOfDesigner = exact.showInDesigner === false || code === EXISTING_SAMPLE_DOOR_MASTER_CODE;
  if (!keptOutOfDesigner) return null;
  return { cabinetId: exact.id, masterCode: exact.masterCode };
}

export function samplesTabEnabled(input: { scope: string | null | undefined; enabledFeatures?: readonly string[] | null }): boolean {
  return vendorFeatureEnabled(VENDOR_FEATURE_SAMPLES, input) && isCabinetVendorScope(input.scope);
}

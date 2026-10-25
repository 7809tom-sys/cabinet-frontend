/**
 * Vendor order fulfillment rules shared by the server router and the vendor
 * portal. Everything here is pure so it can be tested without a database.
 *
 * One customer order can mix cabinets from one or more distributors, Pelican
 * surfaces/fixtures and Hardware Resources. Each of those vendors ships its own
 * boxes, so fulfillment is tracked per (order, vendor scope) where a scope is
 * either "pelican" or "dist:<distributorId>".
 */

export const PELICAN_SCOPE = "pelican" as const;

export type VendorScope = typeof PELICAN_SCOPE | `dist:${number}`;

export function distributorScope(distributorId: number): VendorScope {
  return `dist:${distributorId}`;
}

/** Parse and validate a scope string; returns null for anything malformed. */
export function parseVendorScope(value: unknown): VendorScope | null {
  if (typeof value !== "string") return null;
  if (value === PELICAN_SCOPE) return PELICAN_SCOPE;
  const match = /^dist:([1-9][0-9]{0,9})$/.exec(value);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? distributorScope(id) : null;
}

export type FulfillmentLineInput = {
  masterCode?: string | null;
  rawCode?: string | null;
  description?: string | null;
  qty?: number | null;
  productKind?: "surface" | "hardware" | null;
  distributorId?: number | null;
  doorStyle?: string | null;
};

/**
 * Which vendor supplies one saved order line.
 *  - Pelican surfaces/fixtures are the only "surface" lines.
 *  - Hardware lines belong to the Hardware Resources supply line.
 *  - Cabinet lines belong to the line chosen in the cart, falling back to the
 *    distributor the affiliate rail resolved for the order.
 * Returns null when the supplier cannot be determined; such a line is never
 * shown to any vendor rather than guessed.
 */
export function lineVendorScope(
  line: FulfillmentLineInput,
  ctx: { orderDistributorId: number | null; hardwareDistributorId: number | null },
): VendorScope | null {
  if (line.productKind === "surface") return PELICAN_SCOPE;
  if (line.productKind === "hardware") {
    return ctx.hardwareDistributorId != null ? distributorScope(ctx.hardwareDistributorId) : null;
  }
  const distributorId = line.distributorId ?? ctx.orderDistributorId;
  return distributorId != null && distributorId > 0 ? distributorScope(distributorId) : null;
}

export type VendorFulfillmentItem = {
  sku: string;
  description: string;
  qty: number;
  doorStyle: string | null;
};

/** Split an order's lines by supplying vendor, preserving line order. */
export function groupLinesByVendorScope(
  lines: readonly FulfillmentLineInput[],
  ctx: { orderDistributorId: number | null; hardwareDistributorId: number | null },
): Map<VendorScope, VendorFulfillmentItem[]> {
  const grouped = new Map<VendorScope, VendorFulfillmentItem[]>();
  for (const line of lines) {
    const scope = lineVendorScope(line, ctx);
    if (!scope) continue;
    const qty = Number(line.qty);
    const item: VendorFulfillmentItem = {
      sku: String(line.masterCode ?? line.rawCode ?? "").trim() || "—",
      description: String(line.description ?? "").trim(),
      qty: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1,
      doorStyle: line.doorStyle ? String(line.doorStyle) : null,
    };
    const bucket = grouped.get(scope);
    if (bucket) bucket.push(item);
    else grouped.set(scope, [item]);
  }
  return grouped;
}

export type FulfillmentOrderState = {
  status: string;
  paidAt: Date | string | null;
  orderRailStatus: string;
};

export type FulfillmentStage = "ready" | "upcoming" | "hidden";

/**
 * A vendor may ship only after Stripe payment AND the official order rail has
 * authorized fulfillment. Paid orders still moving through affiliate approval
 * or the distributor inventory check are visible as "upcoming" (read-only);
 * unpaid, draft and cancelled orders are never shown.
 */
export function fulfillmentStage(order: FulfillmentOrderState): FulfillmentStage {
  if (order.status !== "confirmed" || !order.paidAt) return "hidden";
  return order.orderRailStatus === "fulfillment_authorized" ? "ready" : "upcoming";
}

const UPCOMING_LABELS: Record<string, string> = {
  affiliate_review: "Waiting for affiliate approval",
  distributor_inventory_check: "Waiting for distributor inventory check",
  affiliate_invoice_review: "Waiting for affiliate invoice approval",
  awaiting_payment: "Waiting for payment",
};

/**
 * Plain-words reason an order cannot ship yet. An order with no affiliate has
 * nobody to give "affiliate approval", so saying that would send the vendor
 * chasing the wrong person; it is waiting on Cabinet Dealz to release it.
 */
export function upcomingStageLabel(orderRailStatus: string, opts?: { hasAffiliate?: boolean }): string {
  if (orderRailStatus === "affiliate_review" && opts?.hasAffiliate === false) {
    return "Waiting for Cabinet Dealz to release this order";
  }
  return UPCOMING_LABELS[orderRailStatus] ?? "Waiting for release";
}

// ─── Carriers and tracking ──────────────────────────────────────────────────

export const CARRIER_OPTIONS = [
  "UPS",
  "FedEx",
  "USPS",
  "DHL",
  "LTL freight",
  "Vendor truck / own delivery",
  "Customer pickup",
] as const;

/** Carriers that never have a trackable number. */
const NO_TRACKING_CARRIERS = new Set(["customer pickup", "vendor truck / own delivery"]);

export function carrierNeedsTracking(carrier: string): boolean {
  return !NO_TRACKING_CARRIERS.has(carrier.trim().toLowerCase());
}

/** Upper-case a tracking number and strip spaces/dashes people paste in. */
export function normalizeTrackingNumber(value: string): string {
  return value.replace(/[\s]+/g, "").toUpperCase();
}

export function isValidTrackingNumber(value: string): boolean {
  return /^[A-Z0-9-]{4,40}$/.test(normalizeTrackingNumber(value));
}

/** Public carrier tracking page for a shipment, or null for unknown carriers. */
export function trackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  const number = normalizeTrackingNumber(trackingNumber ?? "");
  if (!number || !isValidTrackingNumber(number)) return null;
  const name = (carrier ?? "").trim().toLowerCase();
  const encoded = encodeURIComponent(number);
  if (name === "ups") return `https://www.ups.com/track?tracknum=${encoded}`;
  if (name === "fedex") return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
  if (name === "usps") return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
  if (name === "dhl") return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encoded}`;
  return null;
}

export type ShipmentInputCheck =
  | { ok: true; carrier: string; trackingNumber: string | null; packageCount: number }
  | { ok: false; message: string };

/** Validate what a vendor must provide before an order can be marked shipped. */
export function validateShipment(input: {
  carrier?: string | null;
  trackingNumber?: string | null;
  packageCount?: number | null;
}): ShipmentInputCheck {
  const carrier = (input.carrier ?? "").trim();
  if (carrier.length < 2) return { ok: false, message: "Choose the carrier before marking this order shipped." };
  if (carrier.length > 64) return { ok: false, message: "Carrier name is too long." };
  const packageCount = Math.floor(Number(input.packageCount ?? 1));
  if (!Number.isFinite(packageCount) || packageCount < 1 || packageCount > 99) {
    return { ok: false, message: "Package count must be between 1 and 99." };
  }
  const rawTracking = (input.trackingNumber ?? "").trim();
  if (carrierNeedsTracking(carrier)) {
    if (!rawTracking) return { ok: false, message: "Enter the tracking number before marking this order shipped." };
    if (!isValidTrackingNumber(rawTracking)) {
      return { ok: false, message: "That tracking number looks wrong. Use 4–40 letters, numbers or dashes." };
    }
  } else if (rawTracking && !isValidTrackingNumber(rawTracking)) {
    return { ok: false, message: "That tracking number looks wrong. Use 4–40 letters, numbers or dashes." };
  }
  return {
    ok: true,
    carrier,
    trackingNumber: rawTracking ? normalizeTrackingNumber(rawTracking) : null,
    packageCount,
  };
}

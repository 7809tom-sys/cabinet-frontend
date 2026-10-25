// Pure, dependency-free helpers for distributor order fulfillment:
//   1. buildNetsuiteOrderCsv() — a NetSuite-ready Sales/Purchase-Order CSV that a
//      distributor running NetSuite can ingest via CSV Import (Transactions →
//      Sales Orders). One header row + one row per line item, using the widely
//      supported NetSuite CSV column names. This is the "netsuite_email" path.
//   2. pickup helpers — decide whether a distributor's pickup location is close
//      enough to a customer's delivery ZIP to offer local pickup.
//
// Keeping these pure (no DB / no network) makes them trivially unit-testable and
// reusable on both client and server.

import { approxZipCentroid, haversineMiles, normalizeZip, type LatLng } from "./availability";

// ─── NetSuite-ready PO CSV ─────────────────────────────────────────────────────

export interface NetsuiteOrderLine {
  /** The PO SKU we send the distributor, e.g. "usd-sw-3db24". Falls back to master/raw code. */
  poSku?: string | null;
  masterCode?: string | null;
  rawCode?: string | null;
  description?: string | null;
  qty: number;
  unitPrice?: number | null;
}

export interface NetsuiteOrderHeader {
  /** Our order number, becomes NetSuite External ID / PO # so it is idempotent. */
  orderNumber: string;
  /** Customer / originator name for reference. */
  customerName?: string | null;
  /** Door style / finish reference line. */
  styleName?: string | null;
  /** ship | pickup — surfaced so the distributor knows the fulfillment intent. */
  deliveryMethod?: "ship" | "pickup" | null;
  /** ISO date string; defaults to today (UTC) when omitted. */
  orderDate?: string | null;
}

/** RFC-4180 style cell escaping: wrap in quotes if it contains comma/quote/newline. */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** The column order used for the NetSuite CSV import mapping. */
export const NETSUITE_CSV_COLUMNS = [
  "External ID",
  "PO Number",
  "Order Date",
  "Customer",
  "Fulfillment",
  "Door Style",
  "Item",
  "Description",
  "Quantity",
  "Rate",
  "Amount",
] as const;

function resolveSku(line: NetsuiteOrderLine): string {
  return (line.poSku || line.masterCode || line.rawCode || "").toString().trim();
}

/**
 * Build a NetSuite-ready CSV string. The External ID + PO Number repeat the
 * order number on every line so NetSuite groups the rows into one transaction
 * on import. Amount is computed as qty * unitPrice when a price is present.
 */
export function buildNetsuiteOrderCsv(
  header: NetsuiteOrderHeader,
  lines: NetsuiteOrderLine[]
): string {
  const orderDate =
    (header.orderDate && header.orderDate.slice(0, 10)) ||
    new Date().toISOString().slice(0, 10);
  const rows: string[] = [];
  rows.push(NETSUITE_CSV_COLUMNS.map(csvCell).join(","));

  for (const line of lines) {
    const sku = resolveSku(line);
    const qty = Number.isFinite(line.qty) ? line.qty : 0;
    const rate = line.unitPrice ?? null;
    const amount = rate != null ? Number((rate * qty).toFixed(2)) : null;
    rows.push(
      [
        header.orderNumber,
        header.orderNumber,
        orderDate,
        header.customerName ?? "",
        header.deliveryMethod === "pickup" ? "Pickup" : "Ship",
        header.styleName ?? "",
        sku,
        line.description ?? "",
        qty,
        rate != null ? rate.toFixed(2) : "",
        amount != null ? amount.toFixed(2) : "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return rows.join("\r\n");
}

/** A concise, human-readable PO body (plain text) that accompanies the CSV. */
export function buildOrderEmailText(
  header: NetsuiteOrderHeader,
  lines: NetsuiteOrderLine[],
  opts?: { distributorName?: string; pickupAddress?: string | null; totalAmount?: string | null }
): string {
  const out: string[] = [];
  out.push(`Purchase Order: ${header.orderNumber}`);
  if (opts?.distributorName) out.push(`Distributor: ${opts.distributorName}`);
  if (header.customerName) out.push(`Reference: ${header.customerName}`);
  if (header.styleName) out.push(`Door Style / Finish: ${header.styleName}`);
  out.push(
    `Fulfillment: ${header.deliveryMethod === "pickup" ? "Local pickup" : "Ship"}`
  );
  if (header.deliveryMethod === "pickup" && opts?.pickupAddress) {
    out.push(`Pickup location: ${opts.pickupAddress}`);
  }
  out.push("");
  out.push("Line items:");
  for (const line of lines) {
    const sku = resolveSku(line);
    const price = line.unitPrice != null ? ` @ $${line.unitPrice.toFixed(2)}` : "";
    out.push(`  ${line.qty} x  ${sku}  — ${line.description ?? ""}${price}`);
  }
  if (opts?.totalAmount) {
    out.push("");
    out.push(`Order total: $${opts.totalAmount}`);
  }
  out.push("");
  out.push("A NetSuite-ready CSV of this order is attached.");
  return out.join("\n");
}

// ─── Pickup eligibility ────────────────────────────────────────────────────────

export interface PickupCandidate {
  distributorId: number;
  displayName: string;
  pickupEnabled: boolean;
  pickupRadiusMiles: number;
  /** Explicit pickup ZIP; when absent we fall back to the first warehouse ZIP. */
  pickupZip?: string | null;
  pickupAddress?: string | null;
  warehouseZips?: string[] | null;
}

export interface PickupOption {
  distributorId: number;
  displayName: string;
  pickupAddress: string | null;
  originZip: string;
  distanceMiles: number;
  radiusMiles: number;
}

/**
 * Compute the origin ZIP a pickup distance should be measured from: the explicit
 * pickupZip if set, otherwise the first usable warehouse ZIP.
 */
export function resolvePickupOriginZip(c: PickupCandidate): string | null {
  const explicit = normalizeZip(c.pickupZip);
  if (explicit) return explicit;
  for (const z of c.warehouseZips ?? []) {
    const n = normalizeZip(z);
    if (n) return n;
  }
  return null;
}

/**
 * Decide whether a candidate distributor can offer pickup to a given delivery
 * ZIP. `customerCoord` may be supplied by the server (precise geocode); when
 * omitted we approximate from the ZIP3 centroid table. Returns the option with
 * the measured distance when eligible, else null.
 */
export function evaluatePickup(
  c: PickupCandidate,
  deliveryZip: string,
  customerCoord?: LatLng | null,
  originCoord?: LatLng | null
): PickupOption | null {
  if (!c.pickupEnabled) return null;
  const originZip = resolvePickupOriginZip(c);
  if (!originZip) return null;

  const customer = customerCoord ?? approxZipCentroid(deliveryZip);
  const origin = originCoord ?? approxZipCentroid(originZip);
  if (!customer || !origin) return null;

  const distance = haversineMiles(customer, origin);
  const radius = c.pickupRadiusMiles > 0 ? c.pickupRadiusMiles : 100;
  if (distance > radius) return null;

  return {
    distributorId: c.distributorId,
    displayName: c.displayName,
    pickupAddress: c.pickupAddress ?? null,
    originZip,
    distanceMiles: Math.round(distance * 10) / 10,
    radiusMiles: radius,
  };
}

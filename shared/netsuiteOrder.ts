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
import {
  buildPoDocument,
  buildPoText,
  type PoLineInput,
  type PoTotalsInput,
} from "./poDocument";

// ─── NetSuite-ready PO CSV ─────────────────────────────────────────────────────

export interface NetsuiteOrderLine extends PoLineInput {
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

/** NetSuite column rows for one PO, with Rate/Amount taken from the shared PO math. */
function netsuiteRows(header: NetsuiteOrderHeader, lines: NetsuiteOrderLine[]): string[] {
  const doc = buildPoDocument({
    orderNumber: header.orderNumber,
    orderDate: header.orderDate,
    customerName: header.customerName,
    styleName: header.styleName,
    deliveryMethod: header.deliveryMethod,
    lines: lines.map((line, index) => ({ ...line, sku: resolveSku(line) || `line-${index + 1}` })),
  });
  return doc.lines.map((line) => [
    header.orderNumber,
    header.orderNumber,
    doc.orderDate,
    doc.customerName ?? "",
    doc.deliveryMethod === "pickup" ? "Pickup" : "Ship",
    doc.styleName ?? "",
    line.sku,
    line.description,
    line.qty,
    line.unitPriceCents != null ? (line.unitPriceCents / 100).toFixed(2) : "",
    line.lineTotalCents != null ? (line.lineTotalCents / 100).toFixed(2) : "",
  ].map(csvCell).join(","));
}

/**
 * Build a NetSuite-ready CSV string. The External ID + PO Number repeat the
 * order number on every line so NetSuite groups the rows into one transaction
 * on import. Rate and Amount come from the shared PO builder, so a distributor
 * import carries the same unit price and line total as the emailed PO body.
 */
export function buildNetsuiteOrderCsv(
  header: NetsuiteOrderHeader,
  lines: NetsuiteOrderLine[]
): string {
  const rows = [NETSUITE_CSV_COLUMNS.map(csvCell).join(","), ...netsuiteRows(header, lines)];
  return rows.join("\r\n");
}

/**
 * A concise, human-readable PO body (plain text) that accompanies the CSV.
 * Delegates to the shared PO text so the body, the CSV and the admin PO view
 * print identical unit prices, line totals and summary rows.
 */
export function buildOrderEmailText(
  header: NetsuiteOrderHeader,
  lines: NetsuiteOrderLine[],
  opts?: {
    distributorName?: string;
    pickupAddress?: string | null;
    /** Retained for callers that pass the stored order total; totals are now derived from the lines. */
    totalAmount?: string | null;
    totals?: PoTotalsInput;
    footer?: string | null;
  }
): string {
  const doc = buildPoDocument({
    orderNumber: header.orderNumber,
    orderDate: header.orderDate,
    customerName: header.customerName,
    styleName: header.styleName,
    deliveryMethod: header.deliveryMethod,
    distributorName: opts?.distributorName ?? null,
    pickupAddress: opts?.pickupAddress ?? null,
    ...(opts?.totals ?? {}),
    lines: lines.map((line, index) => ({ ...line, sku: resolveSku(line) || `line-${index + 1}` })),
  });
  const footer = opts?.footer ?? "A NetSuite-ready CSV of this order is attached.";
  return buildPoText(doc, { footer });
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

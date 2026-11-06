/**
 * The Order Status report: one row per order with its five-step status chain,
 * the four count tiles above it, and the filters that drive them.
 *
 * Everything here is pure so the counting, filtering and "stuck" arithmetic is
 * testable without a browser or a database. The component only renders what
 * these functions return.
 *
 * Every step needs a who and a when. The 0227 columns supply the timestamps and
 * the *By columns the actor; `distributorEmailSentBy` comes from 0251.
 */

import { centralDaysSince, formatCentralTime, orderActorName } from "./orderStatusActor";

export type OrderStatusStepKey =
  | "order_received_email"
  | "distributor_email"
  | "verified"
  | "shipped"
  | "signed";

export type OrderStatusStep = {
  key: OrderStatusStepKey;
  label: string;
  done: boolean;
  /** ISO timestamp the step happened, or null while it is waiting. */
  at: string | null;
  /** Who did it — "Dana Reaves", "system", or a distributor name. */
  by: string | null;
  /** Extra detail for shipped: "FedEx · 1Z999". */
  detail: string | null;
};

export type OrderStatusRow = {
  id: number;
  orderNumber: string;
  customer: string | null;
  customerEmail: string | null;
  distributor: string | null;
  /**
   * Which affiliate's site the order came from: the name, plus the site or
   * subdomain it was placed on. Null means a direct/house order — the report
   * prints "—" rather than guessing. This is NOT the dealer.
   */
  affiliate: string | null;
  affiliateName: string | null;
  affiliateSite: string | null;
  /** The dealer account that placed the order (pricing tier / customer account). */
  dealer: string | null;
  /** How many line items the order has. */
  itemCount: number;
  /** Customer-facing order total, in cents. */
  totalCents: number | null;
  /** What the distributor charges us, in cents — admin-only. */
  distributorCostCents: number | null;
  /** customer total − distributor cost, in cents — admin-only. */
  marginCents: number | null;
  paymentStatus: OrderPaymentStatus;
  createdAt: string | null;
  steps: OrderStatusStep[];
  /** Furthest reached step, for the tiles and the chain colouring. */
  furthest: OrderStatusStepKey | "none";
  /** When the furthest step happened — the clock "stuck" is measured from. */
  lastStepAt: string | null;
};

export type OrderPaymentStatus = "paid" | "unpaid" | "refunded";

export type OrderStatusBucket =
  | "awaiting_verification"
  | "verified_not_shipped"
  | "shipped_not_signed"
  | "signed";

export const ORDER_STATUS_BUCKETS: readonly OrderStatusBucket[] = [
  "awaiting_verification",
  "verified_not_shipped",
  "shipped_not_signed",
  "signed",
] as const;

export const ORDER_STATUS_BUCKET_LABELS: Record<OrderStatusBucket, string> = {
  awaiting_verification: "Awaiting verification",
  verified_not_shipped: "Verified, not shipped",
  shipped_not_signed: "Shipped, not signed",
  signed: "Signed",
};

/** The step a bucket is waiting on, used to describe the tile. */
export const ORDER_STATUS_BUCKET_NEXT_STEP: Record<OrderStatusBucket, OrderStatusStepKey> = {
  awaiting_verification: "verified",
  verified_not_shipped: "shipped",
  shipped_not_signed: "signed",
  signed: "signed",
};

/** Enough of an order to build a row; matches what adminListWithPoSkus returns. */
export type OrderStatusSource = {
  id: number;
  requestNumber: string;
  originatorName?: string | null;
  originatorEmail?: string | null;
  customerName?: string | null;
  distributorName?: string | null;
  distributorEmailStatus?: string | null;
  distributorEmailSentAt?: string | Date | null;
  distributorEmailTo?: string | null;
  distributorEmailSentBy?: string | null;
  orderReceivedEmailSentAt?: string | Date | null;
  orderReceivedEmailTo?: string | null;
  orderVerifiedAt?: string | Date | null;
  orderVerifiedBy?: string | null;
  orderShippedAt?: string | Date | null;
  orderShippedBy?: string | null;
  shipmentCarrier?: string | null;
  shipmentTracking?: string | null;
  orderSignedAt?: string | Date | null;
  orderSignedBy?: string | null;
  signerName?: string | null;
  createdAt?: string | Date | null;
  totalAmount?: number | string | null;
  invoiceTotal?: number | string | null;
  taxAmount?: number | string | null;
  shippingAmount?: number | string | null;
  freightQuoteCents?: number | null;
  deliveryMethod?: "ship" | "pickup" | null;
  lineItems?: Array<{ unitPrice?: number | string | null; linePrice?: number | string | null; qty?: number | null; distributorUnitCost?: number | string | null; distributorLineCost?: number | string | null; unitCost?: number | string | null; lineCost?: number | string | null; myCost?: number | string | null }> | null;
  /** Affiliate / dealer attribution, when the backend sends it. */
  affiliateId?: number | null;
  affiliateName?: string | null;
  affiliateSlug?: string | null;
  /** The affiliate's own domain or subdomain the order was placed on. */
  affiliateSiteUrl?: string | null;
  affiliateHostname?: string | null;
  affiliateCustomDomain?: string | null;
  /** Dealer account that placed the order. */
  dealerName?: string | null;
  dealerAccountName?: string | null;
  dealerCompany?: string | null;
  accountName?: string | null;
  tier?: string | null;
  paidAt?: string | Date | null;
  status?: string | null;
  stripePaymentIntentId?: string | null;
  saleRefundedAt?: string | Date | null;
  orderStatus?: string | null;
};

function iso(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function money(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
}

/**
 * The order total shown on the report. Prefers the stored customer total, then a
 * computed subtotal + shipping + tax, and returns null rather than $0.00 when
 * nothing is stored — a report that silently prints $0.00 is worse than one that
 * admits it does not know.
 */
export function reportOrderTotalCents(order: OrderStatusSource): number | null {
  const stored = money(order.invoiceTotal) ?? money(order.totalAmount);
  const shipping = money(order.shippingAmount)
    ?? (typeof order.freightQuoteCents === "number" ? Math.round(order.freightQuoteCents) : null)
    ?? (order.deliveryMethod === "pickup" ? 0 : null);
  const tax = money(order.taxAmount);
  // `totalAmount` on these orders is the merchandise subtotal, so only trust it
  // as a grand total when shipping and tax are also known and add up.
  if (stored != null && shipping != null && tax != null && money(order.totalAmount) === stored) {
    const lineSubtotal = (order.lineItems ?? []).reduce((sum, line) => {
      const extended = money(line.linePrice) ?? (money(line.unitPrice) != null && line.qty ? money(line.unitPrice)! * line.qty : null);
      return sum + (extended ?? 0);
    }, 0);
    if (lineSubtotal > 0 && Math.abs(lineSubtotal - stored) < 1) return stored + shipping + tax;
  }
  if (stored != null) return stored;
  const lineSubtotal = (order.lineItems ?? []).reduce((sum, line) => {
    const extended = money(line.linePrice) ?? (money(line.unitPrice) != null && line.qty ? money(line.unitPrice)! * line.qty : null);
    return sum + (extended ?? 0);
  }, 0);
  if (lineSubtotal > 0 && shipping != null && tax != null) return lineSubtotal + shipping + tax;
  return null;
}

function shipmentDetail(order: OrderStatusSource): string | null {
  const parts = [(order.shipmentCarrier ?? "").trim(), (order.shipmentTracking ?? "").trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** What the distributor charges us for the whole order, in cents. */
export function distributorCostCents(order: OrderStatusSource): number | null {
  const lines = order.lineItems ?? [];
  if (lines.length === 0) return null;
  let total = 0;
  for (const line of lines) {
    const unit = money(line.distributorUnitCost) ?? money(line.unitCost) ?? money(line.myCost);
    const extended = money(line.distributorLineCost) ?? money(line.lineCost)
      ?? (unit != null && line.qty ? unit * line.qty : null);
    // A partial cost would understate margin, so refuse to total it.
    if (extended == null) return null;
    total += Math.round(extended);
  }
  return total;
}

/** paid / unpaid / refunded, from the order's own payment facts. */
export function orderPaymentStatus(order: OrderStatusSource): OrderPaymentStatus {
  if (order.saleRefundedAt) return "refunded";
  if (iso(order.paidAt)) return "paid";
  const status = (order.orderStatus ?? order.status ?? "").toLowerCase();
  if (status === "refunded") return "refunded";
  return "unpaid";
}

/** Affiliate / dealer label, falling back through slug then id. */
export function orderAffiliateLabel(order: OrderAffiliateFields): string | null {
  const name = (order.affiliateName ?? "").trim();
  if (name) return name;
  const slug = (order.affiliateSlug ?? "").trim();
  if (slug) return slug;
  if (order.affiliateId != null && Number.isFinite(order.affiliateId)) return `Affiliate ${order.affiliateId}`;
  return null;
}

/** The affiliate facts any order-ish shape can carry. */
export type OrderAffiliateFields = Pick<OrderStatusSource,
  "affiliateId" | "affiliateName" | "affiliateSlug" | "affiliateHostname" | "affiliateCustomDomain" | "affiliateSiteUrl"
>;

/** The affiliate's name, or null for a direct order. */
export function orderAffiliateName(order: OrderAffiliateFields): string | null {
  const name = (order.affiliateName ?? "").trim();
  if (name) return name;
  const slug = (order.affiliateSlug ?? "").trim();
  return slug || null;
}

/**
 * The affiliate's site or subdomain, e.g. "reaves-way.cabinetdealz.com". Uses a
 * stored hostname/domain when present and never invents one from a slug.
 */
export function orderAffiliateSite(order: OrderAffiliateFields): string | null {
  const explicit = (order.affiliateHostname ?? order.affiliateCustomDomain ?? "").trim();
  if (explicit) return explicit.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const url = (order.affiliateSiteUrl ?? "").trim();
  if (url) return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return null;
}

/** "Reaves Way Cabinet Shop · reaves-way.cabinetdealz.com", or null when direct. */
export function orderAffiliateDisplay(order: OrderAffiliateFields): string | null {
  const name = orderAffiliateName(order);
  const site = orderAffiliateSite(order);
  const id = order.affiliateId != null && Number.isFinite(order.affiliateId) ? `Affiliate ${order.affiliateId}` : null;
  const label = name ?? id;
  if (!label && !site) return null;
  if (label && site) return `${label} · ${site}`;
  return label ?? site;
}

/**
 * The dealer account that placed the order. Deliberately separate from the
 * affiliate: an affiliate brings the customer, a dealer is the account the order
 * is priced under. Null when the backend does not send one.
 */
export function orderDealerLabel(order: OrderStatusSource): string | null {
  const name = (order.dealerName ?? order.dealerAccountName ?? order.dealerCompany ?? order.accountName ?? "").trim();
  return name || null;
}

/** Build the five-step chain for one order. */
export function buildOrderStatusSteps(order: OrderStatusSource): OrderStatusStep[] {
  const receivedAt = iso(order.orderReceivedEmailSentAt);
  const distributorAt = iso(order.distributorEmailSentAt);
  const verifiedAt = iso(order.orderVerifiedAt);
  const shippedAt = iso(order.orderShippedAt);
  const signedAt = iso(order.orderSignedAt);

  return [
    {
      key: "order_received_email",
      label: "Order received email",
      done: receivedAt != null,
      at: receivedAt,
      by: (order.orderReceivedEmailTo ?? "").trim() || null,
      detail: (order.orderReceivedEmailTo ?? "").trim() || null,
    },
    {
      key: "distributor_email",
      label: "Distributor emailed",
      done: distributorAt != null || order.distributorEmailStatus === "sent",
      at: distributorAt,
      by: (order.distributorEmailSentBy ?? "").trim() || null,
      detail: order.distributorEmailTo ?? null,
    },
    {
      key: "verified",
      label: "Order verified",
      done: verifiedAt != null,
      at: verifiedAt,
      by: orderActorName(order.orderVerifiedBy),
      detail: null,
    },
    {
      key: "shipped",
      label: "Order shipped",
      done: shippedAt != null,
      at: shippedAt,
      by: orderActorName(order.orderShippedBy),
      detail: shipmentDetail(order),
    },
    {
      key: "signed",
      label: "Order signed",
      done: signedAt != null,
      at: signedAt,
      by: orderActorName(order.orderSignedBy),
      detail: (order.signerName ?? "").trim() || null,
    },
  ];
}

const STEP_ORDER: readonly OrderStatusStepKey[] = [
  "order_received_email",
  "distributor_email",
  "verified",
  "shipped",
  "signed",
] as const;

/**
 * The furthest step completed, measured in chain order — not by timestamp, so an
 * out-of-order backfill cannot make an order look signed when it never shipped.
 */
export function furthestStep(steps: readonly OrderStatusStep[]): OrderStatusStepKey | "none" {
  let furthest: OrderStatusStepKey | "none" = "none";
  for (const key of STEP_ORDER) {
    if (steps.find((step) => step.key === key)?.done) furthest = key;
  }
  return furthest;
}

export function buildOrderStatusRow(order: OrderStatusSource): OrderStatusRow {
  const steps = buildOrderStatusSteps(order);
  const furthest = furthestStep(steps);
  const lastStep = furthest === "none" ? null : steps.find((step) => step.key === furthest)?.at ?? null;
  const totalCents = reportOrderTotalCents(order);
  const costCents = distributorCostCents(order);
  return {
    id: order.id,
    orderNumber: order.requestNumber,
    customer: (order.customerName ?? order.originatorName ?? "").trim() || null,
    customerEmail: (order.originatorEmail ?? "").trim() || null,
    distributor: (order.distributorName ?? "").trim() || null,
    affiliate: orderAffiliateDisplay(order),
    affiliateName: orderAffiliateName(order),
    affiliateSite: orderAffiliateSite(order),
    dealer: orderDealerLabel(order),
    itemCount: (order.lineItems ?? []).length,
    totalCents,
    distributorCostCents: costCents,
    marginCents: totalCents != null && costCents != null ? totalCents - costCents : null,
    paymentStatus: orderPaymentStatus(order),
    createdAt: iso(order.createdAt),
    steps,
    furthest,
    lastStepAt: lastStep,
  };
}

/** Which tile an order counts towards. Every order lands in exactly one. */
export function orderStatusBucket(row: OrderStatusRow): OrderStatusBucket {
  if (row.steps.find((step) => step.key === "signed")?.done) return "signed";
  if (row.steps.find((step) => step.key === "shipped")?.done) return "shipped_not_signed";
  if (row.steps.find((step) => step.key === "verified")?.done) return "verified_not_shipped";
  return "awaiting_verification";
}

export type OrderStatusCounts = Record<OrderStatusBucket, number>;

export function countOrderStatuses(rows: readonly OrderStatusRow[]): OrderStatusCounts {
  const counts: OrderStatusCounts = {
    awaiting_verification: 0,
    verified_not_shipped: 0,
    shipped_not_signed: 0,
    signed: 0,
  };
  for (const row of rows) counts[orderStatusBucket(row)] += 1;
  return counts;
}

export type OrderStatusFilters = {
  /** "" means every distributor. */
  distributor?: string;
  /** "" means every affiliate. */
  affiliate?: string;
  /** Inclusive ISO date (YYYY-MM-DD) on the order's created date. */
  from?: string;
  to?: string;
  status?: OrderStatusBucket | "all";
  /** Only orders with no step for at least this many days. 0/undefined off. */
  stuckDays?: number;
  search?: string;
};

/** Days since the furthest step, or since the order was created if it never moved. */
export function orderStatusAgeDays(row: OrderStatusRow, now: Date = new Date()): number | null {
  return centralDaysSince(row.lastStepAt ?? row.createdAt, now);
}

export function isOrderStuck(row: OrderStatusRow, stuckDays: number, now: Date = new Date()): boolean {
  if (stuckDays <= 0) return false;
  // A signed order is finished; it can never be "stuck".
  if (orderStatusBucket(row) === "signed") return false;
  const age = orderStatusAgeDays(row, now);
  return age != null && age >= stuckDays;
}

function searchMatches(row: OrderStatusRow, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return [row.orderNumber, row.customer, row.customerEmail, row.distributor, row.affiliate, row.dealer]
    .some((value) => (value ?? "").toLowerCase().includes(needle));
}

/** Filter the report. `now` is injected so the "stuck" tests are deterministic. */
export function filterOrderStatusRows(
  rows: readonly OrderStatusRow[],
  filters: OrderStatusFilters,
  now: Date = new Date(),
): OrderStatusRow[] {
  const from = filters.from?.trim() || null;
  const to = filters.to?.trim() || null;
  const affiliate = (filters.affiliate ?? "").trim();
  return rows.filter((row) => {
    if (filters.distributor && (row.distributor ?? "") !== filters.distributor) return false;
    if (affiliate && affiliate !== DIRECT_ONLY_AFFILIATE && (row.affiliateName ?? "") !== affiliate) return false;
    // "Direct (no affiliate)" is its own bucket so house orders stay findable.
    if (affiliate === DIRECT_ONLY_AFFILIATE && row.affiliate != null) return false;
    if (filters.status && filters.status !== "all" && orderStatusBucket(row) !== filters.status) return false;
    if (from) {
      const created = row.createdAt?.slice(0, 10) ?? "";
      if (!created || created < from) return false;
    }
    if (to) {
      const created = row.createdAt?.slice(0, 10) ?? "";
      if (!created || created > to) return false;
    }
    if (filters.stuckDays && filters.stuckDays > 0 && !isOrderStuck(row, filters.stuckDays, now)) return false;
    if (!searchMatches(row, filters.search ?? "")) return false;
    return true;
  });
}

/** The affiliate filter value meaning "orders with no affiliate source". */
export const DIRECT_ONLY_AFFILIATE = "__direct__";

/** The distinct distributors present, so the filter lists what actually exists. */
export function orderStatusDistributors(rows: readonly OrderStatusRow[]): string[] {
  const names = new Set<string>();
  for (const row of rows) if (row.distributor) names.add(row.distributor);
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

/** The distinct affiliates present, plus the direct bucket when any order has none. */
export function orderStatusAffiliates(rows: readonly OrderStatusRow[]): string[] {
  const names = new Set<string>();
  let direct = false;
  for (const row of rows) {
    if (row.affiliateName) names.add(row.affiliateName);
    else direct = true;
  }
  const list = Array.from(names).sort((a, b) => a.localeCompare(b));
  return direct ? [...list, DIRECT_ONLY_AFFILIATE] : list;
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

export type MasterOrderSortKey =
  | "orderNumber"
  | "createdAt"
  | "affiliate"
  | "customer"
  | "dealer"
  | "distributor"
  | "totalCents"
  | "distributorCostCents"
  | "marginCents"
  | "paymentStatus"
  | "status";

export type SortDirection = "asc" | "desc";

export type MasterOrderSort = { key: MasterOrderSortKey; direction: SortDirection };

/** Default view: newest orders first. */
export const DEFAULT_MASTER_ORDER_SORT: MasterOrderSort = { key: "createdAt", direction: "desc" };

function sortValue(row: OrderStatusRow, key: MasterOrderSortKey): string | number | null {
  switch (key) {
    case "orderNumber": return row.orderNumber;
    case "createdAt": return row.createdAt ? Date.parse(row.createdAt) : null;
    case "affiliate": return row.affiliate;
    case "customer": return row.customer;
    case "dealer": return row.dealer;
    case "distributor": return row.distributor;
    case "totalCents": return row.totalCents;
    case "distributorCostCents": return row.distributorCostCents;
    case "marginCents": return row.marginCents;
    case "paymentStatus": return row.paymentStatus;
    case "status": return ORDER_STATUS_BUCKETS.indexOf(orderStatusBucket(row));
    default: return null;
  }
}

/**
 * Sort a filtered list. Missing values always sink to the bottom in both
 * directions — an unknown margin should never head the list.
 */
export function sortMasterOrders(rows: readonly OrderStatusRow[], sort: MasterOrderSort): OrderStatusRow[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = sortValue(a, sort.key);
    const right = sortValue(b, sort.key);
    if (left == null && right == null) return a.id - b.id;
    if (left == null) return 1;
    if (right == null) return -1;
    if (typeof left === "number" && typeof right === "number") return (left - right) * factor || a.id - b.id;
    return String(left).localeCompare(String(right), "en", { numeric: true }) * factor || a.id - b.id;
  });
}

/** Click a header: same column flips direction, a new column starts ascending. */
export function nextMasterOrderSort(current: MasterOrderSort, key: MasterOrderSortKey): MasterOrderSort {
  if (current.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { key, direction: key === "createdAt" ? "desc" : "asc" };
}

// ─── Paging ───────────────────────────────────────────────────────────────────

export const MASTER_ORDERS_PAGE_SIZE = 50;

export type MasterOrderPage = {
  rows: OrderStatusRow[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
};

export function paginateMasterOrders(
  rows: readonly OrderStatusRow[],
  page: number,
  pageSize: number = MASTER_ORDERS_PAGE_SIZE,
): MasterOrderPage {
  const size = Math.max(1, Math.floor(pageSize));
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const start = (current - 1) * size;
  const slice = rows.slice(start, start + size);
  return {
    rows: slice,
    page: current,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}

/** A step's one-line caption: "Verified by Dana · Nov 5, 1:47 PM CT" or "Waiting". */
export function orderStatusStepCaption(step: OrderStatusStep): string {
  if (!step.done) return "Waiting";
  const when = formatCentralTime(step.at);
  const who = step.by ? ` by ${step.by}` : "";
  return when ? `${step.label}${who} · ${when}` : step.label;
}

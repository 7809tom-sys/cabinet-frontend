/**
 * Admin-only order breakdown for Incoming Orders (`/admin?tab=orders`).
 *
 * Reads `orders.adminListWithPoSkus`. The paired cabinet-backend change adds
 * the optional fields below on that same admin endpoint. Missing cost, tax,
 * and Stripe values render as "not available". A missing shipping amount is
 * shown as $0.00 with "not recorded" and a warning, and that $0 is what the
 * computed invoice total uses. The Stripe fee is a payout deduction and is
 * never added to the customer total.
 *
 * `totalAmount` stays the merchandise subtotal (the cabinet price). The list
 * and detail invoice total prefer `invoiceTotal` (then `orderTotal`,
 * `grandTotal`, or `customerTotal`). When none of those are present the total
 * is subtotal + shipping + tax − discounts.
 *
 * Line dollars (distributor cost is already inside the customer price):
 *   distributorUnitCost, or unitCost / myCost
 *   distributorLineCost, or lineCost
 * Order:
 *   customerName (falls back to originatorName)
 *   shippingAddress (string or { line1, city, state, zip }) plus
 *   shippingAddressLine1, shippingCity, shippingState, shippingZip / zip
 *   shippingAmount | shippingCents, carrier | shippingCarrier
 *   discountAmount | discountCents
 *   invoiceTotal | orderTotal | grandTotal | customerTotal (and *Cents)
 *   stripeChargeAmount | stripeChargeCents | stripeAmountCents
 *   stripeFeeAmount | stripeFeeCents | stripeFee
 *   stripeNetAmount | stripeNetPayout | stripeNetCents
 *   receiptSentAt | receiptEmailedAt | receiptSent
 */

export const ADMIN_ORDER_NOT_AVAILABLE = "not available";
export const ADMIN_ORDER_SHIPPING_NOT_RECORDED = "not recorded";
export const ADMIN_ORDER_RECEIPT_EMAILED = "Receipt emailed";
export const ADMIN_ORDER_RECEIPT_NOT_SENT = "Receipt not sent";

export type MoneyInput = number | string | null | undefined;

export type AdminOrderLineInput = {
  masterCode?: string | null;
  rawCode?: string | null;
  description?: string | null;
  qty?: number | null;
  unitPrice?: MoneyInput;
  linePrice?: MoneyInput;
  distributorUnitCost?: MoneyInput;
  distributorLineCost?: MoneyInput;
  unitCost?: MoneyInput;
  lineCost?: MoneyInput;
  myCost?: MoneyInput;
  originalUnitPrice?: MoneyInput;
};

export type AdminShippingAddress = {
  line1?: string | null;
  street?: string | null;
  address?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  postalCode?: string | null;
};

export type AdminOrderMoneyInput = {
  totalAmount?: MoneyInput;
  taxAmount?: MoneyInput;
  deliveryMethod?: string | null;
  freightQuoteCents?: number | null;
  freightQuoteVerified?: boolean | null;
  shippingAmount?: MoneyInput;
  shippingCents?: number | null;
  shippingCarrier?: string | null;
  carrier?: string | null;
  discountAmount?: MoneyInput;
  discountCents?: number | null;
  invoiceTotal?: MoneyInput;
  invoiceTotalCents?: number | null;
  orderTotal?: MoneyInput;
  orderTotalCents?: number | null;
  grandTotal?: MoneyInput;
  grandTotalCents?: number | null;
  customerTotal?: MoneyInput;
  customerTotalCents?: number | null;
  stripeChargeAmount?: MoneyInput;
  stripeChargeCents?: number | null;
  stripeAmountCents?: number | null;
  stripeFeeAmount?: MoneyInput;
  stripeFeeCents?: number | null;
  stripeFee?: MoneyInput;
  stripeNetAmount?: MoneyInput;
  stripeNetPayout?: MoneyInput;
  stripeNetCents?: number | null;
  lineItems?: AdminOrderLineInput[] | null;
  customerName?: string | null;
  originatorName?: string | null;
  originatorEmail?: string | null;
  shippingAddress?: string | AdminShippingAddress | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingCity?: string | null;
  city?: string | null;
  shippingState?: string | null;
  state?: string | null;
  shippingZip?: string | null;
  zip?: string | null;
  receiptSentAt?: string | Date | null;
  receiptEmailedAt?: string | Date | null;
  receiptSent?: boolean | null;
};

export type AdminOrderLineBreakdown = {
  code: string | null;
  name: string | null;
  qty: number | null;
  customerCents: number | null;
  distributorCostCents: number | null;
  marginCents: number | null;
};

export type StripeReconciliation =
  | { status: "reconciled" }
  | { status: "mismatch"; differenceCents: number }
  | { status: "unavailable" };

export type AdminOrderBreakdown = {
  lines: AdminOrderLineBreakdown[];
  subtotalCents: number | null;
  /** Always a dollar amount. $0 when shipping was not recorded. */
  shippingCents: number;
  shippingRecorded: boolean;
  shippingCarrier: string | null;
  taxCents: number | null;
  /** Null when this order has no discount to show. */
  discountCents: number | null;
  orderTotalCents: number | null;
  orderTotalSource: "backend" | "computed" | "missing";
  stripeChargeCents: number | null;
  stripeFeeCents: number | null;
  stripeNetCents: number | null;
  reconciliation: StripeReconciliation;
};

export type AdminOrderListIdentity = {
  customerName: string | null;
  shippingLocation: string | null;
  shippingLocationDisplay: string | null;
  receiptLabel: typeof ADMIN_ORDER_RECEIPT_EMAILED | typeof ADMIN_ORDER_RECEIPT_NOT_SENT;
};

const SHIPPING_LOCATION_LIMIT = 64;

export function formatOrderMoney(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return ADMIN_ORDER_NOT_AVAILABLE;
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${String(rem).padStart(2, "0")}`;
}

export function parseDollarsToCents(value: MoneyInput): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number"
    ? value
    : Number(String(value).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100);
}

export function truncateShippingLocation(value: string, max = SHIPPING_LOCATION_LIMIT): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const base = lastSpace > 24 ? slice.slice(0, lastSpace) : slice;
  return `${base.trimEnd()}…`;
}

function parseCents(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function firstDollars(values: MoneyInput[]): number | null {
  for (const value of values) {
    const cents = parseDollarsToCents(value);
    if (cents != null) return cents;
  }
  return null;
}

function textOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function lineCustomerCents(line: AdminOrderLineInput): number | null {
  const extended = parseDollarsToCents(line.linePrice);
  if (extended != null) return extended;
  const unit = parseDollarsToCents(line.unitPrice);
  const qty = line.qty;
  if (unit != null && qty != null && Number.isFinite(qty)) return Math.round(unit * qty);
  return null;
}

function lineDistributorCostCents(line: AdminOrderLineInput): number | null {
  const extended = firstDollars([line.distributorLineCost, line.lineCost]);
  if (extended != null) return extended;
  const unit = firstDollars([line.distributorUnitCost, line.unitCost, line.myCost]);
  const qty = line.qty;
  if (unit != null && qty != null && Number.isFinite(qty)) return Math.round(unit * qty);
  return null;
}

function linePromoDiscountCents(line: AdminOrderLineInput): number | null {
  const original = parseDollarsToCents(line.originalUnitPrice);
  const unit = parseDollarsToCents(line.unitPrice);
  const qty = line.qty;
  if (original == null || unit == null || qty == null || !Number.isFinite(qty) || original <= unit) return null;
  return Math.round((original - unit) * qty);
}

function shippingFor(order: AdminOrderMoneyInput): { cents: number; recorded: boolean } {
  const explicit = firstDollars([order.shippingAmount]);
  if (explicit != null) return { cents: explicit, recorded: true };
  const cents = parseCents(order.shippingCents);
  if (cents != null) return { cents, recorded: true };
  if (order.deliveryMethod === "pickup") return { cents: 0, recorded: true };
  const freight = parseCents(order.freightQuoteCents);
  if (freight != null && (order.freightQuoteVerified === true || freight > 0)) {
    return { cents: freight, recorded: true };
  }
  return { cents: 0, recorded: false };
}

function discountCentsFor(order: AdminOrderMoneyInput, lines: AdminOrderLineInput[]): number | null {
  const explicitDollars = parseDollarsToCents(order.discountAmount);
  const explicit = explicitDollars != null ? explicitDollars : parseCents(order.discountCents);
  if (explicit != null) return explicit > 0 ? explicit : null;
  let promo = 0;
  let found = false;
  for (const line of lines) {
    const lineDiscount = linePromoDiscountCents(line);
    if (lineDiscount == null) continue;
    promo += lineDiscount;
    found = true;
  }
  return found && promo > 0 ? promo : null;
}

function backendInvoiceTotalCents(order: AdminOrderMoneyInput): number | null {
  return firstDollars([order.invoiceTotal, order.orderTotal, order.grandTotal, order.customerTotal])
    ?? parseCents(order.invoiceTotalCents)
    ?? parseCents(order.orderTotalCents)
    ?? parseCents(order.grandTotalCents)
    ?? parseCents(order.customerTotalCents);
}

function nestedAddress(order: AdminOrderMoneyInput): AdminShippingAddress | null {
  const value = order.shippingAddress;
  if (value == null || typeof value !== "object") return null;
  return value;
}

export function describeAdminOrderList(order: AdminOrderMoneyInput): AdminOrderListIdentity {
  const nested = nestedAddress(order);
  const street = textOrNull(typeof order.shippingAddress === "string" ? order.shippingAddress : null)
    ?? textOrNull(nested?.line1)
    ?? textOrNull(nested?.street)
    ?? textOrNull(nested?.address)
    ?? textOrNull(order.shippingAddressLine1);
  const line2 = textOrNull(nested?.line2) ?? textOrNull(order.shippingAddressLine2);
  const streetLine = [street, line2].filter((part): part is string => Boolean(part)).join(", ") || null;
  const city = textOrNull(nested?.city) ?? textOrNull(order.shippingCity) ?? textOrNull(order.city);
  const state = textOrNull(nested?.state) ?? textOrNull(order.shippingState) ?? textOrNull(order.state);
  const zip = textOrNull(nested?.zip)
    ?? textOrNull(nested?.postalCode)
    ?? textOrNull(order.shippingZip)
    ?? textOrNull(order.zip);
  const stateZip = [state, zip].filter((part): part is string => Boolean(part)).join(" ");
  const parts = [streetLine, city, stateZip].filter((part): part is string => Boolean(part));
  const shippingLocation = parts.length > 0 ? parts.join(", ") : null;
  const stamp = order.receiptSentAt ?? order.receiptEmailedAt;
  const emailed = order.receiptSent === true
    || (stamp instanceof Date && !Number.isNaN(stamp.getTime()))
    || (typeof stamp === "string" && stamp.trim().length > 0);
  return {
    customerName: textOrNull(order.customerName) ?? textOrNull(order.originatorName) ?? textOrNull(order.originatorEmail),
    shippingLocation,
    shippingLocationDisplay: shippingLocation ? truncateShippingLocation(shippingLocation) : null,
    receiptLabel: emailed ? ADMIN_ORDER_RECEIPT_EMAILED : ADMIN_ORDER_RECEIPT_NOT_SENT,
  };
}

export function buildAdminOrderBreakdown(order: AdminOrderMoneyInput): AdminOrderBreakdown {
  const lines = order.lineItems ?? [];
  const lineBreakdowns: AdminOrderLineBreakdown[] = lines.map((line) => {
    const customerCents = lineCustomerCents(line);
    const distributorCostCents = lineDistributorCostCents(line);
    const marginCents = customerCents != null && distributorCostCents != null
      ? customerCents - distributorCostCents
      : null;
    return {
      code: textOrNull(line.masterCode) ?? textOrNull(line.rawCode),
      name: textOrNull(line.description),
      qty: line.qty != null && Number.isFinite(line.qty) ? line.qty : null,
      customerCents,
      distributorCostCents,
      marginCents,
    };
  });

  const storedSubtotal = parseDollarsToCents(order.totalAmount);
  const summedSubtotal = lineBreakdowns.every((line) => line.customerCents != null) && lineBreakdowns.length > 0
    ? lineBreakdowns.reduce((sum, line) => sum + (line.customerCents ?? 0), 0)
    : null;
  const subtotalCents = storedSubtotal ?? summedSubtotal;
  const shipping = shippingFor(order);
  const shippingCarrier = textOrNull(order.shippingCarrier)
    ?? textOrNull(order.carrier)
    ?? (order.deliveryMethod === "pickup" && shipping.recorded ? "Local pickup" : null);
  const taxCents = parseDollarsToCents(order.taxAmount);
  const discountCents = discountCentsFor(order, lines);
  const backendTotal = backendInvoiceTotalCents(order);
  const computedTotal = subtotalCents != null && taxCents != null
    ? subtotalCents + shipping.cents + taxCents - (discountCents ?? 0)
    : null;
  const orderTotalCents = backendTotal ?? computedTotal;
  const orderTotalSource: AdminOrderBreakdown["orderTotalSource"] = backendTotal != null
    ? "backend"
    : computedTotal != null
      ? "computed"
      : "missing";

  const stripeChargeCents = firstDollars([order.stripeChargeAmount])
    ?? parseCents(order.stripeChargeCents)
    ?? parseCents(order.stripeAmountCents);
  const stripeFeeCents = firstDollars([order.stripeFeeAmount, order.stripeFee])
    ?? parseCents(order.stripeFeeCents);
  const stripeNetCents = firstDollars([order.stripeNetAmount, order.stripeNetPayout])
    ?? parseCents(order.stripeNetCents);

  let reconciliation: StripeReconciliation = { status: "unavailable" };
  if (orderTotalCents != null && stripeChargeCents != null) {
    const differenceCents = stripeChargeCents - orderTotalCents;
    reconciliation = differenceCents === 0
      ? { status: "reconciled" }
      : { status: "mismatch", differenceCents };
  }

  return {
    lines: lineBreakdowns,
    subtotalCents,
    shippingCents: shipping.cents,
    shippingRecorded: shipping.recorded,
    shippingCarrier,
    taxCents,
    discountCents,
    orderTotalCents,
    orderTotalSource,
    stripeChargeCents,
    stripeFeeCents,
    stripeNetCents,
    reconciliation,
  };
}

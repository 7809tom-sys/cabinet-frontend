/**
 * The single source of truth for PO / invoice money.
 *
 * Every place a purchase order is shown or exported — the admin order page PO
 * view, the downloadable PO PDF and CSV, and the PO email Cabinet Dealz sends a
 * distributor — builds its numbers here. Before this existed each surface
 * assembled its own rows, so a line could render with no price and the total
 * still looked plausible (shipping + tax only). `buildPoDocument` never drops a
 * line's dollars silently: an unpriced line stays visible as unpriced and
 * `completePricing` turns false so the document can say so.
 *
 * WHAT PRICE A PO SHOWS
 * A purchase order is Cabinet Dealz ordering from the distributor, so the
 * amounts a distributor sees are OUR COST — the stored distributor cost of the
 * line (`distributorUnitCost` / `unitCost` / `myCost`, extended by
 * `distributorLineCost` / `lineCost`). The customer price (`unitPrice` /
 * `linePrice`) is what we charge the homeowner; it includes margin and must not
 * be pasted into a distributor PO. The customer price is only used as a last
 * resort for a line with no stored cost, and then the document reports the
 * `customer_price` basis instead of pretending it is cost.
 */

export type PoMoneyInput = number | string | null | undefined;

export type PoPriceBasis = "distributor_cost" | "customer_price";

export const PO_PRICE_BASIS_LABEL: Record<PoPriceBasis, string> = {
  distributor_cost: "Distributor cost",
  customer_price: "Customer price",
};

export type PoLineInput = {
  sku?: string | null;
  masterCode?: string | null;
  rawCode?: string | null;
  description?: string | null;
  doorStyle?: string | null;
  qty?: number | null;
  /** Customer unit price (what the homeowner pays). */
  unitPrice?: PoMoneyInput;
  /** Extended customer price for the line. */
  linePrice?: PoMoneyInput;
  /** Stored distributor cost, unit and extended. */
  distributorUnitCost?: PoMoneyInput;
  distributorLineCost?: PoMoneyInput;
  unitCost?: PoMoneyInput;
  lineCost?: PoMoneyInput;
  myCost?: PoMoneyInput;
};

export type PoTotalsInput = {
  /** Shipping in dollars when the order stores it that way. */
  shipping?: PoMoneyInput;
  shippingCents?: number | null;
  freightQuoteCents?: number | null;
  freightQuoteVerified?: boolean | null;
  deliveryMethod?: "ship" | "pickup" | null;
  tax?: PoMoneyInput;
  taxCents?: number | null;
  discount?: PoMoneyInput;
  discountCents?: number | null;
};

export type PoDocumentInput = PoTotalsInput & {
  orderNumber: string;
  orderDate?: string | null;
  customerName?: string | null;
  styleName?: string | null;
  distributorName?: string | null;
  /**
   * The affiliate's site that generated this order (name, and/or its domain).
   * Printed in the header so a distributor can see where the order came from.
   * Null means a direct house order and prints "—"; it is never inferred.
   */
  affiliateSite?: string | null;
  pickupAddress?: string | null;
  poNumber?: string | null;
  notes?: string | null;
  lines?: readonly (PoLineInput & Record<string, unknown>)[] | null;
};

export type PoLineRow = {
  sku: string;
  description: string;
  doorStyle: string | null;
  qty: number;
  unitPriceCents: number | null;
  lineTotalCents: number | null;
  basis: PoPriceBasis | null;
  priced: boolean;
};

export type PoSummaryKey = "subtotal" | "shipping" | "tax" | "discount" | "total";

export type PoSummaryRow = {
  key: PoSummaryKey;
  label: string;
  cents: number;
  /** False when the order has no stored value; still $0 in the arithmetic. */
  recorded: boolean;
  emphasized?: boolean;
};

export type PoDocument = {
  orderNumber: string;
  orderDate: string;
  customerName: string | null;
  styleName: string | null;
  distributorName: string | null;
  /** "Reaves Way Cabinet Shop · reaves-way.cabinetdealz.com", or null. */
  affiliateSite: string | null;
  deliveryMethod: "ship" | "pickup";
  pickupAddress: string | null;
  poNumber: string | null;
  notes: string | null;
  lines: PoLineRow[];
  /** Whichever price basis the lines actually resolved to. */
  basis: PoPriceBasis | "mixed" | "unpriced";
  subtotalCents: number;
  shippingCents: number;
  shippingRecorded: boolean;
  taxCents: number;
  taxRecorded: boolean;
  discountCents: number;
  totalCents: number;
  pricedLines: number;
  unpricedLines: number;
  /** False means at least one line has no price, so the subtotal is short. */
  completePricing: boolean;
  /** True when shipping was assumed $0 because nothing was recorded. */
  shippingAssumedZero: boolean;
};

const MONEY_PATTERN = /^-?\$?[\d,]*\.?\d*$/;

/** Dollars (number or "$1,234.56" string) to whole cents. */
export function parsePoCents(value: PoMoneyInput): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) : null;
  const text = String(value).trim();
  if (!text || !MONEY_PATTERN.test(text)) return null;
  const numeric = Number(text.replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
}

function centsFrom(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function firstCents(values: PoMoneyInput[]): number | null {
  for (const value of values) {
    const cents = parsePoCents(value);
    if (cents != null) return cents;
  }
  return null;
}

/** "$284.39"; "—" when there is no amount at all. */
export function formatPoUsd(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

function quantityOf(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function skuOf(line: PoLineInput): string {
  return String(line.sku || line.masterCode || line.rawCode || "").trim();
}

/**
 * Resolve one line's unit price and line total. Cost wins; the customer price is
 * only a fallback and is reported as such.
 */
export function resolvePoLine(line: PoLineInput): PoLineRow {
  const qty = quantityOf(line.qty);
  const costUnit = firstCents([line.distributorUnitCost, line.unitCost, line.myCost]);
  const costExtended = firstCents([line.distributorLineCost, line.lineCost]);
  const customerUnit = firstCents([line.unitPrice]);
  const customerExtended = firstCents([line.linePrice]);

  let basis: PoPriceBasis | null = null;
  let unitPriceCents: number | null = null;
  let lineTotalCents: number | null = null;

  if (costUnit != null || costExtended != null) {
    basis = "distributor_cost";
    unitPriceCents = costUnit ?? (costExtended != null && qty > 0 ? Math.round(costExtended / qty) : null);
    lineTotalCents = costExtended ?? (unitPriceCents != null && qty > 0 ? unitPriceCents * qty : null);
  } else if (customerUnit != null || customerExtended != null) {
    basis = "customer_price";
    unitPriceCents = customerUnit ?? (customerExtended != null && qty > 0 ? Math.round(customerExtended / qty) : null);
    lineTotalCents = customerExtended ?? (unitPriceCents != null && qty > 0 ? unitPriceCents * qty : null);
  }

  return {
    sku: skuOf(line),
    description: (line.description ?? "").trim(),
    doorStyle: (line.doorStyle ?? "").trim() || null,
    qty,
    unitPriceCents,
    lineTotalCents,
    basis,
    priced: lineTotalCents != null,
  };
}

function shippingFrom(input: PoTotalsInput): { cents: number; recorded: boolean } {
  const dollars = parsePoCents(input.shipping);
  if (dollars != null) return { cents: dollars, recorded: true };
  const cents = centsFrom(input.shippingCents);
  if (cents != null) return { cents, recorded: true };
  if (input.deliveryMethod === "pickup") return { cents: 0, recorded: true };
  const freight = centsFrom(input.freightQuoteCents);
  if (freight != null && (input.freightQuoteVerified === true || freight > 0)) {
    return { cents: freight, recorded: true };
  }
  return { cents: 0, recorded: false };
}

function taxFrom(input: PoTotalsInput): { cents: number; recorded: boolean } {
  const dollars = parsePoCents(input.tax);
  if (dollars != null) return { cents: dollars, recorded: true };
  const cents = centsFrom(input.taxCents);
  if (cents != null) return { cents, recorded: true };
  return { cents: 0, recorded: false };
}

function discountFrom(input: PoTotalsInput): number {
  const dollars = parsePoCents(input.discount);
  const cents = dollars ?? centsFrom(input.discountCents) ?? 0;
  return cents > 0 ? cents : 0;
}

function normalizeDate(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
}

/**
 * Build the whole PO: priced lines, subtotal, shipping, tax and a total that is
 * always subtotal + shipping + tax − discount.
 */
export function buildPoDocument(input: PoDocumentInput): PoDocument {
  const lines = (input.lines ?? []).map((line) => resolvePoLine(line));
  const subtotalCents = lines.reduce((sum, line) => sum + (line.lineTotalCents ?? 0), 0);
  const shipping = shippingFrom(input);
  const tax = taxFrom(input);
  const discountCents = discountFrom(input);
  const pricedLines = lines.filter((line) => line.priced).length;
  const unpricedLines = lines.length - pricedLines;

  const bases = new Set(lines.map((line) => line.basis).filter((basis): basis is PoPriceBasis => basis != null));
  const basis: PoDocument["basis"] = bases.size === 0
    ? "unpriced"
    : bases.size > 1
      ? "mixed"
      : (Array.from(bases)[0] as PoPriceBasis);

  return {
    orderNumber: input.orderNumber,
    orderDate: normalizeDate(input.orderDate),
    customerName: (input.customerName ?? "").trim() || null,
    styleName: (input.styleName ?? "").trim() || null,
    distributorName: (input.distributorName ?? "").trim() || null,
    affiliateSite: (input.affiliateSite ?? "").trim() || null,
    deliveryMethod: input.deliveryMethod === "pickup" ? "pickup" : "ship",
    pickupAddress: (input.pickupAddress ?? "").trim() || null,
    poNumber: (input.poNumber ?? "").trim() || null,
    notes: (input.notes ?? "").trim() || null,
    lines,
    basis,
    subtotalCents,
    shippingCents: shipping.cents,
    shippingRecorded: shipping.recorded,
    taxCents: tax.cents,
    taxRecorded: tax.recorded,
    discountCents,
    totalCents: subtotalCents + shipping.cents + tax.cents - discountCents,
    pricedLines,
    unpricedLines,
    completePricing: unpricedLines === 0,
    shippingAssumedZero: !shipping.recorded,
  };
}

/**
 * The subtotal → shipping → tax → total block. Every surface (admin page, PDF,
 * CSV, email text) renders this same list, so the four numbers can never drift
 * apart between them.
 */
export function poSummaryRows(doc: PoDocument): PoSummaryRow[] {
  const rows: PoSummaryRow[] = [
    { key: "subtotal", label: "Subtotal", cents: doc.subtotalCents, recorded: doc.completePricing },
    {
      key: "shipping",
      label: "Shipping",
      cents: doc.shippingCents,
      recorded: !doc.shippingAssumedZero,
    },
    { key: "tax", label: "Sales tax", cents: doc.taxCents, recorded: doc.taxRecorded },
  ];
  if (doc.discountCents > 0) {
    rows.push({ key: "discount", label: "Discounts", cents: -doc.discountCents, recorded: true });
  }
  rows.push({ key: "total", label: "Total", cents: doc.totalCents, recorded: true, emphasized: true });
  return rows;
}

/** One "not priced" warning line, or null when every line has a price. */
export function poPricingWarning(doc: PoDocument): string | null {
  if (doc.completePricing) return null;
  const noun = doc.unpricedLines === 1 ? "line has" : "lines have";
  return `${doc.unpricedLines} ${noun} no price on this order, so the subtotal excludes it. Price those lines before sending this PO.`;
}

function lineLabel(line: PoLineRow): string {
  return [line.sku, line.description].filter(Boolean).join(" — ") || "Item";
}

/** Plain-text PO body. Prices are always on the line, never only in the total. */
export function buildPoText(doc: PoDocument, opts?: { distributorName?: string | null; footer?: string | null }): string {
  const out: string[] = [];
  out.push(`Purchase Order: ${doc.orderNumber}`);
  const distributor = (opts?.distributorName ?? doc.distributorName ?? "").trim();
  if (distributor) out.push(`Distributor: ${distributor}`);
  if (doc.poNumber) out.push(`PO number: ${doc.poNumber}`);
  if (doc.customerName) out.push(`Reference: ${doc.customerName}`);
  if (doc.styleName) out.push(`Door Style / Finish: ${doc.styleName}`);
  // Always printed, with an em dash when the order came in direct, so the
  // header block has a stable shape on every PO.
  out.push(`Affiliate site: ${doc.affiliateSite ?? "—"}`);
  out.push(`Date: ${doc.orderDate}`);
  out.push(`Fulfillment: ${doc.deliveryMethod === "pickup" ? "Local pickup" : "Ship"}`);
  if (doc.deliveryMethod === "pickup" && doc.pickupAddress) out.push(`Pickup location: ${doc.pickupAddress}`);
  out.push("");
  out.push("Line items:");
  if (doc.lines.length === 0) {
    out.push("  No line items were assigned to this distributor.");
  }
  for (const line of doc.lines) {
    const style = line.doorStyle ? ` · ${line.doorStyle}` : "";
    const unit = line.unitPriceCents != null ? formatPoUsd(line.unitPriceCents) : "no price";
    const total = line.lineTotalCents != null ? formatPoUsd(line.lineTotalCents) : "no price";
    out.push(`  ${line.qty} x ${lineLabel(line)}${style}`);
    out.push(`      Unit ${unit} × ${line.qty} = Line total ${total}`);
  }
  out.push("");
  if (doc.basis === "distributor_cost") out.push("Prices shown are Cabinet Dealz distributor cost.");
  else if (doc.basis === "customer_price") out.push("Prices shown are customer price (no distributor cost is stored on this order).");
  else if (doc.basis === "mixed") out.push("Prices shown mix distributor cost and customer price; review this PO before sending.");
  for (const row of poSummaryRows(doc)) {
    const amount = formatPoUsd(row.cents);
    const missing = row.recorded ? "" : " (not recorded)";
    out.push(`${row.emphasized ? `${row.label}:` : `${row.label}:`} ${amount}${missing}`);
  }
  const warning = poPricingWarning(doc);
  if (warning) {
    out.push("");
    out.push(`WARNING: ${warning}`);
  }
  if (doc.notes) {
    out.push("");
    out.push(`Notes: ${doc.notes}`);
  }
  const footer = (opts?.footer ?? "").trim();
  out.push("");
  out.push(footer || "Cabinet Dealz");
  return out.join("\n");
}

export const PO_CSV_COLUMNS = [
  "PO Number",
  "Order Date",
  "Item",
  "Description",
  "Door Style",
  "Quantity",
  "Unit Price",
  "Line Total",
] as const;

/** RFC-4180-ish cell escaping. */
export function poCsvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * PO CSV. `includeSummary` appends the subtotal/shipping/tax/total rows so a
 * downloaded PO reconciles on its own; NetSuite imports pass false and get line
 * rows only, still with Unit Price and Line Total filled in.
 */
export function buildPoCsv(doc: PoDocument, opts?: { includeSummary?: boolean }): string {
  const includeSummary = opts?.includeSummary !== false;
  const rows: string[] = [PO_CSV_COLUMNS.map(poCsvCell).join(",")];
  for (const line of doc.lines) {
    rows.push([
      doc.orderNumber,
      doc.orderDate,
      line.sku,
      line.description,
      line.doorStyle ?? "",
      line.qty,
      line.unitPriceCents != null ? (line.unitPriceCents / 100).toFixed(2) : "",
      line.lineTotalCents != null ? (line.lineTotalCents / 100).toFixed(2) : "",
    ].map(poCsvCell).join(","));
  }
  if (includeSummary) {
    for (const row of poSummaryRows(doc)) {
      rows.push([
        doc.orderNumber,
        doc.orderDate,
        row.label,
        row.recorded ? "" : "not recorded",
        "",
        "",
        "",
        (row.cents / 100).toFixed(2),
      ].map(poCsvCell).join(","));
    }
  }
  return rows.join("\r\n");
}

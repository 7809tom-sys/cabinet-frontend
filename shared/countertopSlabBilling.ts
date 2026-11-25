/**
 * Countertop quote slab billing (Tom, Nov 25 2026).
 *
 * Countertop quotes are never paid through the cart. When a quote is saved
 * (Save Quote) or won (Mark Won), the admin can bill it on the CRM deal
 * invoice as ONE line built from the quote:
 *   "Corian countertop, 2 slabs, 32.5 sq ft needed, at $450.00 per slab = $900.00"
 * slabs = ceil(squareFeet / slab sq ft). Slabs are sold whole, no partials.
 * Nothing here is stored: it is computed from countertop_quotes.squareFeet,
 * material and quotedPrice, so no migration is needed.
 *
 * The same file lives in cabinet-frontend and cabinet-backend under shared/;
 * keep the two copies identical.
 */

/**
 * Corian standard sheet: 30" x 144" = 30 sq ft (12 mm and 19 mm sheets).
 * Source: Corian Solid Surface Sheet Products K-24016-NA and Product Overview
 * K-27478-NA, corian.com:
 * https://www.corian.com/bin/corianweb/pdf-inline?path=%2Fcontent%2Fdam%2Fcorian%2Fassets%2Fpdf%2Fdocuments%2Fen-us%2Fk-24016_corian_solid_surface_sheet_products.pdf
 * No waste factor: the repo's countertop slab math uses none.
 */
export const CORIAN_SHEET_WIDTH_IN = 30;
export const CORIAN_SHEET_LENGTH_IN = 144;
export const CORIAN_SHEET_SQ_FT = (CORIAN_SHEET_WIDTH_IN * CORIAN_SHEET_LENGTH_IN) / 144;

/**
 * Confirmed slab size (sq ft) per material. Only Corian is confirmed. Quartz
 * and granite are deliberately unset: they fall back to the Corian size and
 * the card and invoice line say "slab size not confirmed for <material>".
 * Add a real, sourced size here to confirm another material.
 */
export const COUNTERTOP_SLAB_SQ_FT_BY_MATERIAL: Record<string, number | undefined> = {
  corian: CORIAN_SHEET_SQ_FT,
  quartz: undefined,
  granite: undefined,
};

/** Size used when a material has no confirmed slab size. */
export const FALLBACK_SLAB_SQ_FT = CORIAN_SHEET_SQ_FT;

/**
 * ASSUMPTION (Tom did not say): the price typed on the quote card
 * (countertop_quotes.quotedPrice) is the price PER SLAB, so
 * total = slabs x quotedPrice. Flip to false if quotedPrice is the whole-job
 * total; the line then shows total / slabs as the per-slab price.
 */
export const QUOTED_PRICE_IS_PER_SLAB = true;

export interface CountertopSlabSize {
  /** Name shown on the line, e.g. "Corian" or "Quartz". */
  materialLabel: string;
  slabSqFt: number;
  /** False when the size is the Corian fallback for an unconfirmed material. */
  confirmed: boolean;
  /** "slab size not confirmed for Quartz", or null when confirmed. */
  warning: string | null;
}

function cleanText(material: unknown): string | null {
  return typeof material === "string" && material.trim() ? material.trim() : null;
}

/** Slab size for a quote's material. A blank material is billed as Corian. */
export function countertopSlabSize(material: unknown): CountertopSlabSize {
  const label = cleanText(material);
  if (!label) {
    return { materialLabel: "Corian", slabSqFt: CORIAN_SHEET_SQ_FT, confirmed: true, warning: null };
  }
  const lower = label.toLowerCase();
  const key = Object.keys(COUNTERTOP_SLAB_SQ_FT_BY_MATERIAL).find((k) => lower.includes(k));
  const size = key ? COUNTERTOP_SLAB_SQ_FT_BY_MATERIAL[key] : undefined;
  if (size && size > 0) return { materialLabel: label, slabSqFt: size, confirmed: true, warning: null };
  return {
    materialLabel: label,
    slabSqFt: FALLBACK_SLAB_SQ_FT,
    confirmed: false,
    warning: `slab size not confirmed for ${label}`,
  };
}

function positiveNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Whole slabs: ceil(squareFeet / slabSqFt). Null for a missing or zero area. */
export function slabsNeeded(squareFeet: unknown, slabSqFt: number = CORIAN_SHEET_SQ_FT): number | null {
  const area = positiveNumber(squareFeet);
  if (area == null || !Number.isFinite(slabSqFt) || slabSqFt <= 0) return null;
  // Tiny tolerance so float noise (e.g. 2.0000000000000004) never adds a slab.
  return Math.ceil(area / slabSqFt - 1e-9);
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sqFt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export interface CountertopQuoteForBilling {
  squareFeet?: unknown;
  material?: unknown;
  quotedPrice?: unknown;
}

export type CountertopSlabLineResult =
  | {
    ok: true;
    line: { description: string; amount: number; kind: "charge" };
    slabs: number;
    squareFeet: number;
    pricePerSlab: number;
    total: number;
    size: CountertopSlabSize;
  }
  | { ok: false; reason: "missing_area" | "missing_price"; message: string };

const cents = (n: number) => Math.round(n * 100) / 100;

/** Build the customer-facing invoice line for one countertop quote. */
export function buildCountertopSlabInvoiceLine(
  quote: CountertopQuoteForBilling,
  pricePerSlabMode: boolean = QUOTED_PRICE_IS_PER_SLAB,
): CountertopSlabLineResult {
  const area = positiveNumber(quote.squareFeet);
  const size = countertopSlabSize(quote.material);
  const slabs = slabsNeeded(area, size.slabSqFt);
  if (area == null || slabs == null) {
    return { ok: false, reason: "missing_area", message: "No square feet on this quote, so no slab line can be billed. Add the measurements first." };
  }
  const price = positiveNumber(quote.quotedPrice);
  if (price == null) {
    return { ok: false, reason: "missing_price", message: "Enter the quoted price per slab and press Save Quote before billing this quote." };
  }
  const pricePerSlab = pricePerSlabMode ? cents(price) : cents(price / slabs);
  const total = pricePerSlabMode ? cents(slabs * price) : cents(price);
  const description = [
    `${size.materialLabel} countertop, ${slabs} ${slabs === 1 ? "slab" : "slabs"}, ${sqFt(area)} sq ft needed, at ${money(pricePerSlab)} per slab = ${money(total)}`,
    size.warning ? ` (${size.warning})` : "",
  ].join("");
  return { ok: true, line: { description, amount: total, kind: "charge" }, slabs, squareFeet: area, pricePerSlab, total, size };
}

export interface ShippingOnFileInput {
  /** crm_deals.shippingAddress */
  dealShippingAddress?: string | null;
  /** The deal's linked order_requests row, when there is one. */
  order?: {
    shippingAddressLine1?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    zip?: string | null;
  } | null;
}

/**
 * Payment is only requested after shipping info is collected. Shipping is on
 * file when the deal has a saved shipping address, or its linked order has a
 * street, city, state and ZIP. A ZIP alone (all a quote stores) is not enough.
 */
export function countertopShippingOnFile(input: ShippingOnFileInput): boolean {
  if (cleanText(input.dealShippingAddress)) return true;
  const o = input.order;
  return Boolean(o && cleanText(o.shippingAddressLine1) && cleanText(o.shippingCity) && cleanText(o.shippingState) && cleanText(o.zip));
}

export const COUNTERTOP_MISSING_SHIPPING_MESSAGE =
  "Shipping info is required before a countertop invoice or payment request goes out. Add the customer's shipping address to this deal first.";

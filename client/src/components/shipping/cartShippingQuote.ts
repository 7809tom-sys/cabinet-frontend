import { itemUsesExistingCarrierQuote, type ShippingDestination, type ShippingItemInput } from "@shared/shippingRules";
export type CartShippingQuoteItem = {
  productKind?: "surface" | "hardware" | null;
  pelicanProductId?: number | null;
  vendorProductId?: number | null;
  distributorId?: number | null;
  masterCode: string;
  styleId: number;
  qty: number;
  unitPrice: number | null;
  category?: string | null;
  name?: string | null;
  qtyNote?: string | null;
};

export type ShippingQuoteRequestItem = {
  kind: "pelican" | "cabinet" | "vendor_product";
  qty: number;
  pelicanProductId?: number;
  vendorProductId?: number;
  masterCode?: string;
  styleId?: number;
  distributorId?: number;
  cabinetId?: number;
  merchandiseCents?: number;
  productKind?: "surface" | "hardware" | null;
  category?: string | null;
  name?: string | null;
  qtyNote?: string | null;
};

export function cartItemsToShippingQuote(items: readonly CartShippingQuoteItem[]) {
  const requests: ShippingQuoteRequestItem[] = [];
  const cartIndexes: number[] = [];
  items.forEach((item, index) => {
    const merchandiseCents = item.unitPrice != null && Number.isFinite(item.unitPrice)
      ? Math.max(0, Math.round(item.unitPrice * item.qty * 100))
      : undefined;
    if (item.productKind === "hardware" && item.vendorProductId) {
      requests.push({ kind: "vendor_product", qty: item.qty, vendorProductId: item.vendorProductId, merchandiseCents, productKind: "hardware", category: item.category, name: item.name, qtyNote: item.qtyNote });
      cartIndexes.push(index);
      return;
    }
    if (item.productKind === "surface" && item.pelicanProductId) {
      requests.push({ kind: "pelican", qty: item.qty, pelicanProductId: item.pelicanProductId, merchandiseCents, productKind: "surface", category: item.category, name: item.name, qtyNote: item.qtyNote });
      cartIndexes.push(index);
      return;
    }
    if (item.distributorId && item.masterCode && item.productKind !== "surface" && item.productKind !== "hardware") {
      requests.push({
        kind: "cabinet",
        qty: item.qty,
        masterCode: item.masterCode,
        styleId: item.styleId > 0 ? item.styleId : undefined,
        distributorId: item.distributorId,
        merchandiseCents,
        category: item.category,
        name: item.name,
        qtyNote: item.qtyNote,
      });
      cartIndexes.push(index);
    }
  });
  return { requests, cartIndexes };
}

export type PublicVendorQuote = {
  vendorScope: string;
  vendorName: string;
  itemIndexes: number[];
  ok: boolean;
  source: "vendor_live" | "vendor_rates" | "site_estimate" | null;
  sourceLabel: string | null;
  estimate: boolean;
  options: Array<{ carrier: string | null; method: string; costCents: number; transitDays: number | null; expiresAt: string | null }>;
  note: string | null;
  error: string | null;
  code: string | null;
};

export function quotesForCartIndexes(quotes: readonly PublicVendorQuote[], cartIndexes: readonly number[], wanted: readonly number[]) {
  const wantedSet = new Set(wanted);
  return quotes.filter((quote) => quote.itemIndexes.some((requestIndex) => {
    const cartIndex = cartIndexes[requestIndex];
    return cartIndex != null && wantedSet.has(cartIndex);
  }));
}


export function shippingItemFromQuoteRequest(item: ShippingQuoteRequestItem): ShippingItemInput {
  return {
    productKind: item.productKind ?? (item.kind === "vendor_product" ? "hardware" : item.kind === "pelican" ? "surface" : null),
    category: item.category,
    name: item.name,
    qty: item.qty,
    qtyNote: item.qtyNote,
  };
}

/** Items the existing carrier quote may price. Rule-driven categories are excluded so no amount is invented. */
export function carrierQuoteRequests(
  requests: readonly ShippingQuoteRequestItem[],
  destination: ShippingDestination,
): { requests: ShippingQuoteRequestItem[]; originalIndexes: number[] } {
  const next: ShippingQuoteRequestItem[] = [];
  const originalIndexes: number[] = [];
  requests.forEach((item, index) => {
    if (itemUsesExistingCarrierQuote(shippingItemFromQuoteRequest(item), destination)) {
      next.push(item);
      originalIndexes.push(index);
    }
  });
  return { requests: next, originalIndexes };
}

export function remapVendorQuoteItemIndexes(quotes: readonly PublicVendorQuote[], originalIndexes: readonly number[]): PublicVendorQuote[] {
  return quotes.map((quote) => ({
    ...quote,
    itemIndexes: quote.itemIndexes.map((index) => originalIndexes[index] ?? index),
  }));
}

import type { AdminOrderRow } from "@/lib/adminOrderRow";
import { buildPoDocument, type PoDocument, type PoDocumentInput } from "@shared/poDocument";
import { normalizePoSku } from "@shared/poSku";
import { orderAffiliateDisplay } from "@/lib/orderStatusReport";

/**
 * Order data as it arrives on the admin order page, narrowed to what a PO needs.
 * The admin row already carries the stored line prices (customer price, plus the
 * distributor cost used by a distributor PO) and the order's shipping and tax.
 */
export type PoOrderSource = Pick<
  AdminOrderRow,
  | "requestNumber"
  | "createdAt"
  | "originatorName"
  | "customerName"
  | "styleName"
  | "distributorName"
  | "deliveryMethod"
  | "shippingAmount"
  | "shippingCents"
  | "freightQuoteCents"
  | "freightQuoteVerified"
  | "taxAmount"
  | "discountAmount"
  | "discountCents"
  | "notes"
  | "lineItems"
  // Affiliate source, so the PO header can say where the order came from.
  | "affiliateName"
  | "affiliateSlug"
  | "affiliateHostname"
  | "affiliateCustomDomain"
  | "affiliateSiteUrl"
  | "affiliateId"
> & { distributorInvoiceReference?: string | null };

/**
 * Map an admin order to the shared PO input. Nothing is recomputed here: this
 * only chooses which stored field feeds which PO slot, so the admin view, the
 * PDF, the CSV and the emailed PO all resolve the same cents.
 */
export function poInputFromOrder(order: PoOrderSource): PoDocumentInput {
  return {
    orderNumber: order.requestNumber,
    orderDate: order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt ?? ""),
    customerName: order.customerName ?? order.originatorName ?? null,
    styleName: order.styleName ?? null,
    distributorName: order.distributorName ?? null,
    // The affiliate's own site, never invented: a direct order prints "—".
    affiliateSite: orderAffiliateDisplay(order),
    poNumber: order.distributorInvoiceReference ?? null,
    deliveryMethod: order.deliveryMethod ?? "ship",
    notes: order.notes ?? null,
    shipping: order.shippingAmount ?? null,
    shippingCents: order.shippingCents ?? null,
    freightQuoteCents: order.freightQuoteCents ?? null,
    freightQuoteVerified: order.freightQuoteVerified ?? null,
    tax: order.taxAmount ?? null,
    discount: order.discountAmount ?? null,
    discountCents: order.discountCents ?? null,
    lines: (order.lineItems ?? []).map((line) => ({
      // Repair an already-stored "cs-cs-cs-db18" without a data migration.
      sku: normalizePoSku(line.poSku) || line.masterCode || line.rawCode || "",
      masterCode: line.masterCode ?? null,
      rawCode: line.rawCode ?? null,
      description: line.description ?? "",
      doorStyle: line.colorFinish ?? line.doorStyle ?? null,
      qty: line.qty ?? 0,
      unitPrice: line.unitPrice ?? null,
      linePrice: line.linePrice ?? null,
      // Distributor cost is what a distributor PO shows; the PO builder prefers
      // these fields and only falls back to the customer price when they are all
      // absent, and then it says so on the document.
      distributorUnitCost: line.distributorUnitCost ?? null,
      distributorLineCost: line.distributorLineCost ?? null,
      unitCost: line.unitCost ?? null,
      lineCost: line.lineCost ?? null,
      myCost: line.myCost ?? null,
    })),
  };
}

/** The PO for one order, built by the shared builder. */
export function poDocumentFromOrder(order: PoOrderSource): PoDocument {
  return buildPoDocument(poInputFromOrder(order));
}

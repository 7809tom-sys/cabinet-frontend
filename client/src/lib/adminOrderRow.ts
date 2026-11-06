/**
 * Row shape and shipment helpers shared by the Incoming Orders list and the
 * full-page admin order view. Everything here is presentation-only: the money
 * values still resolve through `adminOrderReconciliation`.
 */
import type { AdminOrderLineInput, AdminOrderMoneyInput } from "@/lib/adminOrderReconciliation";
import { trackingUrl } from "@shared/vendorFulfillment";

export type AdminOrderStatus = "draft" | "submitted" | "confirmed" | "cancelled";

export type AdminOrderLine = AdminOrderLineInput & {
  cabinetId: number | null;
  masterCode: string;
  rawCode?: string;
  description: string;
  qty: number;
  unitPrice: number | null;
  linePrice: number | null;
  doorStyle?: string | null;
  styleId?: number | null;
  tier?: string | null;
  matched: boolean;
  poSku: string | null;
  distributorName?: string | null;
  colorFinish?: string | null;
};

export type AdminOrderShipmentFact = {
  status?: string | null;
  shippedAt?: string | Date | null;
  carrier?: string | null;
  trackingNumber?: string | null;
};

export type AdminOrderRow = Omit<AdminOrderMoneyInput, "lineItems" | "originatorName" | "originatorEmail" | "deliveryMethod"> & {
  id: number;
  requestNumber: string;
  originatorName: string | null;
  originatorEmail: string | null;
  originatorPhone: string | null;
  status: AdminOrderStatus;
  tier: string;
  styleName: string | null;
  taxState?: string | null;
  taxRate?: string | null;
  itemCount: number;
  notes: string | null;
  lineItems: AdminOrderLine[];
  createdAt: Date;
  distributorId?: number | null;
  distributorName?: string | null;
  deliveryMethod?: "ship" | "pickup";
  sentToDistributorAt?: Date | null;
  sentToDistributorEmail?: string | null;
  distributorEmailStatus?: string | null;
  distributorEmailSentAt?: string | Date | null;
  distributorEmailTo?: string | null;
  distributorEmailError?: string | null;
  orderVerifiedAt?: string | Date | null;
  orderVerifiedBy?: string | null;
  orderShippedAt?: string | Date | null;
  orderShippedBy?: string | null;
  shipmentCarrier?: string | null;
  shipmentTracking?: string | null;
  orderSignedAt?: string | Date | null;
  orderSignedBy?: string | null;
  signerName?: string | null;
  crmSyncStatus?: string | null;
  crmSyncError?: string | null;
  /** "We received your order" note — separate from the verified email. */
  orderReceivedEmailSentAt?: string | Date | null;
  orderReceivedEmailTo?: string | null;
  /** Who sent the distributor PO (0227 timestamp + 0251 actor). */
  distributorEmailSentAt?: string | Date | null;
  distributorEmailSentBy?: string | null;
  /** Which affiliate's site generated the order. Null = direct/house order. */
  affiliateId?: number | null;
  affiliateName?: string | null;
  affiliateSlug?: string | null;
  affiliateHostname?: string | null;
  affiliateCustomDomain?: string | null;
  affiliateSiteUrl?: string | null;
  /** The dealer account the order was priced under — separate from affiliate. */
  dealerName?: string | null;
  dealerAccountName?: string | null;
  dealerCompany?: string | null;
  accountName?: string | null;
  paidAt?: string | Date | null;
  imageGeneratedCount?: number | null;
  lastImageGeneratedAt?: string | Date | null;
  shipments?: AdminOrderShipmentFact[];
  qboInvoiceId?: string | null;
  qboSyncedAt?: Date | null;
  orderKind?: string | null;
  projectLabel?: string | null;
  /** Present on the admin list response; shown only when the backend sends it. */
  orderRailStatus?: string | null;
};

export const ADMIN_ORDER_STATUS_COLORS: Record<AdminOrderStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  confirmed: "bg-green-500/20 text-green-700 dark:text-green-400",
  cancelled: "bg-destructive/20 text-destructive",
};

/**
 * Carriers Tom books orders through. The value saved on the order is whatever
 * the admin picks here, so an order that already carries another carrier keeps
 * showing that value instead of silently changing.
 */
export const ADMIN_ORDER_CARRIERS = [
  "FedEx",
  "Skyline",
  "Worldwide Express",
  "US Cabinet Depot",
] as const;

export type AdminOrderCarrier = (typeof ADMIN_ORDER_CARRIERS)[number];

/** US Cabinet Depot does not issue a tracking number; the field holds their order number. */
const ORDER_NUMBER_CARRIERS = new Set(["us cabinet depot"]);

export function adminOrderCarrierUsesOrderNumber(carrier: string | null | undefined): boolean {
  return ORDER_NUMBER_CARRIERS.has((carrier ?? "").trim().toLowerCase());
}

export function adminOrderTrackingFieldLabel(carrier: string | null | undefined): string {
  return adminOrderCarrierUsesOrderNumber(carrier) ? "Order number" : "Tracking number";
}

/**
 * Dropdown choices: the four standard carriers plus any carrier already saved
 * on the order, so an older value never disappears from the picker.
 */
export function adminOrderCarrierOptions(saved?: string | null): string[] {
  const options: string[] = [...ADMIN_ORDER_CARRIERS];
  const current = (saved ?? "").trim();
  if (current && !options.some((option) => option.toLowerCase() === current.toLowerCase())) {
    options.push(current);
  }
  return options;
}

export type AdminOrderShipmentSummary = {
  shipped: boolean;
  shippedAt: string | null;
  carrier: string | null;
  tracking: string | null;
  /** Only set when the codebase already knows that carrier's tracking URL. */
  trackingUrl: string | null;
};

function stamp(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function adminOrderShipment(order: Pick<AdminOrderRow, "orderShippedAt" | "shipmentCarrier" | "shipmentTracking" | "shipments">): AdminOrderShipmentSummary {
  const shipments = order.shipments ?? [];
  const fact = shipments.find((row) => row.status === "shipped" || row.shippedAt != null) ?? shipments[0] ?? null;
  const shippedAt = stamp(order.orderShippedAt) ?? stamp(fact?.shippedAt);
  const carrier = (order.shipmentCarrier ?? fact?.carrier ?? "").trim() || null;
  const tracking = (order.shipmentTracking ?? fact?.trackingNumber ?? "").trim() || null;
  return {
    shipped: shippedAt != null || fact?.status === "shipped",
    shippedAt,
    carrier,
    tracking,
    trackingUrl: carrier && tracking ? trackingUrl(carrier, tracking) : null,
  };
}

export function adminOrderVerified(order: Pick<AdminOrderRow, "orderVerifiedAt">): boolean {
  return stamp(order.orderVerifiedAt) != null;
}

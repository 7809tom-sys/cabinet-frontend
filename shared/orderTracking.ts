// Customer-facing order timeline. The later steps reuse the existing distributor
// trail (email sent, shipped, signed) so those dates are not calculated twice.
import { buildOrderStatusTrail, trailTimestamp, type OrderTrailInput } from "./orderStatusTrail";

export type OrderTrackingViewer = {
  userId: number;
  email: string | null;
  role: string;
  /** Set when this person can see an affiliate's referred orders. */
  affiliateId: number | null;
  /** Mirrors affiliate CRM access: owners and CRM members see referred orders. */
  affiliateCanSeeReferred: boolean;
};

export type OrderTrackingLine = {
  description: string;
  code: string | null;
  qty: number;
  unitPrice: number | null;
  linePrice: number | null;
};

export type CustomerOrderStepKey = "placed" | "sent_to_distributor" | "shipped" | "delivered";

export type CustomerOrderStep = {
  key: CustomerOrderStepKey;
  label: string;
  done: boolean;
  at: string | null;
  detail: string | null;
};

export type CustomerOrderInput = OrderTrailInput & {
  status?: string | null;
  createdAt?: string | Date | null;
  confirmedAt?: string | Date | null;
  paidAt?: string | Date | null;
};

const STEP_LABELS: Record<CustomerOrderStepKey, string> = {
  placed: "Placed",
  sent_to_distributor: "Sent to distributor",
  shipped: "Shipped",
  delivered: "Delivered",
};

function emailsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = (left ?? "").trim().toLowerCase();
  const b = (right ?? "").trim().toLowerCase();
  return a.length > 0 && a === b;
}

/**
 * Customers see orders they placed. Contractors see orders they placed.
 * Affiliates additionally see referred orders when the existing CRM rule allows
 * it (owner or CRM access on that affiliate).
 */
export function orderVisibleToViewer(
  order: { userId?: number | null; affiliateId?: number | null; originatorEmail?: string | null },
  viewer: OrderTrackingViewer,
): boolean {
  if (order.userId != null && order.userId === viewer.userId) return true;
  if (emailsMatch(order.originatorEmail, viewer.email)) return true;
  if (
    viewer.affiliateCanSeeReferred
    && viewer.affiliateId != null
    && order.affiliateId != null
    && order.affiliateId === viewer.affiliateId
  ) {
    return true;
  }
  return false;
}

export function buildCustomerOrderTimeline(input: CustomerOrderInput): CustomerOrderStep[] {
  const trail = buildOrderStatusTrail(input);
  const sent = trail.find((step) => step.key === "email_sent");
  const shipped = trail.find((step) => step.key === "shipped");
  const delivered = trail.find((step) => step.key === "signed");
  const status = (input.status ?? "").toLowerCase();
  const placedAt = trailTimestamp(input.paidAt)
    ?? trailTimestamp(input.confirmedAt)
    ?? (status === "draft" ? null : trailTimestamp(input.createdAt));
  const placed = placedAt != null && status !== "cancelled";

  return [
    { key: "placed", label: STEP_LABELS.placed, done: placed, at: placed ? placedAt : null, detail: null },
    {
      key: "sent_to_distributor",
      label: STEP_LABELS.sent_to_distributor,
      done: Boolean(sent?.done),
      at: sent?.at ?? null,
      detail: sent?.detail ?? null,
    },
    {
      key: "shipped",
      label: STEP_LABELS.shipped,
      done: Boolean(shipped?.done),
      at: shipped?.at ?? null,
      detail: shipped?.detail ?? null,
    },
    {
      key: "delivered",
      label: STEP_LABELS.delivered,
      done: Boolean(delivered?.done),
      at: delivered?.at ?? null,
      detail: delivered?.detail ?? null,
    },
  ];
}

export function invoiceMoney(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

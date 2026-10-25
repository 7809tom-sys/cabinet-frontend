// Shared, framework-free contract for the outbound CRM webhook. Kept pure so it
// can be unit-tested and reused by the server dispatcher and any future admin UI.
//
// Every business event that should reach an external CRM (Zapier / Make /
// GoHighLevel / HubSpot / any inbound webhook) is normalized into this shape,
// persisted in the `crm_events` table, and POSTed to CRM_WEBHOOK_URL.

/** The kinds of events Cabinet Dealz emits to a CRM. */
export const CRM_EVENT_TYPES = ["lead", "design_saved", "order_submitted"] as const;
export type CrmEventType = (typeof CRM_EVENT_TYPES)[number];

/** Human-readable labels for the event kinds (used in admin UI / logs). */
export const CRM_EVENT_LABELS: Record<CrmEventType, string> = {
  lead: "New lead",
  design_saved: "Design saved",
  order_submitted: "Order submitted",
};

/** White-label attribution attached to every event. */
export interface CrmDealerRef {
  /** Affiliate/dealer id, or null for the house / Cabinet Dealz pipeline. */
  affiliateId: number | null;
  /** The affiliate's referral code, when known. */
  referralCode: string | null;
  /** Display name resolved at send time (store name, or "Cabinet Dealz"). */
  dealerName: string;
}

/** The contact the event is about. */
export interface CrmContactRef {
  userId: number | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * The canonical JSON body POSTed to the webhook. Flat and stable so a Zapier /
 * Make "Catch Hook" can map fields without digging through nested objects.
 */
export interface CrmWebhookPayload {
  /** Schema version so downstream automations can branch safely. */
  version: 1;
  event: CrmEventType;
  eventLabel: string;
  /** ISO-8601 timestamp of when the event occurred. */
  occurredAt: string;
  // Attribution (flattened).
  affiliateId: number | null;
  referralCode: string | null;
  dealer: string;
  // Contact (flattened).
  userId: number | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  /** Event-specific details (design name, order number, totals, etc.). */
  data: Record<string, unknown>;
  /** Absolute link back into the platform for this record, when applicable. */
  link: string | null;
}

/** Assemble the canonical webhook payload from its parts. */
export function buildCrmWebhookPayload(args: {
  event: CrmEventType;
  occurredAt?: Date;
  dealer: CrmDealerRef;
  contact: CrmContactRef;
  data?: Record<string, unknown>;
  link?: string | null;
}): CrmWebhookPayload {
  const when = args.occurredAt ?? new Date();
  return {
    version: 1,
    event: args.event,
    eventLabel: CRM_EVENT_LABELS[args.event],
    occurredAt: when.toISOString(),
    affiliateId: args.dealer.affiliateId,
    referralCode: args.dealer.referralCode,
    dealer: args.dealer.dealerName,
    userId: args.contact.userId,
    contactName: args.contact.name,
    contactEmail: args.contact.email,
    contactPhone: args.contact.phone,
    data: args.data ?? {},
    link: args.link ?? null,
  };
}

/** The house pipeline reference used when no affiliate is attributed. */
export const HOUSE_DEALER: CrmDealerRef = {
  affiliateId: null,
  referralCode: null,
  dealerName: "Cabinet Dealz",
};

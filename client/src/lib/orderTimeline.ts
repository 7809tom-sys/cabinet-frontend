/**
 * The sales order Activity timeline: what happened to an order, in plain
 * sentences, with a named person on every line.
 *
 * "Tom bought cabinets · Nov 5, 6:40 PM CT"
 * "Selena approved the order · Nov 5, 7:02 PM CT"
 * "Selena sent the order to the distributor · Nov 5, 7:05 PM CT"
 *
 * Two sources feed it:
 *
 *  1. `order_events` — the append-only log (0251). Every action is written there,
 *     including repeats, so a resend shows up as its own line.
 *  2. The order's own `*_At` / `*_By` columns (0227 + 0251). Orders that predate
 *     the log have no rows, so `backfillOrderEvents()` derives them. The same
 *     fallback covers a column that was stamped but whose event row was lost.
 *
 * Naming: a person's display name, falling back to their email, "Customer" for
 * the buyer when we know nothing, and "System" for anything automatic.
 */

import { formatCentralTime } from "./orderStatusActor";

export type OrderEventAction =
  | "purchased"
  | "order_received_email"
  | "distributor_emailed"
  | "distributor_email_resent"
  | "verified"
  | "shipped"
  | "signed"
  | "receipt_sent"
  | "payment_notice"
  | "note";

/** One stored event row (order_events). */
export type OrderEventRecord = {
  id?: number | null;
  orderRequestId: number;
  action: OrderEventAction | string;
  actorUserId?: number | null;
  actorName?: string | null;
  detail?: string | null;
  createdAt: string | Date;
};

/** A rendered line on the timeline. */
export type OrderTimelineEntry = {
  /** Stable key: the event id, or the derived source when backfilled. */
  key: string;
  action: string;
  /** The whole sentence, e.g. "Selena approved the order · Nov 5, 7:02 PM CT". */
  sentence: string;
  /** Just the verb phrase, e.g. "approved the order". */
  text: string;
  /** Resolved display name: never empty. */
  actor: string;
  /** The exact moment, ISO. */
  at: string;
  /** True when the line was derived from the order columns, not the log. */
  derived: boolean;
};

export const CUSTOMER_FALLBACK_NAME = "Customer";
export const SYSTEM_FALLBACK_NAME = "System";

/**
 * Resolve the name to print for an actor. Never returns an empty string:
 * name → email → `fallback`. An automatic/absent actor becomes "System".
 */
export function resolveActorName(
  name: string | null | undefined,
  email: string | null | undefined,
  fallback: string = SYSTEM_FALLBACK_NAME,
): string {
  const who = (name ?? "").trim();
  if (who) return who;
  const address = (email ?? "").trim();
  if (address) return address;
  return fallback;
}

/** The buyer's name: their own name, then their email, then "Customer". */
export function resolveCustomerName(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  return resolveActorName(name, email, CUSTOMER_FALLBACK_NAME);
}

/** A stored actor label ("Dana Reaves <dana@x.com>") reduced to a display name. */
export function actorFromStoredLabel(value: string | null | undefined, fallback = SYSTEM_FALLBACK_NAME): string {
  const text = (value ?? "").trim();
  if (!text) return fallback;
  const angle = text.indexOf("<");
  if (angle === -1) return text;
  const name = text.slice(0, angle).trim();
  const email = text.slice(angle).replace(/[<>]/g, "").trim();
  return name || email || fallback;
}

function iso(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * The verb phrase for an action. `detail` carries the specifics (carrier and
 * tracking, who it went to) so the sentence stays readable.
 */
export function orderEventText(action: string, detail?: string | null): string {
  const extra = (detail ?? "").trim();
  switch (action) {
    case "purchased":
      return "bought cabinets";
    case "order_received_email":
      return extra ? `sent the order received email to ${extra}` : "sent the order received email";
    case "distributor_emailed":
      return extra ? `sent the order to the distributor (${extra})` : "sent the order to the distributor";
    case "distributor_email_resent":
      return extra ? `resent the order to the distributor (${extra})` : "resent the order to the distributor";
    case "verified":
      return "approved the order";
    case "shipped":
      return extra ? `shipped the order (${extra})` : "shipped the order";
    case "signed":
      return extra ? `recorded delivery signed for by ${extra}` : "recorded the order signed";
    case "receipt_sent":
      return extra ? `sent the receipt to ${extra}` : "sent the receipt";
    case "payment_notice":
      return "sent the payment notice";
    case "note":
      return extra || "added a note";
    default:
      return extra ? `${action.replace(/_/g, " ")} (${extra})` : action.replace(/_/g, " ");
  }
}

/** "Selena approved the order · Nov 5, 7:02 PM CT" */
export function orderEventSentence(actor: string, action: string, detail: string | null, at: string | Date): string {
  const when = formatCentralTime(at);
  const text = orderEventText(action, detail);
  return when ? `${actor} ${text} · ${when}` : `${actor} ${text}`;
}

function toEntry(
  key: string,
  actor: string,
  action: string,
  detail: string | null,
  at: string,
  derived: boolean,
): OrderTimelineEntry {
  return {
    key,
    action,
    text: orderEventText(action, detail),
    actor,
    at,
    derived,
    sentence: orderEventSentence(actor, action, detail, at),
  };
}

/** Enough of an order to derive a timeline for one that predates the log. */
export type OrderTimelineSource = {
  id: number;
  requestNumber?: string | null;
  customerName?: string | null;
  originatorName?: string | null;
  originatorEmail?: string | null;
  createdAt?: string | Date | null;
  paidAt?: string | Date | null;
  orderReceivedEmailSentAt?: string | Date | null;
  orderReceivedEmailTo?: string | null;
  distributorEmailStatus?: string | null;
  distributorEmailSentAt?: string | Date | null;
  distributorEmailTo?: string | null;
  distributorEmailSentBy?: string | null;
  orderVerifiedAt?: string | Date | null;
  orderVerifiedBy?: string | null;
  orderShippedAt?: string | Date | null;
  orderShippedBy?: string | null;
  shipmentCarrier?: string | null;
  shipmentTracking?: string | null;
  orderSignedAt?: string | Date | null;
  orderSignedBy?: string | null;
  signerName?: string | null;
  receiptSentAt?: string | Date | null;
  receiptEmailedAt?: string | Date | null;
};

/** Timeline lines derived from the order's own status columns (legacy orders). */
export function backfillOrderEvents(order: OrderTimelineSource): OrderTimelineEntry[] {
  const entries: OrderTimelineEntry[] = [];
  const customer = resolveCustomerName(order.customerName ?? order.originatorName, order.originatorEmail);

  const purchasedAt = iso(order.createdAt);
  if (purchasedAt) entries.push(toEntry(`derived:purchased:${order.id}`, customer, "purchased", null, purchasedAt, true));

  // A paidAt later than createdAt is when the card actually cleared; show it as
  // the purchase moment so "bought cabinets" matches the money.
  const paidAt = iso(order.paidAt);
  if (paidAt) {
    const index = entries.findIndex((entry) => entry.action === "purchased");
    if (index === -1) entries.push(toEntry(`derived:purchased:${order.id}`, customer, "purchased", null, paidAt, true));
    else entries[index] = toEntry(`derived:purchased:${order.id}`, customer, "purchased", null, paidAt, true);
  }

  const receivedAt = iso(order.orderReceivedEmailSentAt);
  if (receivedAt) {
    // Sending an acknowledgement is our action, so it is System unless an actor
    // was recorded elsewhere; the recipient rides along as the detail.
    entries.push(toEntry(`derived:order_received_email:${order.id}`, SYSTEM_FALLBACK_NAME, "order_received_email", order.orderReceivedEmailTo ?? null, receivedAt, true));
  }

  const distributorAt = iso(order.distributorEmailSentAt);
  if (distributorAt) {
    entries.push(toEntry(
      `derived:distributor_emailed:${order.id}`,
      actorFromStoredLabel(order.distributorEmailSentBy),
      "distributor_emailed",
      order.distributorEmailTo ?? null,
      distributorAt,
      true,
    ));
  }

  const verifiedAt = iso(order.orderVerifiedAt);
  if (verifiedAt) {
    entries.push(toEntry(`derived:verified:${order.id}`, actorFromStoredLabel(order.orderVerifiedBy), "verified", null, verifiedAt, true));
  }

  const shippedAt = iso(order.orderShippedAt);
  if (shippedAt) {
    const detail = [order.shipmentCarrier, order.shipmentTracking].map((part) => (part ?? "").trim()).filter(Boolean).join(" · ") || null;
    entries.push(toEntry(`derived:shipped:${order.id}`, actorFromStoredLabel(order.orderShippedBy), "shipped", detail, shippedAt, true));
  }

  const signedAt = iso(order.orderSignedAt);
  if (signedAt) {
    entries.push(toEntry(`derived:signed:${order.id}`, actorFromStoredLabel(order.orderSignedBy), "signed", order.signerName ?? null, signedAt, true));
  }

  const receiptAt = iso(order.receiptSentAt) ?? iso(order.receiptEmailedAt);
  if (receiptAt) {
    entries.push(toEntry(`derived:receipt_sent:${order.id}`, SYSTEM_FALLBACK_NAME, "receipt_sent", null, receiptAt, true));
  }

  return entries;
}

/** Oldest first, so the timeline reads top-down like a story. */
export function sortTimeline(entries: readonly OrderTimelineEntry[]): OrderTimelineEntry[] {
  return [...entries].sort((a, b) => {
    const byTime = Date.parse(a.at) - Date.parse(b.at);
    return byTime !== 0 ? byTime : a.key.localeCompare(b.key);
  });
}

/**
 * Build the timeline for one order: the logged events, plus any derived line for
 * a step the log is missing. A logged action wins over its derived twin, so a
 * verified order never shows "approved the order" twice.
 */
export function buildOrderTimeline(
  order: OrderTimelineSource,
  events: readonly OrderEventRecord[] = [],
): OrderTimelineEntry[] {
  const logged = events
    .filter((event) => event.orderRequestId === order.id)
    .map((event, index) => toEntry(
      `event:${event.id ?? index}`,
      resolveActorName(event.actorName, null, event.action === "purchased" ? resolveCustomerName(order.customerName ?? order.originatorName, order.originatorEmail) : SYSTEM_FALLBACK_NAME),
      event.action,
      event.detail ?? null,
      iso(event.createdAt) ?? String(event.createdAt),
      false,
    ));

  const covered = new Set(logged.map((entry) => entry.action));
  const derived = backfillOrderEvents(order).filter((entry) => !covered.has(entry.action));
  return sortTimeline([...logged, ...derived]);
}

/** Group a timeline by Central calendar day, newest day first, for display. */
export function groupTimelineByDay(entries: readonly OrderTimelineEntry[]): Array<{ day: string; entries: OrderTimelineEntry[] }> {
  const groups = new Map<string, OrderTimelineEntry[]>();
  for (const entry of sortTimeline(entries)) {
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(entry.at));
    const bucket = groups.get(day) ?? [];
    bucket.push(entry);
    groups.set(day, bucket);
  }
  return Array.from(groups.entries()).map(([day, dayEntries]) => ({ day, entries: dayEntries }));
}

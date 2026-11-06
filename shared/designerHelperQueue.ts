/**
 * Designer helper queue: the shared rules behind "Share / Get a designer helper".
 *
 * A customer working in the 3D Designer presses Share / Get a designer helper.
 * That shares the current design and creates one help request. Every designer
 * whose Helper sign is on is queued for that request and sees it in the app.
 * A designer's queue entry carries the regular email address from their user
 * account, so the request can also be mailed to them.
 *
 * This module is deliberately free of React, tRPC, the database, and any mailer.
 * The client renders from it and the backend patch imports the same rules, so a
 * status, a queue order, or a sentence is only written once.
 */

export const HELPER_REQUEST_STATUSES = [
  "open",
  "accepted",
  "joined",
  "closed",
  "cancelled",
] as const;

export type HelperRequestStatus = (typeof HELPER_REQUEST_STATUSES)[number];

export type HelperEventAction =
  | "requested"
  | "shared"
  | "notified"
  | "emailed"
  | "email_skipped"
  | "accepted"
  | "joined"
  | "closed";

/** One customer help request, as both the customer and the staff side see it. */
export type HelperRequest = {
  id: number;
  designId: number | null;
  designName: string | null;
  customerUserId: number | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  /** What the customer typed into "What do you need help with?". */
  helpNote: string | null;
  status: HelperRequestStatus;
  /** Read-only share link the customer's design is opened through. */
  shareToken: string | null;
  affiliateSlug: string | null;
  requestedAt: string;
  acceptedByUserId: number | null;
  acceptedByName: string | null;
  acceptedAt: string | null;
  joinedByUserId: number | null;
  joinedByName: string | null;
  joinedAt: string | null;
  closedAt: string | null;
};

/** One designer's place in the helper queue. */
export type HelperQueueEntry = {
  designerUserId: number;
  designerName: string;
  /** The designer's regular email address, taken from their user account. */
  email: string | null;
  /** Helper sign on or off. Off means no request is sent to this designer. */
  available: boolean;
  signedOnAt: string | null;
  acceptedCount: number;
};

export const HELPER_SIGN_ON_COPY =
  "Helper sign is ON. You are in the queue, so a customer's design will come up in front of you as a help request.";

export const HELPER_SIGN_OFF_COPY =
  "Helper sign is OFF. You are not in the queue, so no customer help requests are sent to you.";

export const HELPER_QUEUE_FRONT_COPY =
  "You are in the queue. The next customer who asks for a designer helper will see your name and their design will come up in front of you.";

export function helperRequestIsOpen(status: HelperRequestStatus): boolean {
  return status === "open" || status === "accepted";
}

/** A request a designer can still pick up: open, nobody has taken it. */
export function helperRequestNeedsHelper(request: Pick<HelperRequest, "status">): boolean {
  return request.status === "open";
}

export function helperStatusLabel(status: HelperRequestStatus): string {
  switch (status) {
    case "open":
      return "Waiting for a designer";
    case "accepted":
      return "Accepted by a designer";
    case "joined":
      return "Designer in the design";
    case "closed":
      return "Closed";
    case "cancelled":
      return "Cancelled by the customer";
  }
}

/** Only a signed-on designer with a recorded sign-on time is queued. */
export function helperCanReceiveRequests(entry: Pick<HelperQueueEntry, "available" | "signedOnAt">): boolean {
  return entry.available && Boolean(entry.signedOnAt);
}

function time(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

/**
 * Who is notified, and in what order. Longest-waiting designer first, so one
 * helper does not collect every request while another waits.
 */
export function helperNotificationOrder<T extends Pick<HelperQueueEntry, "designerUserId" | "available" | "signedOnAt">>(
  entries: readonly T[],
): T[] {
  return entries
    .filter((entry) => helperCanReceiveRequests(entry))
    .slice()
    .sort((a, b) => time(a.signedOnAt) - time(b.signedOnAt) || a.designerUserId - b.designerUserId);
}

/** 1-based place in the queue, or null when this designer is not queued. */
export function helperQueuePosition<
  T extends Pick<HelperQueueEntry, "designerUserId" | "available" | "signedOnAt">,
>(entries: readonly T[], designerUserId: number): number | null {
  const ordered = helperNotificationOrder(entries);
  const index = ordered.findIndex((entry) => entry.designerUserId === designerUserId);
  return index < 0 ? null : index + 1;
}

/** A usable mail address, or null. Never guesses or invents one. */
export function helperEmailTarget(email: string | null | undefined): string | null {
  const trimmed = (email ?? "").trim();
  if (!trimmed) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/** The address carried on the queue entry, from the user account on file. */
export function helperQueueEmail(entry: Pick<HelperQueueEntry, "email">): string | null {
  return helperEmailTarget(entry.email);
}

export type HelperNotifyPlan = {
  /** Designers queued for this request, in queue order. */
  queued: number[];
  /** Designers whose queue entry has a usable email address on file. */
  emailTargets: string[];
  /** Queued designers with no usable address, so the app can say who has none. */
  missingEmail: number[];
};

/**
 * What a new request turns into. In-app notice always goes to every queued
 * designer; email only goes to queued designers whose entry carries a valid
 * address. `mailerConfigured` never removes a designer from the in-app notice.
 */
export function planHelperNotification(
  entries: readonly HelperQueueEntry[],
  options?: { mailerConfigured?: boolean },
): HelperNotifyPlan {
  const queuedEntries = helperNotificationOrder(entries);
  const plan: HelperNotifyPlan = { queued: [], emailTargets: [], missingEmail: [] };
  for (const entry of queuedEntries) {
    plan.queued.push(entry.designerUserId);
    const target = helperQueueEmail(entry);
    if (!target) {
      plan.missingEmail.push(entry.designerUserId);
      continue;
    }
    if (options?.mailerConfigured === false) continue;
    plan.emailTargets.push(target);
  }
  return plan;
}

/** One plain sentence for the customer after the request is made. */
export function helperRequestSentCopy(plan: HelperNotifyPlan, mailerConfigured: boolean): string {
  if (plan.queued.length === 0) {
    return "Your design is shared. No designer has their Helper sign on right now, so your request is waiting in the admin queue.";
  }
  const designers = plan.queued.length === 1 ? "1 designer" : `${plan.queued.length} designers`;
  if (!mailerConfigured) {
    return `Your design is shared and ${designers} with Helper sign on has the request in the app. Email is not configured on this server, so no email was sent.`;
  }
  if (plan.emailTargets.length === 0) {
    return `Your design is shared and ${designers} with Helper sign on has the request in the app. None of them has an email address on file, so no email was sent.`;
  }
  const emails = plan.emailTargets.length === 1 ? "1 email" : `${plan.emailTargets.length} emails`;
  return `Your design is shared, ${designers} with Helper sign on has the request in the app, and ${emails} went to the address on file.`;
}

/** Plain statement of the mailer state, shown wherever a helper is listed. */
export function helperMailerNotice(mailerConfigured: boolean): string {
  return mailerConfigured
    ? "Email is on. The request is also mailed to each queued designer's address on file."
    : "Email is not configured on the server. Requests still appear in the app for every queued designer, and no email is sent.";
}

export function helperEmailSkippedCopy(reason: "no-mailer" | "no-address"): string {
  return reason === "no-mailer"
    ? "No email sent: the server mailer is not configured."
    : "No email sent: no address on file.";
}

/** Local time for a request row, e.g. "Nov 6, 2026, 9:14 AM". Empty when unset. */
export function helperRequestTimeLabel(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Who is on the request, and when — the same sentence on every surface. */
export function helperRequestOwnerLabel(request: Pick<HelperRequest, "status" | "acceptedByName" | "acceptedAt" | "joinedByName" | "joinedAt">): string {
  const accepted = request.acceptedByName
    ? `${request.acceptedByName} accepted ${helperRequestTimeLabel(request.acceptedAt)}`
    : "Not accepted yet";
  if (!request.joinedByName) return accepted;
  return `${accepted} · ${request.joinedByName} joined the design ${helperRequestTimeLabel(request.joinedAt)}`;
}

export type HelperRequestSummaryRow = { label: string; value: string };

/** Every field the admin pop-up shows, in one place so nothing is dropped. */
export function helperRequestSummaryRows(request: HelperRequest): HelperRequestSummaryRow[] {
  const contact = [request.customerEmail, request.customerPhone].filter((part) => Boolean(part && part.trim()));
  return [
    { label: "Customer", value: request.customerName?.trim() || "Customer name not given" },
    { label: "Contact", value: contact.length ? contact.join(" · ") : "No email or phone on the request" },
    { label: "Design", value: request.designName?.trim() || (request.designId != null ? `Design #${request.designId}` : "No saved design") },
    { label: "What they need", value: request.helpNote?.trim() || "No note — the customer wants a designer's opinion on this plan" },
    { label: "Requested", value: helperRequestTimeLabel(request.requestedAt) || "Just now" },
    { label: "Status", value: helperStatusLabel(request.status) },
    { label: "Who has it", value: helperRequestOwnerLabel(request) },
  ];
}

/**
 * Where a designer or admin opens the customer's design to help.
 *
 * `assist=1` is the Designer's existing assisted-editing mode, and `load` is the
 * saved design it opens, so the helper works on the customer's own plan.
 */
export function helperRequestDesignPath(args: {
  designId: number | null;
  requestId: number | null;
  affiliateSlug?: string | null;
}): string {
  const params = new URLSearchParams();
  if (args.designId != null) params.set("load", String(args.designId));
  if (args.requestId != null) params.set("helperRequest", String(args.requestId));
  params.set("assist", "1");
  const slug = (args.affiliateSlug ?? "").trim();
  if (slug) params.set("affiliate", slug);
  return `/design?${params.toString()}`;
}

/** The customer's own read-only view of the shared design. */
export function helperRequestSharePath(args: { shareToken: string }): string {
  return `/design/session/${encodeURIComponent(args.shareToken)}`;
}

/** The single helper-request id a "join" came from, as carried on the design URL. */
export function helperRequestIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("helperRequest");
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const HELPER_REQUEST_EMAIL_SUBJECT_PREFIX = "Designer helper needed";

export function helperRequestEmailSubject(request: Pick<HelperRequest, "customerName" | "designName" | "id">): string {
  const who = request.customerName?.trim() || "A customer";
  const design = request.designName?.trim() || "a kitchen design";
  return `${HELPER_REQUEST_EMAIL_SUBJECT_PREFIX}: ${who} asked for help on ${design} (request #${request.id})`;
}

/** Plain-text helper email. No tracking, no invented promises, one clear link. */
export function helperRequestEmailBody(args: {
  request: Pick<HelperRequest, "id" | "customerName" | "designName" | "helpNote" | "requestedAt">;
  helperName: string;
  designPath: string;
}): string {
  const { request, helperName, designPath } = args;
  const customer = request.customerName?.trim() || "A customer";
  const design = request.designName?.trim() || "a kitchen design";
  const note = request.helpNote?.trim();
  return [
    `Hi ${helperName},`,
    "",
    `${customer} is working on ${design} in the CabinetDealz 3D Designer and asked for a designer helper.`,
    note ? `What they need help with: ${note}` : "They did not type a note — they want a designer to look over the plan.",
    `Requested: ${helperRequestTimeLabel(request.requestedAt) || "just now"} (request #${request.id}).`,
    "",
    `Open the customer's design: ${designPath}`,
    "",
    "You are getting this because your Helper sign is on. Turn it off on your Designer Workspace helper tab to stop receiving these.",
    "",
    "CabinetDealz",
  ].join("\n");
}

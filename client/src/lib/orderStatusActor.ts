/**
 * Who changed an order's status, and when — shown as
 * "Verified by Dana Reaves · Nov 5, 2026, 2:47 PM CT".
 *
 * The 0227 columns (`orderVerifiedBy`, `orderShippedBy`, `orderSignedBy`) are
 * VARCHAR(255), so the actor is stored as "Name <email>" — readable on a report
 * and still a real address you can copy. The *At columns are TIMESTAMP and hold
 * the exact moment; they are rendered in Cabinet Dealz's own timezone (Central),
 * because "2:47 PM" on an order means Central to everyone who works these.
 */

export const ORDER_STATUS_TIME_ZONE = "America/Chicago";
export const ORDER_STATUS_TIME_ZONE_LABEL = "CT";

/**
 * "Dana Reaves <dana@cabinetdealz.com>", "dana@cabinetdealz.com" when there is no
 * name, or the plain name when there is no email. Trimmed to the column width.
 */
export function orderActorLabel(
  name: string | null | undefined,
  email: string | null | undefined,
  fallback = "Admin",
): string {
  const who = (name ?? "").trim();
  const address = (email ?? "").trim();
  if (who && address) return `${who} <${address}>`.slice(0, 255);
  if (who) return who.slice(0, 255);
  if (address) return address.slice(0, 255);
  return fallback.slice(0, 255);
}

/** The name part of a stored actor label, for compact display. */
export function orderActorName(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  const angle = text.indexOf("<");
  if (angle === -1) return text;
  const name = text.slice(0, angle).trim();
  return name || text.slice(angle).replace(/[<>]/g, "").trim() || null;
}

/** The email part of a stored actor label, when one was recorded. */
export function orderActorEmail(value: string | null | undefined): string | null {
  const match = /<([^>]+)>/.exec(value ?? "");
  return match ? match[1].trim() : null;
}

function asDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Nov 5, 2026, 2:47 PM CT" — the timezone is fixed, not the viewer's. */
export function formatCentralTime(value: string | Date | null | undefined): string | null {
  const date = asDate(value);
  if (!date) return null;
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: ORDER_STATUS_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${formatted} ${ORDER_STATUS_TIME_ZONE_LABEL}`;
}

/** "Nov 5, 2026" in Central time. */
export function formatCentralDate(value: string | Date | null | undefined): string | null {
  const date = asDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ORDER_STATUS_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** "2026-11-05 13:47 CT" for CSV cells — sortable in a spreadsheet, still local. */
export function formatCentralForCsv(value: string | Date | null | undefined): string {
  const date = asDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ORDER_STATUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} CT`;
}

/** Whole Central calendar days from `since` to `now`. */
export function centralDaysSince(
  since: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  const date = asDate(since);
  if (!date) return null;
  // Compare Central calendar dates so "3 days" does not depend on the hour.
  const dayKey = (value: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: ORDER_STATUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
  const ms = Date.parse(`${dayKey(now)}T00:00:00Z`) - Date.parse(`${dayKey(date)}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : null;
}

export type OrderStatusActorInput = {
  by: string | null | undefined;
  at: string | Date | null | undefined;
};

/**
 * "Verified by Dana Reaves · Nov 5, 2026, 2:47 PM CT", or null when the step has
 * not happened. The full "Name <email>" stays available as the tooltip.
 */
export function describeOrderActor(
  action: string,
  step: OrderStatusActorInput,
): { label: string; full: string | null } | null {
  const when = formatCentralTime(step.at);
  if (!when) return null;
  const name = orderActorName(step.by);
  const email = orderActorEmail(step.by);
  const full = [name, email].filter(Boolean).join(" · ") || null;
  return {
    label: `${action} by ${name ?? "—"} · ${when}`,
    full,
  };
}

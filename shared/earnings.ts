// ─── Cabinet Dealz affiliate earnings + payout math ─────────────────────────
// Pure, deterministic helpers for computing what an affiliate earns on a
// confirmed order and for grouping those earnings into weekly payout buckets.
// No I/O — fully unit-testable. Money is whole CENTS; rates are fractions
// (0.05 = 5%) to match the affiliates.commissionRate decimal column.

import { roundCents } from "./pricing";

/** Convert a dollars value (number or numeric string) to whole cents. */
export function dollarsToCents(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return 0;
  return roundCents(n * 100);
}

export interface EarningInput {
  /** Customer-facing order total in cents (what the buyer pays for cabinets). */
  customerTotalCents: number;
  /** Affiliate commission rate as a fraction (0.05 = 5%). */
  commissionRate: number;
}

export interface Earning {
  customerTotalCents: number;
  commissionRate: number;
  /** Commission owed to the affiliate, in cents. */
  commissionCents: number;
}

/**
 * Commission an affiliate earns on a single confirmed order. Defensive against
 * negative / non-finite inputs; rate is clamped to [0, 1].
 */
export function computeEarning(input: EarningInput): Earning {
  const customerTotalCents = Math.max(0, roundCents(input.customerTotalCents));
  const rate = Number.isFinite(input.commissionRate)
    ? Math.min(1, Math.max(0, input.commissionRate))
    : 0;
  return {
    customerTotalCents,
    commissionRate: rate,
    commissionCents: roundCents(customerTotalCents * rate),
  };
}

// ─── ISO week bucketing ──────────────────────────────────────────────────────
// Payouts run weekly, so confirmed orders are grouped by ISO-8601 week
// (Mon–Sun). isoWeekKey returns a sortable "YYYY-Www" string (e.g. "2026-W26").

/** ISO-8601 week-numbering: returns { year, week } for a given Date (UTC). */
export function isoWeekParts(date: Date): { year: number; week: number } {
  // Copy and shift to Thursday of the current ISO week (ISO weeks belong to the
  // year containing their Thursday).
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sun=0 → 7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year, week };
}

/** Sortable ISO-week key, e.g. "2026-W07". */
export function isoWeekKey(date: Date): string {
  const { year, week } = isoWeekParts(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Monday 00:00:00 UTC that starts the ISO week containing `date`. */
export function isoWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

export interface WeeklyBucketItem {
  /** Any timestamp used to place the item in a week (e.g. confirmedAt). */
  at: Date;
  /** Commission owed for this item, in cents. */
  commissionCents: number;
}

export interface WeeklyBucket {
  weekKey: string;
  weekStart: Date;
  count: number;
  totalCommissionCents: number;
}

/**
 * Group earning items into weekly buckets, newest week first. Deterministic and
 * stable for equal weeks (sorted descending by weekKey).
 */
export function groupByWeek(items: WeeklyBucketItem[]): WeeklyBucket[] {
  const map = new Map<string, WeeklyBucket>();
  for (const it of items) {
    const key = isoWeekKey(it.at);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalCommissionCents += Math.max(0, roundCents(it.commissionCents));
    } else {
      map.set(key, {
        weekKey: key,
        weekStart: isoWeekStart(it.at),
        count: 1,
        totalCommissionCents: Math.max(0, roundCents(it.commissionCents)),
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.weekKey < b.weekKey ? 1 : a.weekKey > b.weekKey ? -1 : 0));
}

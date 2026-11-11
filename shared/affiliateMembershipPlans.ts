// Plan rules for the two affiliate membership prices.
// Dollar amounts come from AFFILIATE_MEMBERSHIP in shared/affiliate.ts.
// This file turns those dollars into cents, terms, and the three-month rule.
// No database, no Stripe client, no clock of its own.

import { AFFILIATE_MEMBERSHIP } from "./affiliate";
import { computeMembershipPeriodEnd } from "./salesPrograms";

export const MEMBERSHIP_PLAN_IDS = ["annual", "monthly"] as const;
export type MembershipPlan = (typeof MEMBERSHIP_PLAN_IDS)[number];

export const ANNUAL_MEMBERSHIP_FEE_CENTS = AFFILIATE_MEMBERSHIP.priceUsd * 100;
export const MONTHLY_MEMBERSHIP_FEE_CENTS = AFFILIATE_MEMBERSHIP.monthlyPriceUsd * 100;
export const ANNUAL_TERM_MONTHS = 12;
export const MONTHLY_MINIMUM_MONTHS = AFFILIATE_MEMBERSHIP.monthlyMinimumMonths;

export interface MembershipPlanOption {
  id: MembershipPlan;
  label: string;
  amountCents: number;
  recurringInterval: "month" | null;
  periodsPerTerm: number;
  minimumMonths: number;
  minimumCommitmentCents: number;
  description: string;
}

export const MEMBERSHIP_PLAN_OPTIONS: Record<MembershipPlan, MembershipPlanOption> = {
  annual: {
    id: "annual",
    label: "Annual",
    amountCents: ANNUAL_MEMBERSHIP_FEE_CENTS,
    recurringInterval: null,
    periodsPerTerm: 1,
    minimumMonths: ANNUAL_TERM_MONTHS,
    minimumCommitmentCents: ANNUAL_MEMBERSHIP_FEE_CENTS,
    description: "Pay once a year. Renews when you pay for the next year. The year already paid is not refunded.",
  },
  monthly: {
    id: "monthly",
    label: "Monthly",
    amountCents: MONTHLY_MEMBERSHIP_FEE_CENTS,
    recurringInterval: "month",
    periodsPerTerm: 1,
    minimumMonths: MONTHLY_MINIMUM_MONTHS,
    minimumCommitmentCents: MONTHLY_MEMBERSHIP_FEE_CENTS * MONTHLY_MINIMUM_MONTHS,
    description: `Pay every month. The first ${MONTHLY_MINIMUM_MONTHS} months are a minimum. After that, cancel any time and billing stops at the end of the month already paid.`,
  },
};

export function isMembershipPlan(value: unknown): value is MembershipPlan {
  return typeof value === "string" && (MEMBERSHIP_PLAN_IDS as readonly string[]).includes(value);
}

export function normalizeMembershipPlan(value: unknown): MembershipPlan {
  return isMembershipPlan(value) ? value : "annual";
}

export function membershipPlanOption(plan: unknown): MembershipPlanOption {
  return MEMBERSHIP_PLAN_OPTIONS[normalizeMembershipPlan(plan)];
}

/** Plans in the order a picker should show them (monthly, then annual). */
export function membershipPlanChoices(): MembershipPlanOption[] {
  return AFFILIATE_MEMBERSHIP.planIds.map((id) => MEMBERSHIP_PLAN_OPTIONS[id]);
}

export function formatPlanAmount(amountCents: number): string {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return "$0";
  const dollars = Math.round(amountCents / 100);
  return `$${dollars.toLocaleString("en-US")}`;
}

export function formatPlanPrice(plan: unknown): string {
  const option = membershipPlanOption(plan);
  const period = option.id === "annual" ? "year" : "month";
  return `${formatPlanAmount(option.amountCents)}/${period}`;
}

export function addMonthsUtc(fromMs: number, months: number): number {
  const from = new Date(fromMs);
  const monthIndex = from.getUTCMonth() + months;
  const year = from.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(
    year,
    month,
    Math.min(from.getUTCDate(), daysInTargetMonth),
    from.getUTCHours(),
    from.getUTCMinutes(),
    from.getUTCSeconds(),
    from.getUTCMilliseconds(),
  );
}

export interface MembershipTerm {
  periodStartMs: number;
  periodEndMs: number;
  commitmentEndsAtMs: number;
}

export interface MembershipTermInput {
  plan: MembershipPlan;
  paidAtMs: number;
  currentPeriodEndMs?: number | null;
  currentCommitmentEndMs?: number | null;
}

export function computeMembershipTerm(input: MembershipTermInput): MembershipTerm {
  const plan = normalizeMembershipPlan(input.plan);
  const { paidAtMs } = input;
  const periodStartMs =
    input.currentPeriodEndMs && input.currentPeriodEndMs > paidAtMs ? input.currentPeriodEndMs : paidAtMs;
  const carriedCommitmentMs =
    input.currentCommitmentEndMs && input.currentCommitmentEndMs > paidAtMs
      ? input.currentCommitmentEndMs
      : null;

  if (plan === "annual") {
    const periodEndMs = computeMembershipPeriodEnd(paidAtMs, input.currentPeriodEndMs ?? null);
    return {
      periodStartMs,
      periodEndMs,
      commitmentEndsAtMs: Math.max(periodEndMs, carriedCommitmentMs ?? 0),
    };
  }

  const periodEndMs = addMonthsUtc(periodStartMs, 1);
  const commitmentEndsAtMs = carriedCommitmentMs ?? addMonthsUtc(periodStartMs, MONTHLY_MINIMUM_MONTHS);
  return { periodStartMs, periodEndMs, commitmentEndsAtMs };
}

export interface CancellationDecision {
  allowed: boolean;
  blockedReason: "monthly_minimum_commitment" | null;
  accessUntilMs: number | null;
  minimumCommitmentEndsAtMs: number | null;
}

export interface CancellationAssessmentInput {
  plan: MembershipPlan | null | undefined;
  nowMs: number;
  periodEndMs?: number | null;
  commitmentEndsAtMs?: number | null;
}

/**
 * Our own cancel button. Monthly members cannot cancel until the three-month
 * minimum ends. Annual members can cancel, and access still runs to the end
 * of the year already paid.
 */
export function assessMembershipCancellation(input: CancellationAssessmentInput): CancellationDecision {
  const plan = normalizeMembershipPlan(input.plan);
  const periodEndMs = input.periodEndMs ?? null;

  if (plan === "monthly") {
    const minimumCommitmentEndsAtMs = input.commitmentEndsAtMs ?? null;
    if (minimumCommitmentEndsAtMs != null && input.nowMs < minimumCommitmentEndsAtMs) {
      return {
        allowed: false,
        blockedReason: "monthly_minimum_commitment",
        accessUntilMs: minimumCommitmentEndsAtMs,
        minimumCommitmentEndsAtMs,
      };
    }
    return {
      allowed: true,
      blockedReason: null,
      accessUntilMs: periodEndMs != null && periodEndMs > input.nowMs ? periodEndMs : input.nowMs,
      minimumCommitmentEndsAtMs,
    };
  }

  return {
    allowed: true,
    blockedReason: null,
    accessUntilMs: periodEndMs != null && periodEndMs > input.nowMs ? periodEndMs : input.nowMs,
    minimumCommitmentEndsAtMs: null,
  };
}

export function canCancelMembership(input: CancellationAssessmentInput): boolean {
  return assessMembershipCancellation(input).allowed;
}

export type MonthlyMinimumStripeGuard =
  | { action: "allow" }
  | { action: "bill_remaining_months"; cancelAtMs: number };

/**
 * Stripe-side guard for a monthly subscription.
 *
 * The membership is a normal monthly Stripe subscription (Stripe retries failed
 * renewals itself). The three-month minimum is not three months charged up
 * front. If Stripe is asked to stop billing before the commitment date — the
 * customer portal, or cancel_at_period_end — this tells the webhook to move
 * cancel_at out to the commitment date so the remaining months are still
 * invoiced. Once the requested stop is already on or after that date, Stripe
 * is left alone. A second webhook from our own update is therefore a no-op.
 */
export function monthlyMinimumStripeGuard(input: {
  plan: MembershipPlan | null | undefined;
  nowMs: number;
  commitmentEndsAtMs: number | null | undefined;
  cancelRequested: boolean;
  requestedCancelAtMs: number | null | undefined;
}): MonthlyMinimumStripeGuard {
  if (normalizeMembershipPlan(input.plan) !== "monthly") return { action: "allow" };
  if (!input.cancelRequested) return { action: "allow" };
  const commitmentEndsAtMs = input.commitmentEndsAtMs ?? null;
  if (commitmentEndsAtMs == null || input.nowMs >= commitmentEndsAtMs) return { action: "allow" };
  const requested = input.requestedCancelAtMs ?? null;
  // cancel_at_period_end has no timestamp. Treat that as "stop at the current
  // period", which is earlier than the commitment, so the remaining months
  // still have to be billed.
  if (requested != null && requested >= commitmentEndsAtMs) return { action: "allow" };
  return { action: "bill_remaining_months", cancelAtMs: commitmentEndsAtMs };
}

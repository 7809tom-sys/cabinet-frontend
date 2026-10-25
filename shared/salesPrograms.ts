// Pure, framework-free business rules for the sales-rep commission program and
// the affiliate annual membership term. Kept here (shared) so both the server
// procedures and unit tests use exactly the same logic — no drift.

// ─── Sales-rep commission ─────────────────────────────────────────────────────
// A flat, one-time commission paid to the 1099 sales rep who owns a deal, the
// first time that deal becomes "won". Sales reps are independent contractors, so
// this is a contractor payout (no withholding implied).
export const SALES_REP_COMMISSION_USD = 400;
export const SALES_REP_COMMISSION_CENTS = SALES_REP_COMMISSION_USD * 100;

export type CommissionDecisionInput = {
  /** Role of the deal owner. Only "sales_rep" earns a commission. */
  ownerRole: string | null | undefined;
  /** The stage the deal is transitioning INTO. */
  nextStage: string;
  /** The stage the deal was in BEFORE this change. */
  previousStage: string | null | undefined;
  /** True if a commission row already exists for this deal (idempotency guard). */
  commissionAlreadyExists: boolean;
};

/**
 * Decide whether to create a $400 commission row for a deal transition.
 * Rules:
 *  - Owner must be a sales_rep.
 *  - The deal must be transitioning INTO "won" (not already won).
 *  - No commission may already exist for the deal (pay once, ever).
 */
export function shouldCreateCommission(input: CommissionDecisionInput): boolean {
  const { ownerRole, nextStage, previousStage, commissionAlreadyExists } = input;
  if (ownerRole !== "sales_rep") return false;
  if (nextStage !== "won") return false;
  if (previousStage === "won") return false; // already won; no re-trigger
  if (commissionAlreadyExists) return false; // idempotent
  return true;
}

// ─── Affiliate annual membership term ─────────────────────────────────────────
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MEMBERSHIP_TERM_DAYS = 365;

/**
 * Compute the new membership period end when an invoice is paid.
 * - If the member has no active term (or it already lapsed), the new term starts
 *   at the payment date and runs one year.
 * - If the member still has time left, a renewal STACKS on top of the remaining
 *   term (extends from the current end), so paying early never loses days.
 */
export function computeMembershipPeriodEnd(
  paidAtMs: number,
  currentPeriodEndMs: number | null | undefined,
  termDays: number = MEMBERSHIP_TERM_DAYS,
): number {
  const base =
    currentPeriodEndMs && currentPeriodEndMs > paidAtMs
      ? currentPeriodEndMs
      : paidAtMs;
  return base + termDays * MS_PER_DAY;
}

/** Is the membership active at a given moment? */
export function isMembershipActive(
  nowMs: number,
  periodEndMs: number | null | undefined,
): boolean {
  return !!periodEndMs && periodEndMs > nowMs;
}

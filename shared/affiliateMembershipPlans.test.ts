import { describe, expect, it } from "vitest";
import { AFFILIATE_MEMBERSHIP, membershipOptionsLabel, membershipPriceLabel, monthlyMembershipPriceLabel } from "./affiliate";
import {
  ANNUAL_MEMBERSHIP_FEE_CENTS,
  MONTHLY_MEMBERSHIP_FEE_CENTS,
  MONTHLY_MINIMUM_MONTHS,
  addMonthsUtc,
  assessMembershipCancellation,
  computeMembershipTerm,
  membershipPlanChoices,
  monthlyMinimumStripeGuard,
} from "./affiliateMembershipPlans";

describe("affiliate membership prices", () => {
  it("keeps both prices in shared/affiliate.ts", () => {
    expect(AFFILIATE_MEMBERSHIP.priceUsd).toBe(1195);
    expect(AFFILIATE_MEMBERSHIP.monthlyPriceUsd).toBe(169);
    expect(AFFILIATE_MEMBERSHIP.monthlyMinimumMonths).toBe(3);
    expect(ANNUAL_MEMBERSHIP_FEE_CENTS).toBe(119500);
    expect(MONTHLY_MEMBERSHIP_FEE_CENTS).toBe(16900);
    expect(MONTHLY_MINIMUM_MONTHS).toBe(3);
  });

  it("shows both options anywhere a single annual price used to stand alone", () => {
    expect(membershipPriceLabel()).toBe("$1,195/year");
    expect(monthlyMembershipPriceLabel()).toBe("$169/month");
    expect(membershipOptionsLabel()).toBe("$169/month (3-month minimum) or $1,195/year");
  });
});

describe("membership plan picker", () => {
  it("offers monthly first, then annual, with the minimum on the monthly plan", () => {
    const choices = membershipPlanChoices();
    expect(choices.map((choice) => choice.id)).toEqual(["monthly", "annual"]);
    expect(choices[0]).toMatchObject({ amountCents: 16900, minimumMonths: 3, recurringInterval: "month" });
    expect(choices[1]).toMatchObject({ amountCents: 119500, recurringInterval: null });
    expect(choices[0].description).toMatch(/3 months/i);
  });
});

describe("three-month minimum", () => {
  const start = Date.UTC(2026, 0, 15, 12, 0, 0);

  it("sets the monthly commitment three calendar months out and stacks later months on it", () => {
    const first = computeMembershipTerm({ plan: "monthly", paidAtMs: start });
    expect(first.commitmentEndsAtMs).toBe(addMonthsUtc(start, 3));
    expect(first.periodEndMs).toBe(addMonthsUtc(start, 1));

    const second = computeMembershipTerm({
      plan: "monthly",
      paidAtMs: first.periodEndMs,
      currentPeriodEndMs: first.periodEndMs,
      currentCommitmentEndMs: first.commitmentEndsAtMs,
    });
    expect(second.commitmentEndsAtMs).toBe(first.commitmentEndsAtMs);
    expect(second.periodEndMs).toBe(addMonthsUtc(first.periodEndMs, 1));
  });

  it("blocks a cancel before the commitment date", () => {
    const term = computeMembershipTerm({ plan: "monthly", paidAtMs: start });
    const blocked = assessMembershipCancellation({
      plan: "monthly",
      nowMs: addMonthsUtc(start, 1),
      periodEndMs: term.periodEndMs,
      commitmentEndsAtMs: term.commitmentEndsAtMs,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.blockedReason).toBe("monthly_minimum_commitment");

    const open = assessMembershipCancellation({
      plan: "monthly",
      nowMs: term.commitmentEndsAtMs,
      periodEndMs: term.periodEndMs,
      commitmentEndsAtMs: term.commitmentEndsAtMs,
    });
    expect(open.allowed).toBe(true);
  });

  it("keeps billing the remaining months when Stripe is asked to stop early", () => {
    const term = computeMembershipTerm({ plan: "monthly", paidAtMs: start });
    const early = monthlyMinimumStripeGuard({
      plan: "monthly",
      nowMs: addMonthsUtc(start, 1),
      commitmentEndsAtMs: term.commitmentEndsAtMs,
      cancelRequested: true,
      requestedCancelAtMs: null,
    });
    expect(early).toEqual({ action: "bill_remaining_months", cancelAtMs: term.commitmentEndsAtMs });

    const alreadyAtCommitment = monthlyMinimumStripeGuard({
      plan: "monthly",
      nowMs: addMonthsUtc(start, 1),
      commitmentEndsAtMs: term.commitmentEndsAtMs,
      cancelRequested: true,
      requestedCancelAtMs: term.commitmentEndsAtMs,
    });
    expect(alreadyAtCommitment).toEqual({ action: "allow" });
  });

  it("does not apply the monthly minimum to the annual plan", () => {
    const decision = assessMembershipCancellation({
      plan: "annual",
      nowMs: start,
      periodEndMs: start + 365 * 24 * 60 * 60 * 1000,
      commitmentEndsAtMs: start + 365 * 24 * 60 * 60 * 1000,
    });
    expect(decision.allowed).toBe(true);
    expect(monthlyMinimumStripeGuard({
      plan: "annual",
      nowMs: start,
      commitmentEndsAtMs: start + 1000,
      cancelRequested: true,
      requestedCancelAtMs: null,
    })).toEqual({ action: "allow" });
  });
});

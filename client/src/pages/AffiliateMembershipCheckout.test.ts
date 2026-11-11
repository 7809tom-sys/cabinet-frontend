import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { membershipPlanChoices } from "@shared/affiliateMembershipPlans";
import { checkoutAcknowledgementsValid } from "@shared/affiliateAgreement";

describe("affiliate membership checkout page", () => {
  const source = readFileSync(resolve(import.meta.dirname, "AffiliateMembershipCheckout.tsx"), "utf8");

  it("offers both plans and requires both acknowledgements before pay", () => {
    expect(membershipPlanChoices().map((plan) => plan.id)).toEqual(["monthly", "annual"]);
    expect(source).toContain('data-testid="membership-plan-picker"');
    expect(source).toContain("AffiliateOperatorNotice");
    expect(source).toContain("AffiliateAgreementPanel");
    expect(source).toContain("checkoutAcknowledgementsValid");
    expect(source).toContain('href="/pro-network"');
    expect(source).not.toContain("DesignTool");
  });

  it("does not build a Stripe payload until both boxes are checked", () => {
    expect(checkoutAcknowledgementsValid({
      operatorNoticeAccepted: true,
      operatorNoticeAcceptedAt: "2026-11-11T00:00:00.000Z",
      agreementAccepted: false,
      agreementAcceptedAt: null,
      agreementVersion: "affiliate-agreement@draft-2026-11-11",
    }).ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  DESIGNER_SUBSCRIPTION_TIERS,
  designerSubscriptionTier,
  designerSubscriptionTierChoices,
  formatTierPrice,
  isDesignerSubscriptionTier,
} from "./designerSubscriptionTiers";
import { MEMBERSHIP_PLAN_OPTIONS } from "./affiliateMembershipPlans";

describe("designer subscription tiers", () => {
  it("prices Designer + Website at $1,199/year and Designer only at $1,599/year", () => {
    expect(DESIGNER_SUBSCRIPTION_TIERS.designer_website.amountCents).toBe(119900);
    expect(DESIGNER_SUBSCRIPTION_TIERS.designer_only.amountCents).toBe(159900);
    expect(formatTierPrice("designer_website")).toBe("$1,199/year");
    expect(formatTierPrice("designer_only")).toBe("$1,599/year");
  });

  it("puts the website and purchasing club only on the $1,199 plan", () => {
    expect(DESIGNER_SUBSCRIPTION_TIERS.designer_website.includesWebsite).toBe(true);
    expect(DESIGNER_SUBSCRIPTION_TIERS.designer_website.includesPurchasingClub).toBe(true);
    expect(DESIGNER_SUBSCRIPTION_TIERS.designer_only.includesWebsite).toBe(false);
    expect(DESIGNER_SUBSCRIPTION_TIERS.designer_only.includesPurchasingClub).toBe(false);
  });

  it("bills both plans yearly", () => {
    expect(DESIGNER_SUBSCRIPTION_TIERS.designer_website.interval).toBe("year");
    expect(DESIGNER_SUBSCRIPTION_TIERS.designer_only.interval).toBe("year");
  });

  it("keeps Designer only as the higher-priced option", () => {
    expect(DESIGNER_SUBSCRIPTION_TIERS.designer_only.amountCents).toBeGreaterThan(
      DESIGNER_SUBSCRIPTION_TIERS.designer_website.amountCents,
    );
  });

  it("shows the website plan first and recommended", () => {
    const choices = designerSubscriptionTierChoices();
    expect(choices.map((c) => c.id)).toEqual(["designer_website", "designer_only"]);
    expect(choices[0].recommended).toBe(true);
    expect(choices[1].recommended).toBe(false);
  });

  it("rejects unknown tiers", () => {
    expect(isDesignerSubscriptionTier("designer_only")).toBe(true);
    expect(isDesignerSubscriptionTier("monthly")).toBe(false);
    expect(designerSubscriptionTier("nope")).toBeNull();
  });

  it("leaves the affiliate membership prices alone", () => {
    expect(MEMBERSHIP_PLAN_OPTIONS.monthly.amountCents).toBe(16900);
    expect(MEMBERSHIP_PLAN_OPTIONS.annual.amountCents).toBe(119500);
  });
});

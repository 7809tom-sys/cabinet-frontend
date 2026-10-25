import { describe, expect, it } from "vitest";
import { affiliateCardColor } from "./crmAffiliateBrand";

describe("affiliateCardColor", () => {
  it("uses the configured affiliate primary color for master CRM cards", () => {
    expect(affiliateCardColor({ storeName: "Reaves Way", primaryColor: "#16a34a", accentColor: "#f59e0b" })).toBe("#16a34a");
  });

  it("uses a stable accessible fallback for incomplete affiliate branding", () => {
    expect(affiliateCardColor({ storeName: "New Affiliate", primaryColor: null, accentColor: null })).toBe("#1a2b4a");
    expect(affiliateCardColor()).toBeUndefined();
  });
});

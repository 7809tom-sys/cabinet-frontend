import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { affiliateDashboardLinks } from "./affiliateStorefrontUrl";
import { AFFILIATE_WELCOME_GUIDE_PDF } from "./affiliateWelcomeGuide";

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

const marketingHub = read("../components/affiliate/AffiliateMarketingHub.tsx");
const credentialsPanel = read("../components/affiliate/CredentialsPanel.tsx");
const affiliatesAdmin = read("../components/admin/AffiliatesAdmin.tsx");

/** Every authored string literal that looks like a link or storage path. */
function linkLiterals(source: string): string[] {
  return Array.from(source.matchAll(/["'`]((?:\/|https?:\/\/)[^"'`\s]*)["'`]/g), (match) => match[1]);
}

describe("affiliate Marketing Hub share links", () => {
  it("shares the canonical tracked referral URL, not an origin-wide ?ref= link", () => {
    expect(marketingHub).toContain("affiliateDashboardLinks(affiliate)");
    expect(marketingHub).not.toContain("?ref=${affiliate.referralCode}`");
    expect(marketingHub).not.toContain("window.location.origin}?ref=");

    expect(affiliateDashboardLinks(
      { slug: "firstclass", referralCode: "FIRSTCLASS" },
      "https://www.cabinetdealz.com",
    ).referralUrl).toBe("https://www.cabinetdealz.com/store/firstclass/order?ref=FIRSTCLASS");
  });

  it("hands the Share & Promote tab the same tracked referral link and QR storefront", () => {
    expect(marketingHub).toContain("refLink={referralUrl}");
    expect(marketingHub).toContain("storeUrl={storefrontUrl}");
    expect(marketingHub).toContain("useQRCode(storefrontUrl)");
  });
});

describe("affiliate dead links", () => {
  it("links the hashed Welcome Guide PDF and never the missing unhashed key", () => {
    expect(AFFILIATE_WELCOME_GUIDE_PDF).toBe("/manus-storage/Cabinet-Dealz-Affiliate-Welcome-Guide_f17152cc.pdf");
    expect(credentialsPanel).toContain("AFFILIATE_WELCOME_GUIDE_PDF");
    for (const source of [marketingHub, credentialsPanel, affiliatesAdmin]) {
      expect(source).not.toContain("/manus-storage/Cabinet-Dealz-Affiliate-Welcome-Guide.pdf");
    }
  });

  it("does not reference the retired YouTube channels or Houzz", () => {
    const retired = [/@KitchenBathDesignTV/i, /@salesinsightslab/i, /@Houzz/i, /youtube\.com\/@[^"'`]*houzz/i];
    for (const source of [marketingHub, credentialsPanel, affiliatesAdmin]) {
      for (const pattern of retired) expect(source).not.toMatch(pattern);
    }
  });

  it("points the admin training list at the restored /affiliate/guide route", () => {
    expect(affiliatesAdmin).toContain('import { affiliateGuidePath } from "@/lib/affiliateGuides"');
    expect(affiliatesAdmin).toContain("affiliateGuidePath(g.slug)");
    for (const literal of linkLiterals(affiliatesAdmin)) {
      expect(literal).not.toMatch(/\/affiliate\/guide\//);
    }
    for (const literal of linkLiterals(marketingHub)) {
      expect(literal).not.toMatch(/\/affiliate\/guide\//);
    }
  });

  it("lists the restored training guides in the Marketing Hub's Training Guides tab", () => {
    expect(marketingHub).toContain("affiliateGuidesMatchingQuery(query)");
    expect(marketingHub).toContain("href={affiliateGuidePath(guide.slug)}");
    expect(marketingHub).toContain('data-testid="training-guides"');
    // The admin-published guides still render below the shipped playbook.
    expect(marketingHub).toContain('section="guides"');
  });
});

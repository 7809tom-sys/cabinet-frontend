import { describe, expect, it } from "vitest";
import {
  AFFILIATE_GUIDES,
  AFFILIATE_GUIDE_ROOT,
  affiliateGuideBySlug,
  affiliateGuidePath,
  affiliateGuidesMatchingQuery,
  loadAffiliateGuideBody,
} from "./affiliateGuides";

const LEGACY_GUIDE_FILES = [
  "10-steps-to-a-sale",
  "kitchen-design-fundamentals",
  "how-to-use-your-crm",
  "marketing-scripts-and-templates",
];

describe("affiliate training guides", () => {
  it("keeps every legacy /affiliate/guide/<file> address resolvable", () => {
    for (const slug of LEGACY_GUIDE_FILES) {
      const guide = affiliateGuideBySlug(slug);
      expect(guide, `${slug} must stay published`).not.toBeNull();
      expect(affiliateGuidePath(slug)).toBe(`${AFFILIATE_GUIDE_ROOT}/${slug}`);
    }
    expect(AFFILIATE_GUIDE_ROOT).toBe("/affiliate/guide");
    expect(AFFILIATE_GUIDES.map((guide) => guide.slug)).toEqual(LEGACY_GUIDE_FILES);
  });

  it("loads the markdown source for each published guide", async () => {
    for (const slug of LEGACY_GUIDE_FILES) {
      const body = await loadAffiliateGuideBody(slug);
      expect(body, `${slug} markdown must ship with the client`).toBeTruthy();
      expect(body!.startsWith("# ")).toBe(true);
      expect(body!.length).toBeGreaterThan(500);
    }
  });

  it("does not publish dead video channels or storage paths inside a guide", async () => {
    const bodies = await Promise.all(LEGACY_GUIDE_FILES.map((slug) => loadAffiliateGuideBody(slug)));
    const combined = bodies.join("\n").toLowerCase();
    expect(combined).not.toContain("kitchenbathdesigntv");
    expect(combined).not.toContain("salesinsightslab");
    expect(combined).not.toContain("youtube.com/@houzz");
    expect(combined).not.toContain("cabinet-dealz-affiliate-welcome-guide.pdf");
  });

  it("normalizes case and whitespace, and rejects unknown guides", () => {
    expect(affiliateGuideBySlug("  10-STEPS-TO-A-SALE ")?.title).toBe("10 Steps to a Sale");
    expect(affiliateGuideBySlug("not-a-guide")).toBeNull();
    expect(affiliateGuideBySlug("")).toBeNull();
    expect(affiliateGuideBySlug(null)).toBeNull();
    expect(affiliateGuidePath(" Kitchen-Design-Fundamentals ")).toBe("/affiliate/guide/kitchen-design-fundamentals");
  });

  it("returns null instead of throwing when a body is requested for an unknown slug", async () => {
    await expect(loadAffiliateGuideBody("gone")).resolves.toBeNull();
    await expect(loadAffiliateGuideBody(null)).resolves.toBeNull();
  });

  it("filters the playbook with the Marketing Hub search box", () => {
    expect(affiliateGuidesMatchingQuery("")).toHaveLength(4);
    expect(affiliateGuidesMatchingQuery("crm").map((guide) => guide.slug)).toEqual(["how-to-use-your-crm"]);
    expect(affiliateGuidesMatchingQuery("KITCHEN").map((guide) => guide.slug)).toEqual(["kitchen-design-fundamentals"]);
    expect(affiliateGuidesMatchingQuery("measuring")).toEqual([]);
    expect(affiliateGuidesMatchingQuery("scripts").map((guide) => guide.slug)).toEqual(["marketing-scripts-and-templates"]);
  });
});

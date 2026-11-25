import { describe, expect, it } from "vitest";
import { compareHigherIsBetter, compareWithCabinetdealz, parseDistributorSiteStats } from "./crmDistributorSiteStats";
import { CABINETDEALZ_SITE_SNAPSHOT } from "./cabinetdealzSiteSnapshot";

const flagged = [
  "distributor_master_list_2026-11-24",
  "NEEDS NEW SITE: yes, rank 12 of 33. Why: quality 5; end-of-life tech; PSI mobile 29",
  "Location: Queens Village, NY | State: NY",
  "Website: https://www.kabinetking.com/",
  "Platform: Turbify (Yahoo Store)",
  "Site quality: 5/10 | Mobile PageSpeed: 29/100",
].join("\n");

describe("parseDistributorSiteStats", () => {
  it("reads quality, mobile PageSpeed, platform and the needs-new-site rank", () => {
    expect(parseDistributorSiteStats(flagged)).toEqual({
      quality: 5, mobilePageSpeed: 29, platform: "Turbify (Yahoo Store)", needsNewSite: true, needsNewSiteRank: 12,
    });
  });

  it("reads a not-flagged distributor, including after the customer-list import prefix", () => {
    const notes = "Customer list import: Source list: distributor_master_list_2026-11-24\nNeeds new site: not flagged.\nPlatform: Shopify\nSite quality: 8/10 | Mobile PageSpeed: 67/100";
    expect(parseDistributorSiteStats(notes)).toEqual({
      quality: 8, mobilePageSpeed: 67, platform: "Shopify", needsNewSite: false, needsNewSiteRank: null,
    });
  });

  it("treats 'not measured' and 'test failed' as missing", () => {
    const notes = "NEEDS NEW SITE: yes, rank 1 of 33. Why: site down\nPlatform: not measured\nSite quality: not measured | Mobile PageSpeed: test failed";
    expect(parseDistributorSiteStats(notes)).toEqual({
      quality: null, mobilePageSpeed: null, platform: null, needsNewSite: true, needsNewSiteRank: 1,
    });
  });

  it("falls back to the company tag for needs-new-site and handles empty notes", () => {
    expect(parseDistributorSiteStats(null, "Distributor prospect - needs new site").needsNewSite).toBe(true);
    expect(parseDistributorSiteStats("", "Distributor prospect")).toEqual({
      quality: null, mobilePageSpeed: null, platform: null, needsNewSite: null, needsNewSiteRank: null,
    });
  });

  it("ignores out-of-range numbers", () => {
    const stats = parseDistributorSiteStats("Site quality: 15/10 | Mobile PageSpeed: 140/100");
    expect(stats.quality).toBeNull();
    expect(stats.mobilePageSpeed).toBeNull();
  });

  it("reads single-line notes separated by pipes", () => {
    expect(parseDistributorSiteStats("Website: https://x.com | Platform: Wix | Site quality: 6/10 | Mobile PageSpeed: 77/100").platform).toBe("Wix");
  });
});

describe("Cabinetdealz comparison", () => {
  it("marks ahead, behind and even, and stays silent when a side is missing", () => {
    expect(compareHigherIsBetter(93, 29)).toBe("ahead");
    expect(compareHigherIsBetter(93, 95)).toBe("behind");
    expect(compareHigherIsBetter(93, 93)).toBe("even");
    expect(compareHigherIsBetter(null, 5)).toBeNull();
    expect(compareHigherIsBetter(93, null)).toBeNull();
  });

  it("never compares quality while Cabinetdealz quality is not scored", () => {
    expect(CABINETDEALZ_SITE_SNAPSHOT.quality).toBeNull();
    const result = compareWithCabinetdealz(parseDistributorSiteStats(flagged));
    expect(result.quality).toBeNull();
    expect(result.mobilePageSpeed).toBe("ahead");
  });
});

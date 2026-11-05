import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const storefront = readFileSync(new URL("./Storefront.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("./AffiliateDashboard.tsx", import.meta.url), "utf8");
const section = readFileSync(
  new URL("../components/storefront/StorefrontGoogleReviews.tsx", import.meta.url),
  "utf8",
);
const panel = readFileSync(
  new URL("../components/affiliate/AffiliateGoogleReviewsPanel.tsx", import.meta.url),
  "utf8",
);

describe("storefront Google reviews tab", () => {
  it("mounts the section only behind a saved place ID", () => {
    expect(storefront).toContain("readStoredGooglePlaceId");
    expect(storefront).toContain("{googlePlaceId ? (");
    expect(storefront).toContain("<StorefrontGoogleReviews");
    // Hidden when the store has no place: no section, no nav entry.
    expect(storefront).toContain("const hasGoogleReviews = Boolean(googlePlaceId);");
    expect(storefront).toContain("hasGoogleReviews ? (");
  });

  it("links the tab from the header and the mobile menu", () => {
    expect(storefront).toContain('href="#google-reviews"');
    expect(storefront).toContain('t("nav_reviews")');
    // The anchor target lives on the section itself.
    expect(section).toContain('id="google-reviews"');
  });

  it("keeps the tab above the affiliate's own testimonials section", () => {
    expect(storefront.indexOf("<StorefrontGoogleReviews")).toBeLessThan(
      storefront.indexOf("data.testimonials.length > 0"),
    );
  });

  it("never renders sample or placeholder review content", () => {
    expect(section).not.toMatch(/lorem ipsum/i);
    expect(section).not.toMatch(/sample review/i);
    // An empty result renders the empty notice, never fabricated cards.
    expect(section).toContain("reviews_empty");
  });
});

describe("affiliate portal Google reviews setting", () => {
  it("is reachable from the portal and saves with the storefront update", () => {
    expect(dashboard).toContain("<AffiliateGoogleReviewsPanel");
    expect(panel).toContain("updateMyStorefront");
    expect(panel).toContain("googlePlaceId");
  });

  it("collects only a Place ID — no API key field anywhere", () => {
    const textInputs = panel.match(/<Input[\s\S]*?\/>/g) ?? [];
    expect(textInputs.length).toBeGreaterThan(0);
    for (const input of textInputs) {
      expect(input).not.toMatch(/key/i);
    }
    expect(panel).toContain("Place ID");
    for (const file of [panel, section, storefront]) {
      // A key is never typed in, stored, or embedded by the frontend.
      expect(file).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    }
  });

  it("states the Google and FTC rules the affiliate has to follow", () => {
    expect(panel).toContain("Never offer a discount or gift for a review");
    expect(panel).toContain("Merchant Center add-on");
    expect(panel).toContain("GOOGLE_REVIEWS_SOURCES");
  });
});

describe("no platform branding leaks into the Google reviews surface", () => {
  it("the section and panel mention no platform name", () => {
    expect(section).not.toMatch(/Cabinet\s?Dealz/i);
    expect(panel).not.toMatch(/Cabinet\s?Dealz/i);
  });
});

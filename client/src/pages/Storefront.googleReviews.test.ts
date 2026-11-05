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
  it("is reachable from the portal and saves through the credential procedure", () => {
    expect(dashboard).toContain("<AffiliateGoogleReviewsPanel");
    expect(panel).toContain("saveCredentials");
    expect(panel).toContain("googlePlaceId");
    expect(panel).toContain("placesApiKey");
    expect(panel).toContain("mapsEmbedApiKey");
  });

  it("collects both keys write-only through masked inputs", () => {
    // Both key fields render through the one write-only field component, and the
    // only place a key can be typed is a masked input with autofill disabled.
    expect(panel).toContain("WriteOnlyKeyField");
    expect(panel).toContain('type="password"');
    expect(panel).toContain('autoComplete="off"');
    expect(panel).toContain('data-lpignore="true"');
    // Two key fields are wired to it.
    expect(panel.match(/<WriteOnlyKeyField/g) ?? []).toHaveLength(2);
    for (const file of [panel, section, storefront]) {
      expect(file).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    }
  });

  it("never reads a key from a VITE_ environment variable", async () => {
    const credentialModule = readFileSync(
      new URL("../lib/googleReviewsCredentials.ts", import.meta.url),
      "utf8",
    );
    for (const file of [panel, credentialModule]) {
      // A VITE_ value is compiled into the bundle, so it could never hold a key:
      // these modules must not read the build environment at all.
      expect(file).not.toMatch(/import\.meta\.env/);
      expect(file).not.toMatch(/process\.env/);
    }
    // The env names the code refers to are server-only by construction.
    const shared = await import("@shared/googleReviews");
    for (const name of [shared.GOOGLE_PLACES_KEY_ENV, shared.GOOGLE_MAPS_EMBED_KEY_ENV]) {
      expect(name.startsWith("VITE_")).toBe(false);
    }
  });

  it("shows Key saved with Replace and Remove, and never a masked key value", () => {
    expect(panel).toContain("Key saved");
    expect(panel).toContain("onStartReplace");
    expect(panel).toContain("onRemove");
    expect(panel).not.toContain("onShowKey");
    // No bullet-masked preview of a stored key.
    expect(panel).not.toContain("••••");
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

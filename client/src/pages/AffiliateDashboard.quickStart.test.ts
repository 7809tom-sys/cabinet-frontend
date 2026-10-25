import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AffiliateDashboard.tsx", import.meta.url), "utf8");

describe("affiliate quick storefront setup", () => {
  it("puts identity, logo, contact, color preview, defaults, and one publish action before advanced settings", () => {
    expect(source).toContain('data-testid="affiliate-launch-setup"');
    expect(source).toContain("Business name");
    expect(source).toContain("Business email");
    expect(source).toContain("Business phone");
    expect(source).toContain("Public address");
    expect(source).toContain("Service area");
    expect(source).toContain("Upload logo");
    expect(source).toContain("Mini homepage preview");
    expect(source).toContain("Launch with your defaults");
    expect(source).toContain("Publish storefront");
    expect(source).toContain("More storefront options");
    expect(source).toContain('data-testid="affiliate-local-seo-readiness"');
    expect(source).toContain("Local search readiness");
    expect(source).toContain("Only publish contact, service-area, and business details that are accurate");
  });

  it("provides the post-publish share, customer storefront, and customer Designer actions", () => {
    expect(source).toContain('data-testid="affiliate-publish-success"');
    expect(source).toContain("Copy link");
    expect(source).toContain("Share storefront on Facebook");
    expect(source).toContain("Share storefront on LinkedIn");
    expect(source).toContain("Your Cabinet Dealz storefront is available immediately");
    expect(source).toContain("custom domain can be connected separately later");
    expect(source).toContain("Open storefront");
    expect(source).toContain("Open Designer as a customer");
    expect(source).toContain("storefrontPayload(true)");
  });

  it("keeps the affiliate Domain Setup page reachable from a direct settings link", () => {
    expect(source).toContain('"settings",');
    expect(source).toContain('case "settings":');
    expect(source).toContain("<CustomDomainGuide");
    expect(source).toContain('defaultDomain={`${affiliate.slug}.cabinetdealz.com`}');
  });

  it("offers an explicit website import draft with review-first testimonial publishing and mini-preview guidance", () => {
    expect(source).toContain('data-testid="affiliate-website-import"');
    expect(source).toContain("Import from your website");
    expect(source).toContain("Create draft");
    expect(source).toContain("Apply selected website details");
    expect(source).toContain("Only selected quotes will be published");
    expect(source).toContain("About the mini homepage preview");
    expect(source).toContain("About the customer Designer button");
  });

  it("opens the customer Designer inside the selected affiliate scope", () => {
    expect(source).toContain("affiliateDesignerPath(affiliate.slug)");
    expect(source).not.toContain('<a href="/design">');
  });
});

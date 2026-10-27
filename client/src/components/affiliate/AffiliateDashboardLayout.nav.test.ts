import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AffiliateDashboardLayout.tsx", import.meta.url), "utf8");

describe("affiliate portal sidebar", () => {
  it("places customer links under Orders and keeps the quote preview out of the main menu", () => {
    const customerLinks = source.indexOf('data-testid="customer-links"');
    const tail = source.indexOf('data-testid="sidebar-tail"');
    expect(customerLinks).toBeGreaterThan(-1);
    expect(customerLinks).toBeLessThan(tail);
    expect(source).toContain("Preview Quote Page");
    expect(source).toContain("The quote request page your customers see");
    expect(source).toContain("Preview Storefront Designer");
    expect(source).toContain("See the 3D designer the way your customers see it. To design for a customer, use Design Workspace.");
    expect(source).not.toContain("Open my Designer");
    expect(source).not.toContain("Get a quote");
    expect(source).not.toContain("Browse Pelican products");
    expect(source).not.toContain("Browse Hardware Resources");
    expect(source).not.toContain("text-[10px]");
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
  });

  it("makes My Catalog a parent of the vendor catalogs", () => {
    expect(source).toContain("Show vendor catalogs");
    expect(source).toContain("vendorNav.vendors.map");
    expect(source).toContain("openCatalog(null)");
  });
});

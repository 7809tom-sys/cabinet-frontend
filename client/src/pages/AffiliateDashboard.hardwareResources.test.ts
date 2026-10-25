import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("./AffiliateDashboard.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../components/affiliate/AffiliateDashboardLayout.tsx", import.meta.url), "utf8");
const pricing = readFileSync(new URL("../components/affiliate/AffiliatePricingPanel.tsx", import.meta.url), "utf8");
const hardware = readFileSync(new URL("./Hardware.tsx", import.meta.url), "utf8");

describe("affiliate Hardware Resources access", () => {
  it("keeps the affiliate product destination inside the selected storefront scope", () => {
    expect(dashboard).toContain('const hardwareUrl = `${storeUrl.replace(/\\/$/, "")}/hardware`;');
    expect(dashboard).toContain("Hardware Resources");
    expect(dashboard).toContain('href={hardwareUrl}');
    expect(layout).toContain('href={`/store/${storeSlug}/hardware`}');
    expect(layout).toContain("Browse Hardware Resources");
  });

  it("gives affiliates one separate above-list hardware pricing control and a branded preview link", () => {
    expect(pricing).toContain('data-testid="affiliate-hardware-pricing"');
    expect(pricing).toContain("Your markup above current list %");
    expect(pricing).toContain('id="hardware-list-markup"');
    expect(pricing).toContain("hardwareCatalogHref");
    expect(pricing).toContain("Preview my Hardware Resources catalog");
    expect(pricing).toContain("Save hardware pricing");
    expect(pricing).toContain("hardware commission is locked at 25% of hardware merchandise only");
    expect(pricing).toContain("hardwareMarkupBps: hardwareBps");
  });

  it("uses the selected affiliate scope when calculating customer hardware prices and never exposes supplier cost in the catalog", () => {
    expect(hardware).toContain("affiliateSlugForStoreScope(storeScope)");
    expect(hardware).toContain("affiliateSlug: affiliateSlug ?? undefined");
    expect(hardware).not.toContain("yourCost");
  });
});

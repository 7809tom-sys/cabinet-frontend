import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("./AffiliateDashboard.tsx", import.meta.url), "utf8");
const pricingPanel = readFileSync(
  new URL("../components/affiliate/AffiliatePricingPanel.tsx", import.meta.url),
  "utf8",
);
const catalogPanel = readFileSync(
  new URL("../components/affiliate/AffiliateCatalogPanel.tsx", import.meta.url),
  "utf8",
);

describe("Affiliate Dashboard pricing scope", () => {
  it("passes the exact view-as affiliate into both pricing editors", () => {
    expect(dashboard).toContain('<AffiliateCatalogPanel affiliateId={affiliate.id} isAdminView={isAdminViewAs} />');
    expect(dashboard).toContain('<AffiliatePricingPanel affiliateId={affiliate.id} isAdminView={isAdminViewAs} hardwareCatalogHref={hardwareUrl} />');
  });

  it("loads and saves selected-store pricing through admin-scoped procedures", () => {
    expect(pricingPanel).toContain("trpc.affiliates.adminBranding.useQuery");
    expect(pricingPanel).toContain("trpc.affiliates.adminUpdateMarkup.useMutation");
    expect(pricingPanel).toContain("updateAdminMarkup.mutate({ affiliateId");
    expect(pricingPanel).toContain("Select an affiliate before saving pricing.");
  });

  it("routes selected-store style markup to the same affiliate and avoids owner-only controls", () => {
    expect(catalogPanel).toContain("trpc.affiliates.adminBranding.useQuery");
    expect(catalogPanel).toContain("trpc.affiliates.adminUpsertStyleBranding.useMutation");
    expect(catalogPanel).toContain("adminUpsert.mutate({ affiliateId, styleId: style.id");
    expect(catalogPanel).toContain("!isAdminView && (");
  });

  it("shows and enforces the protected cost floor for global and per-style markup edits", () => {
    expect(pricingPanel).toContain("a customer sale price cannot be below the protected cost floor");
    expect(pricingPanel).toContain('min="0"');
    expect(catalogPanel).toContain("function styleMarkupInputError");
    expect(catalogPanel).toContain("a customer sale price cannot be below the protected cost floor");
    expect(catalogPanel).toContain("if (markupError)");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("affiliate and QuickBooks security UI", () => {
  it("shows a masked tax ID and a signed government-ID link", () => {
    const dashboard = source("client/src/pages/AffiliateDashboard.tsx");
    const admin = source("client/src/components/admin/AffiliatesAdmin.tsx");
    expect(dashboard).toContain("w9IdDocumentLink.fetch");
    expect(dashboard).toContain("hasIdDocument");
    expect(dashboard).not.toContain("w9.w9IdDocumentUrl");
    expect(dashboard).not.toContain("setIdPreview(data.url)");
    expect(dashboard).toContain("CabinetDealz");
    expect(admin).toContain("adminW9IdDocumentLink.fetch");
    expect(admin).toContain("a.w9TaxIdMasked");
    expect(admin).not.toContain("a.w9IdDocumentUrl");
  });

  it("sends the admin session when starting QuickBooks OAuth", () => {
    const qbo = source("client/src/components/admin/QuickBooksAdmin.tsx");
    expect(qbo).toContain('Accept: "application/json"');
    expect(qbo).toContain("Authorization: `Bearer ${token}`");
    expect(qbo).toContain("credentials: \"include\"");
    expect(qbo).toContain("sameSiteApiUrl(\"/api/qbo/connect\")");
    expect(qbo).not.toContain('window.location.href = "/api/qbo/connect"');
    expect(qbo).toContain("CabinetDealz");
  });

  it("limits the public storefront to opt-in contact fields and scopes team edits to one affiliate", () => {
    const storefront = source("client/src/pages/Storefront.tsx");
    expect(storefront).toContain("const storefrontPhone = data.publicPhone;");
    expect(storefront).toContain("const storefrontEmail = data.publicEmail;");
    expect(storefront).not.toContain("data.publicPhone || data.phone");
    expect(storefront).not.toContain("data.publicEmail || data.email");
    const team = source("client/src/components/affiliate/AffiliateTeamPanel.tsx");
    const dashboard = source("client/src/pages/AffiliateDashboard.tsx");
    expect(team).toContain("affiliateId?: number");
    expect(team).toContain("...(affiliateId ? { affiliateId } : {})");
    expect(dashboard).toContain("<AffiliateTeamPanel affiliateId={affiliate.id} />");
  });
});

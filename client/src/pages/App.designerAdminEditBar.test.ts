import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("Designer admin edit notice", () => {
  it("keeps the edit-mode banner off both direct and affiliate Designer routes while retaining it on other shells", () => {
    expect(source).toContain("hideAdminEditModeBar = false");
    expect(source).toContain("{!hideAdminEditModeBar && <AdminEditModeBar />}");
    expect(source).toContain('<AffiliateShell slug={affiliateSlug} fullHeight hideAdminEditModeBar>{designer}</AffiliateShell>');
    expect(source).toContain('<AffiliateShell slug={params.slug} fullHeight hideAdminEditModeBar>');
    const directDesigner = source.slice(source.indexOf("function DesignerRoute"), source.indexOf("function DistributorPortalRedirect"));
    expect(directDesigner).not.toContain("<AdminEditModeBar />");
    expect(source).toContain("<AdminEditModeBar />\n      <TopNav />");
  });
});

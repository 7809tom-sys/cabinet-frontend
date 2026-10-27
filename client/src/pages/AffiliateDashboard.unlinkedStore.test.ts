import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AffiliateDashboard.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("signed-in affiliate with no store", () => {
  it("shows an unlinked state with sign-out and contact, and does not offer Sign in", () => {
    const unlinked = source.slice(
      source.indexOf("function AffiliateStoreUnlinked"),
      source.indexOf("function statusBadge"),
    );
    expect(unlinked).toContain("No affiliate store is linked to this login");
    expect(unlinked).toContain("Sign out");
    expect(unlinked).toContain('href="/contact"');
    expect(unlinked).toContain('href="mailto:support@cabinetdealz.com"');
    expect(unlinked).not.toContain("getLoginUrl");
    expect(unlinked).not.toContain("Already a member? Sign in");
    expect(unlinked).not.toContain("<AffiliateLanding");
  });

  it("keeps the public landing for signed-out visitors only", () => {
    const dashboard = source.slice(source.indexOf("export default function AffiliateDashboard"));
    expect(dashboard.match(/return <AffiliateLanding \/>/g)).toHaveLength(1);
    expect(dashboard).toContain("if (!isAuthenticated)");
    expect(dashboard).toContain("affiliatePortalFallback(isAdmin)");
    expect(dashboard).toContain("<AffiliateStoreUnlinked");
    const landingAt = dashboard.indexOf("return <AffiliateLanding />");
    expect(dashboard.slice(0, landingAt)).toContain("if (!isAuthenticated)");
    expect(dashboard.slice(landingAt)).not.toContain("Already a member? Sign in");
  });
});

describe("affiliate sidebar stacking", () => {
  it("stops sidebar groups from shrinking over each other and scrolls the nav instead", () => {
    expect(css).toContain('[data-sidebar="content"] > *');
    expect(css).toContain("flex-shrink: 0;");
    expect(css).toContain('[data-sidebar="header"]');
    expect(css).toContain('[data-sidebar="footer"]');
  });
});

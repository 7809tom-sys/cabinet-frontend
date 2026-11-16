import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/admin/AffiliatesAdmin.tsx"), "utf8");

describe("AffiliatesAdmin portal links", () => {
  it("opens the store name, card/row, Affiliate Portal, Full Page View, and Login Portal through affiliateAdminRowLinks portalUrl", () => {
    expect(source).toContain("href={affiliateAdminRowLinks(a.id).portalUrl}");
    expect(source).toContain("href={affiliateAdminRowLinks(a.id).fullPageUrl}");
    expect(source).toContain("window.location.assign(affiliateAdminRowLinks(a.id).portalUrl)");
    expect(source).toContain("{a.storeName}");
    expect(source).toContain('label: "Login Portal"');
    expect(source).toContain("affiliateAdminCredentialLinks(a.id, origin)");
    expect(source).toContain("credentials.portalUrl");
    expect(source).not.toMatch(/const loginUrl = `\$\{origin\}\/affiliate`/);
  });

  it("keeps a separate shareable Affiliate sign-in link at bare /affiliate", () => {
    expect(source).toContain('label: "Affiliate sign-in link"');
    expect(source).toContain("credentials.signInUrl");
  });

  it("opens the admin portal in the same tab so the admin session is kept", () => {
    // The Affiliate Portal <a> must not force a signed-out new tab.
    expect(source).toMatch(
      /<a href=\{affiliateAdminRowLinks\(a\.id\)\.portalUrl\}>\s*<Button[^>]*>\s*<Store[^/]*\/> Affiliate Portal/,
    );
    expect(source).not.toMatch(
      /<a href=\{affiliateAdminRowLinks\(a\.id\)\.portalUrl\} target="_blank"/,
    );
  });
});

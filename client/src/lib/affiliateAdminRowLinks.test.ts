import { describe, expect, it } from "vitest";
import { affiliateAdminCredentialLinks, affiliateAdminRowLinks } from "./affiliateAdminRowLinks";

describe("affiliate admin row links", () => {
  it("keeps every portal action bound to its own affiliate record", () => {
    expect(affiliateAdminRowLinks(1)).toEqual({
      portalUrl: "/affiliate?viewAs=1",
      fullPageUrl: "/affiliate?viewAs=1",
      signInUrl: "/affiliate",
    });
    expect(affiliateAdminRowLinks(5730001)).toEqual({
      portalUrl: "/affiliate?viewAs=5730001",
      fullPageUrl: "/affiliate?viewAs=5730001",
      signInUrl: "/affiliate",
    });
    expect(affiliateAdminRowLinks(11100001)).toEqual({
      portalUrl: "/affiliate?viewAs=11100001",
      fullPageUrl: "/affiliate?viewAs=11100001",
      signInUrl: "/affiliate",
    });
  });

  it("builds absolute portal and shareable sign-in URLs for the credentials panel", () => {
    expect(affiliateAdminCredentialLinks(11100001, "https://www.cabinetdealz.com")).toEqual({
      portalUrl: "https://www.cabinetdealz.com/affiliate?viewAs=11100001",
      signInUrl: "https://www.cabinetdealz.com/affiliate",
    });
    expect(affiliateAdminCredentialLinks(7, "https://example.com/")).toEqual({
      portalUrl: "https://example.com/affiliate?viewAs=7",
      signInUrl: "https://example.com/affiliate",
    });
    expect(affiliateAdminCredentialLinks(7)).toEqual({
      portalUrl: "/affiliate?viewAs=7",
      signInUrl: "/affiliate",
    });
  });
});

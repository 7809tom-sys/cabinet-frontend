import { describe, expect, it } from "vitest";
import { affiliateAdminRowLinks } from "./affiliateAdminRowLinks";

describe("affiliate admin row links", () => {
  it("keeps every portal action bound to its own affiliate record", () => {
    expect(affiliateAdminRowLinks(1)).toEqual({
      portalUrl: "/affiliate?viewAs=1",
      fullPageUrl: "/affiliate?viewAs=1",
    });
    expect(affiliateAdminRowLinks(5730001)).toEqual({
      portalUrl: "/affiliate?viewAs=5730001",
      fullPageUrl: "/affiliate?viewAs=5730001",
    });
  });
});

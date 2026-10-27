import { describe, expect, it } from "vitest";
import { affiliatePortalFallback, resolveAffiliateDashboardSelection } from "./affiliateDashboardSelection";

describe("affiliate dashboard explicit selection", () => {
  it("keeps an administrator on the affiliate explicitly requested by the view-as route", () => {
    expect(resolveAffiliateDashboardSelection("5730001", true)).toEqual({ kind: "admin-view-as", affiliateId: 5730001 });
    expect(resolveAffiliateDashboardSelection("5730002", true)).toEqual({ kind: "admin-view-as", affiliateId: 5730002 });
  });

  it("uses the picker rather than falling back to a first affiliate for absent or invalid admin selections", () => {
    expect(resolveAffiliateDashboardSelection(null, true)).toEqual({ kind: "admin-picker" });
    expect(resolveAffiliateDashboardSelection("0", true)).toEqual({ kind: "admin-picker" });
    expect(resolveAffiliateDashboardSelection("firstclass", true)).toEqual({ kind: "admin-picker" });
  });

  it("keeps non-admin users scoped to their own affiliate regardless of a view-as parameter", () => {
    expect(resolveAffiliateDashboardSelection("5730001", false)).toEqual({ kind: "my-affiliate" });
  });
});

describe("signed-in affiliate store fallback", () => {
  it("keeps a signed-in person with no store off the public sign-in landing", () => {
    expect(affiliatePortalFallback(false)).toBe("signed-in-unlinked");
  });

  it("keeps administrators on the empty-admin state instead of the public landing", () => {
    expect(affiliatePortalFallback(true)).toBe("admin-empty");
  });
});

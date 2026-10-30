import { describe, expect, it } from "vitest";
import {
  affiliateMarkupQuery,
  contractorEstimateScope,
  contractorPortalScope,
  crmBoardScope,
  isAdminRole,
  parseContractorUserId,
  resolveContractorDashboardView,
  setAffiliateMarkupInput,
} from "./contractorScope";

describe("contractor scope", () => {
  it("treats every admin role as an admin and ignores other roles", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("contractor")).toBe(false);
    expect(isAdminRole("partner")).toBe(false);
    expect(isAdminRole("user")).toBe(false);
  });

  it("opens a contractor page only for an admin role with a contractor user id", () => {
    expect(parseContractorUserId("81")).toBe(81);
    expect(parseContractorUserId("81.5")).toBeNull();
    expect(parseContractorUserId("0")).toBeNull();
    expect(resolveContractorDashboardView({ role: "admin", requestedContractorUserId: 81 })).toEqual({
      mode: "admin-contractor",
      contractorUserId: 81,
    });
    expect(resolveContractorDashboardView({ role: "admin", requestedContractorUserId: null })).toEqual({ mode: "other-portal" });
    expect(resolveContractorDashboardView({ role: "contractor", requestedContractorUserId: 81 })).toEqual({ mode: "contractor" });
    expect(resolveContractorDashboardView({ role: "user", requestedContractorUserId: 81 })).toEqual({ mode: "applicant" });
    expect(resolveContractorDashboardView({ role: "partner", requestedContractorUserId: null })).toEqual({ mode: "other-portal" });
  });

  it("builds the contractor estimate, portal, CRM, and markup inputs", () => {
    expect(contractorEstimateScope()).toEqual({ audience: "contractor" });
    expect(contractorEstimateScope(81)).toEqual({ audience: "contractor", contractorUserId: 81 });
    expect(contractorPortalScope()).toBeUndefined();
    expect(contractorPortalScope(81)).toEqual({ contractorUserId: 81 });
    expect(crmBoardScope({})).toBeUndefined();
    expect(crmBoardScope({ affiliateId: 4 })).toEqual({ affiliateId: 4 });
    expect(crmBoardScope({ contractorUserId: 81, affiliateId: 4 })).toEqual({ contractorUserId: 81 });
    expect(affiliateMarkupQuery()).toBeUndefined();
    expect(affiliateMarkupQuery(9)).toEqual({ affiliateUserId: 9 });
    expect(setAffiliateMarkupInput(12.5)).toEqual({ markupPercent: 12.5 });
    expect(setAffiliateMarkupInput(null, 9)).toEqual({ markupPercent: null, affiliateUserId: 9 });
  });
});

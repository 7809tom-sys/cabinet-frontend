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
  STAFF_PREVIEW_ACTION_TITLE,
  staffDashboardPath,
  staffPreviewBannerText,
  staffPreviewEmptyCopy,
  staffPreviewQueryRows,
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
    expect(resolveContractorDashboardView({ role: "contractor", requestedContractorUserId: 81 })).toEqual({ mode: "contractor" });
    expect(resolveContractorDashboardView({ role: "user", requestedContractorUserId: 81 })).toEqual({ mode: "applicant" });
    expect(resolveContractorDashboardView({ role: "designer", requestedContractorUserId: null })).toEqual({ mode: "other-portal" });
    expect(resolveContractorDashboardView({ role: "sales_rep", requestedContractorUserId: null })).toEqual({ mode: "other-portal" });
  });

  it("previews the contractor portal for every admin, affiliate, and distributor without a contractor id", () => {
    expect(resolveContractorDashboardView({ role: "admin", requestedContractorUserId: null })).toEqual({
      mode: "staff-preview",
      role: "admin",
    });
    expect(resolveContractorDashboardView({ role: "partner", requestedContractorUserId: null })).toEqual({
      mode: "staff-preview",
      role: "partner",
    });
    expect(resolveContractorDashboardView({ role: "partner", requestedContractorUserId: 81 })).toEqual({
      mode: "staff-preview",
      role: "partner",
    });
    expect(resolveContractorDashboardView({ role: "distributor", requestedContractorUserId: null })).toEqual({
      mode: "staff-preview",
      role: "distributor",
    });
    expect(staffPreviewBannerText("admin")).toBe("Preview mode — you're viewing the contractor portal as admin. Actions may be limited.");
    expect(staffPreviewBannerText("partner")).toBe("Preview mode — you're viewing the contractor portal as affiliate. Actions may be limited.");
    expect(staffPreviewBannerText("distributor")).toBe("Preview mode — you're viewing the contractor portal as distributor. Actions may be limited.");
    expect(staffDashboardPath("admin")).toBe("/admin");
    expect(staffDashboardPath("partner")).toBe("/affiliate");
    expect(staffDashboardPath("distributor")).toBe("/distributor");
    expect(staffDashboardPath("sales_rep")).toBe("/admin");
    expect(staffPreviewEmptyCopy("customers")).toBe("No customers to show in preview. This login can't load a contractor's customers.");
    expect(staffPreviewEmptyCopy("designs")).toBe("No saved designs to show in preview. This login can't load a contractor's designs.");
    expect(staffPreviewEmptyCopy("crm")).toBe("No CRM deals to show in preview. This board stays empty so this login doesn't change a real CRM.");
    expect(staffPreviewEmptyCopy("labor")).toBe("No labor estimates to show in preview. This login can't load or save contractor invoices.");
    expect(staffPreviewEmptyCopy("orders")).toBe("No orders to show in preview. Contractor orders stay hidden for this login.");
    expect(STAFF_PREVIEW_ACTION_TITLE).toBe("Preview mode can't change contractor data.");
    expect(staffPreviewQueryRows(true, [{ id: 1 }], { message: "FORBIDDEN" })).toEqual([]);
    expect(staffPreviewQueryRows(true, [{ id: 1 }], null)).toEqual([{ id: 1 }]);
    expect(staffPreviewQueryRows(false, [{ id: 1 }], { message: "FORBIDDEN" })).toEqual([{ id: 1 }]);
    expect(staffPreviewQueryRows(false, undefined, null)).toEqual([]);
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

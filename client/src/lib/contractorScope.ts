import type { AffiliateMarkupQuery, SetAffiliateMarkupInput } from "@/lib/contractorAccessForm";

/**
 * Contractor tools are available to every account whose role is admin.
 * Authority is the role, never a single named user.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

const OTHER_PORTAL_ROLES = ["admin", "designer", "partner", "sales_rep", "distributor"] as const;

/** Roles that can open /contractor without a contractorUserId, read-only. */
const STAFF_PREVIEW_ROLES = ["admin", "partner", "distributor"] as const;

export type StaffPreviewRole = (typeof STAFF_PREVIEW_ROLES)[number];

export function isStaffPreviewRole(role: string): role is StaffPreviewRole {
  return (STAFF_PREVIEW_ROLES as readonly string[]).includes(role);
}

export type ContractorDashboardView =
  | { mode: "admin-contractor"; contractorUserId: number }
  | { mode: "contractor" }
  | { mode: "staff-preview"; role: StaffPreviewRole }
  | { mode: "other-portal" }
  | { mode: "applicant" };

export function parseContractorUserId(value: string | null | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function readContractorUserId(search: string): number | null {
  return parseContractorUserId(new URLSearchParams(search).get("contractorUserId"));
}

export function resolveContractorDashboardView(args: {
  role: string;
  requestedContractorUserId: number | null;
}): ContractorDashboardView {
  if (isAdminRole(args.role) && args.requestedContractorUserId != null) {
    return { mode: "admin-contractor", contractorUserId: args.requestedContractorUserId };
  }
  if (args.role === "contractor") return { mode: "contractor" };
  if (isStaffPreviewRole(args.role)) return { mode: "staff-preview", role: args.role };
  if ((OTHER_PORTAL_ROLES as readonly string[]).includes(args.role)) return { mode: "other-portal" };
  return { mode: "applicant" };
}

/** Product name for the banner. Partner accounts are affiliates in the product. */
export function staffPreviewRoleLabel(role: StaffPreviewRole): "admin" | "affiliate" | "distributor" {
  if (role === "partner") return "affiliate";
  if (role === "distributor") return "distributor";
  return "admin";
}

export function staffPreviewBannerText(role: StaffPreviewRole): string {
  return `Preview mode — you're viewing the contractor portal as ${staffPreviewRoleLabel(role)}. Actions may be limited.`;
}

/** Where the preview banner sends this login. Unknown staff roles fall back to /admin. */
export function staffDashboardPath(role: string): "/admin" | "/affiliate" | "/distributor" {
  if (role === "partner") return "/affiliate";
  if (role === "distributor") return "/distributor";
  return "/admin";
}

export const STAFF_PREVIEW_ACTION_TITLE = "Preview mode can't change contractor data.";

export type StaffPreviewSection = "customers" | "designs" | "crm" | "labor" | "orders";

export function staffPreviewEmptyCopy(section: StaffPreviewSection): string {
  switch (section) {
    case "customers":
      return "No customers to show in preview. This login can't load a contractor's customers.";
    case "designs":
      return "No saved designs to show in preview. This login can't load a contractor's designs.";
    case "crm":
      return "No CRM deals to show in preview. This board stays empty so this login doesn't change a real CRM.";
    case "labor":
      return "No labor estimates to show in preview. This login can't load or save contractor invoices.";
    case "orders":
      return "No orders to show in preview. Contractor orders stay hidden for this login.";
  }
}

/** A denied contractor query becomes an empty list in preview. Other viewers keep the payload. */
export function staffPreviewQueryRows<T>(staffPreview: boolean, data: T[] | undefined, error: unknown): T[] {
  if (staffPreview && error != null) return [];
  return data ?? [];
}

/** Existing installation-estimate scope. Admin viewers add contractorUserId. */
export type ContractorEstimateScope = {
  audience: "contractor";
  contractorUserId?: number;
};

export function contractorEstimateScope(contractorUserId?: number): ContractorEstimateScope {
  return contractorUserId != null
    ? { audience: "contractor", contractorUserId }
    : { audience: "contractor" };
}

/** Omitted for the signed-in contractor. Present only for an admin viewing that contractor. */
export type ContractorPortalScope = { contractorUserId: number } | undefined;

export function contractorPortalScope(contractorUserId?: number): ContractorPortalScope {
  return contractorUserId != null ? { contractorUserId } : undefined;
}

export function crmBoardScope(args: {
  contractorUserId?: number;
  affiliateId?: number;
  masterAffiliateId?: number | null;
}): { contractorUserId: number } | { affiliateId: number } | undefined {
  if (args.contractorUserId != null) return { contractorUserId: args.contractorUserId };
  if (args.affiliateId != null) return { affiliateId: args.affiliateId };
  if (args.masterAffiliateId != null) return { affiliateId: args.masterAffiliateId };
  return undefined;
}

export function affiliateMarkupQuery(affiliateUserId?: number): AffiliateMarkupQuery | undefined {
  return affiliateUserId != null ? { affiliateUserId } : undefined;
}

export function setAffiliateMarkupInput(
  markupPercent: number | null,
  affiliateUserId?: number,
): SetAffiliateMarkupInput {
  return affiliateUserId != null ? { markupPercent, affiliateUserId } : { markupPercent };
}

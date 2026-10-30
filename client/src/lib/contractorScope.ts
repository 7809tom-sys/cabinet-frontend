import type { AffiliateMarkupQuery, SetAffiliateMarkupInput } from "@/lib/contractorAccessForm";

/**
 * Contractor tools are available to every account whose role is admin.
 * Authority is the role, never a single named user.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

const OTHER_PORTAL_ROLES = ["admin", "designer", "partner", "sales_rep", "distributor"] as const;

export type ContractorDashboardView =
  | { mode: "admin-contractor"; contractorUserId: number }
  | { mode: "contractor" }
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
  if ((OTHER_PORTAL_ROLES as readonly string[]).includes(args.role)) return { mode: "other-portal" };
  return { mode: "applicant" };
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

export const AFFILIATE_CONTRACTOR_DUPLICATE_MESSAGE = "A request for that contractor is already pending.";
export const AFFILIATE_CONTRACTOR_SUCCESS_MESSAGE = "Contractor request sent.";

export type AffiliateContractorStatus = "pending" | "approved" | "denied";

export type AffiliateContractorDraft = {
  contractorName: string;
  contractorEmail: string;
  businessName: string;
  phone: string;
  licenseNumber: string;
};

export type SubmitForContractorInput = {
  contractorName: string;
  contractorEmail: string;
  businessName: string;
  phone: string;
  licenseNumber?: string | null;
};

export type SubmitForContractorResult = {
  id: number;
  status: "pending";
  duplicate: boolean;
};

export type AffiliateContractorRequest = {
  id: number;
  contractorName: string;
  contractorEmail: string;
  businessName: string;
  phone: string;
  licenseNumber: string | null;
  status: AffiliateContractorStatus;
  createdAt: string | Date;
  reviewedAt: string | Date | null;
  hasAccount: boolean;
};

export type ContractorAccessSource = "self" | "affiliate";

/** Row from `contractorAccess.list` after the paired backend adds affiliate submission fields. */
export type ContractorAccessListRow = {
  id: number;
  userId: number | null;
  businessName: string;
  phone: string;
  licenseNumber: string | null;
  status: string;
  createdAt?: string | Date | null;
  email?: string | null;
  name?: string | null;
  source: ContractorAccessSource;
  submittedByUserId: number | null;
  submittedByName: string | null;
  submittedByEmail: string | null;
  contractorName: string | null;
  contractorEmail: string | null;
};

export type AffiliateMarkupResult = {
  markupPercent: number | null;
  siteDefaultPercent: number;
};

export type AffiliateMarkupQuery = {
  affiliateUserId?: number;
};

export type SetAffiliateMarkupInput = {
  markupPercent: number | null;
  affiliateUserId?: number;
};

export type AffiliateReviewInput = {
  id: number;
  decision: "approved" | "rejected";
};

export type AffiliateSubmitterOption = {
  userId: number;
  name: string;
  email: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function contractorRequestStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "denied":
      return "Denied";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export function contractorAccessSourceLabel(source: string | null | undefined): string {
  return source === "affiliate" ? "Affiliate" : "Self";
}

export function formatContractorAccessDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export function contractorAccountLabel(hasAccount: boolean): string {
  return hasAccount ? "Has an account" : "No account yet";
}

/**
 * Pending queue by default. Choosing an affiliate drops the status filter so
 * the admin sees every request that affiliate sees, including reviewed ones.
 */
export function contractorAccessListInput(
  affiliateUserId: number | null,
): { status: "pending" } | { submittedByUserId: number } {
  return affiliateUserId == null ? { status: "pending" } : { submittedByUserId: affiliateUserId };
}

export function affiliateSubmitterOptions(rows: ContractorAccessListRow[]): AffiliateSubmitterOption[] {
  const byId = new Map<number, AffiliateSubmitterOption>();
  for (const row of rows) {
    if (row.source !== "affiliate" || row.submittedByUserId == null) continue;
    const existing = byId.get(row.submittedByUserId);
    const name = row.submittedByName?.trim() || existing?.name || `Affiliate #${row.submittedByUserId}`;
    const email = row.submittedByEmail?.trim() || existing?.email || "";
    byId.set(row.submittedByUserId, { userId: row.submittedByUserId, name, email });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
}

export function affiliateSubmitterLabel(option: AffiliateSubmitterOption): string {
  return option.email ? `${option.name} · ${option.email}` : option.name;
}

export function listRowContractorName(row: ContractorAccessListRow): string {
  return row.contractorName?.trim() || row.name?.trim() || "—";
}

export function listRowContractorEmail(row: ContractorAccessListRow): string {
  return row.contractorEmail?.trim() || row.email?.trim() || "No email";
}

export function listRowSubmitter(row: ContractorAccessListRow): string {
  if (row.source !== "affiliate") return "None";
  const name = row.submittedByName?.trim() || "Affiliate";
  const email = row.submittedByEmail?.trim() || "No email";
  return `${name} · ${email}`;
}

export function contractorPagePath(contractorUserId: number): string {
  return `/contractor?contractorUserId=${contractorUserId}`;
}

export function contractorProcedureError(error: { message?: string; data?: { code?: string } | null } | null | undefined): string {
  const code = error?.data?.code?.trim();
  const message = error?.message?.trim();
  if (code && message && !message.includes(code)) return `${code}: ${message}`;
  return message || code || "Could not update this request.";
}

/** Markup over cost is a percent from 0 through 200, with at most two decimal places. */
export function parseAffiliateMarkupPercent(
  raw: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter a markup percent, or use the site default." };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, message: "Use at most 2 decimal places." };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 200) {
    return { ok: false, message: "Markup must be between 0 and 200." };
  }
  return { ok: true, value: Math.round(value * 100) / 100 };
}

export function formatMarkupPercent(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export function contractorSellPrice(cost: number, markupPercent: number): number {
  return Math.round(cost * (1 + markupPercent / 100) * 100) / 100;
}

export function contractorMarkupExample(markupPercent: number, audience: "affiliate" | "admin" = "affiliate"): string {
  const sell = contractorSellPrice(100, markupPercent).toFixed(2);
  const buyers = audience === "admin" ? "this affiliate's contractors" : "your contractors";
  return `A $100.00 cost sells to ${buyers} at $${sell}`;
}

export function effectiveMarkupPercent(draft: string, siteDefaultPercent: number): number | null {
  const trimmed = draft.trim();
  if (!trimmed) return siteDefaultPercent;
  const parsed = parseAffiliateMarkupPercent(trimmed);
  return parsed.ok ? parsed.value : null;
}

export function validateAffiliateContractorDraft(
  draft: AffiliateContractorDraft,
): { ok: true; value: SubmitForContractorInput } | { ok: false; message: string; field: "contractorName" | "contractorEmail" | "businessName" | "phone" } {
  const contractorName = draft.contractorName.trim();
  const contractorEmail = draft.contractorEmail.trim();
  const businessName = draft.businessName.trim();
  const phone = draft.phone.trim();
  const licenseNumber = draft.licenseNumber.trim();

  if (contractorName.length < 2) {
    return { ok: false, message: "Enter the contractor name.", field: "contractorName" };
  }
  if (!contractorEmail) {
    return { ok: false, message: "Enter the contractor email.", field: "contractorEmail" };
  }
  if (!EMAIL_PATTERN.test(contractorEmail)) {
    return { ok: false, message: "Enter a valid contractor email.", field: "contractorEmail" };
  }
  if (businessName.length < 2) {
    return { ok: false, message: "Enter the business name.", field: "businessName" };
  }
  if (phone.length < 7) {
    return { ok: false, message: "Enter a phone number.", field: "phone" };
  }

  return {
    ok: true,
    value: {
      contractorName,
      contractorEmail,
      businessName,
      phone,
      licenseNumber: licenseNumber || null,
    },
  };
}

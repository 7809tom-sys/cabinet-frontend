export const VENDOR_REFERRAL_STATUSES = ["new", "contacted", "onboarded", "declined"] as const;

export type VendorReferralStatus = (typeof VENDOR_REFERRAL_STATUSES)[number];

export type VendorReferralSubmitInput = {
  vendorName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export type VendorReferralDraft = {
  vendorName: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
};

export type VendorReferralRow = {
  id: number;
  affiliateId: number;
  affiliateName: string | null;
  vendorName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: VendorReferralStatus;
  createdAt: string | Date | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isVendorReferralStatus(value: string): value is VendorReferralStatus {
  return (VENDOR_REFERRAL_STATUSES as readonly string[]).includes(value);
}

export function vendorReferralStatusLabel(status: string): string {
  switch (status) {
    case "new":
      return "New";
    case "contacted":
      return "Contacted";
    case "onboarded":
      return "Onboarded";
    case "declined":
      return "Declined";
    default:
      return status;
  }
}

export function formatVendorReferralDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export function validateVendorReferral(
  draft: VendorReferralDraft,
): { ok: true; value: VendorReferralSubmitInput } | { ok: false; message: string; field: "vendorName" | "email" | "contact" } {
  const vendorName = draft.vendorName.trim();
  const contactName = draft.contactName.trim();
  const email = draft.email.trim();
  const phone = draft.phone.trim();
  const notes = draft.notes.trim();

  if (!vendorName) {
    return { ok: false, message: "Enter the vendor name.", field: "vendorName" };
  }
  if (!email && !phone) {
    return { ok: false, message: "Enter an email or a phone number.", field: "contact" };
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return { ok: false, message: "Enter a valid email address.", field: "email" };
  }

  return {
    ok: true,
    value: {
      vendorName,
      ...(contactName ? { contactName } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(notes ? { notes } : {}),
    },
  };
}

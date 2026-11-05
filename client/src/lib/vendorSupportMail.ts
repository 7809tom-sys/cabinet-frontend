/**
 * Vendor support mailboxes: Claims, Support, Sales and Sales Communication.
 *
 * The `vendorEmails.*` procedures are being built in the cabinet-backend draft.
 * The trpc surface is typed here loosely on purpose so this screen compiles and
 * renders graceful empty states before those procedures exist on the deployed
 * backend; no email is ever forwarded without an explicit admin click.
 */

export const VENDOR_EMAIL_PURPOSES = [
  { key: "claims", label: "Claims", description: "Damaged, missing or wrong parts. Claims get a response first." },
  { key: "support", label: "Support", description: "Installation, specification and warranty questions." },
  { key: "sales", label: "Sales", description: "Quotes, pricing, new orders and lead times." },
  { key: "sales_communication", label: "Sales Communication", description: "Announcements, promos and rep updates." },
] as const;

export type VendorEmailPurpose = (typeof VENDOR_EMAIL_PURPOSES)[number]["key"];

export function vendorEmailPurposeLabel(key: string | null | undefined): string {
  const match = VENDOR_EMAIL_PURPOSES.find((purpose) => purpose.key === key);
  return match?.label ?? "Unfiled";
}

export function isVendorEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Each vendor shows its four purpose sections even when no address is saved. */
export function vendorAddressSections<T extends { purpose?: string | null; address?: string | null }>(
  saved: T[] | undefined,
): Array<{ purpose: VendorEmailPurpose; label: string; description: string; address: string; saved: T | null }> {
  return VENDOR_EMAIL_PURPOSES.map((purpose) => {
    const match = (saved ?? []).find((row) => row.purpose === purpose.key) ?? null;
    return {
      purpose: purpose.key,
      label: purpose.label,
      description: purpose.description,
      address: (match?.address ?? "").trim(),
      saved: match,
    };
  });
}

export type VendorInboxMail = {
  id: number;
  vendorName?: string | null;
  purpose?: string | null;
  subject?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  /** Cabinet Deals staff the mail is addressed to. */
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  receivedAt?: string | Date | null;
  forwardedAt?: string | Date | null;
  forwardedTo?: string | null;
  bodyPreview?: string | null;
};

export function vendorInboxReceivedAt(mail: VendorInboxMail): string | null {
  if (!mail.receivedAt) return null;
  const date = mail.receivedAt instanceof Date ? mail.receivedAt : new Date(mail.receivedAt);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function vendorInboxAssignedTo(mail: VendorInboxMail): string {
  return (mail.assignedToName ?? "").trim() || (mail.assignedToEmail ?? "").trim() || "Unassigned";
}

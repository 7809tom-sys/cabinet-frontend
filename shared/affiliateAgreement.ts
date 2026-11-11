// Draft Affiliate Agreement. Admin can replace the published text from the
// Operations legal-page slot. Checkout records the version the affiliate accepted.
// This document is separate from the website Terms & Conditions and from warranties.

import { AFFILIATE_MEMBERSHIP, membershipOptionsLabel } from "./affiliate";

export const AFFILIATE_AGREEMENT_SLUG = "affiliate-agreement";
export const AFFILIATE_AGREEMENT_VERSION = "draft-2026-11-11";

export const AFFILIATE_AGREEMENT_DRAFT_BANNER =
  "DRAFT — for Tom and his attorney to review before anyone relies on it. This is not the website Terms & Conditions and it is not a warranty.";

export function affiliateAgreementVersionLabel(version: string = AFFILIATE_AGREEMENT_VERSION): string {
  return `${AFFILIATE_AGREEMENT_SLUG}@${version}`;
}

export function buildAffiliateAgreementText(version: string = AFFILIATE_AGREEMENT_VERSION): string {
  const prices = membershipOptionsLabel();
  return [
    AFFILIATE_AGREEMENT_DRAFT_BANNER,
    "",
    "Affiliate Agreement",
    `Version: ${affiliateAgreementVersionLabel(version)}`,
    "",
    "1. Independent operator",
    "You are an independent operator. You are not an employee of Cabinet Dealz. You are responsible for your own taxes. You have no authority to bind Cabinet Dealz, to sign contracts for Cabinet Dealz, or to speak for Cabinet Dealz.",
    "",
    "2. Payment on completion of an order",
    "You get paid on completion of an order. In this program, completion means the order status is confirmed. An order that is not confirmed does not earn commission.",
    "",
    "3. Membership fee",
    `The membership fee is ${prices}.`,
    `The annual amount is $${AFFILIATE_MEMBERSHIP.priceUsd.toLocaleString("en-US")} per year. It covers one year. It renews only when you pay for another year. Cancelling does not refund the year already paid. Access runs through the end of the paid year.`,
    `The monthly amount is $${AFFILIATE_MEMBERSHIP.monthlyPriceUsd} per month. It is billed every month. The first ${AFFILIATE_MEMBERSHIP.monthlyMinimumMonths} paid months are a minimum. A cancel before those ${AFFILIATE_MEMBERSHIP.monthlyMinimumMonths} paid months is blocked in your account, and if billing is stopped early in Stripe the remaining months of the minimum are still billed through the commitment date. After the minimum, you may cancel and billing stops at the end of the month already paid.`,
    "",
    "4. Sales rep credit",
    "If you select an approved sales rep when you pay, that rep is credited with selling your affiliate account. The rep's flat fee and residual are the amounts Cabinet Dealz has saved in its commission settings at the time you pay. That saved rate stays on your account. A later change to the settings does not rewrite it.",
    "",
    "5. Brand and storefront",
    "Cabinet Dealz lets you use a storefront under your own name, and the Cabinet Dealz name only as this program describes. You may not copy the software, present yourself as Cabinet Dealz, or promise terms Cabinet Dealz did not approve.",
    "",
    "6. Conduct",
    "You will not make false claims about products, prices, or delivery dates. You will follow this agreement. You will not bind Cabinet Dealz to a promise.",
    "",
    "7. Fulfillment",
    "You sell through your storefront. Cabinet Dealz and its suppliers fulfill the order and ship it to the customer. You do not ship the order yourself.",
    "",
    "8. Termination",
    "Cabinet Dealz may end this agreement if you break it, and may turn off the storefront. You may stop after the membership commitment in section 3. Pay already earned, and the limit on liability, stay in effect after the agreement ends.",
    "",
    "9. Limitation of liability",
    "To the extent the law allows, Cabinet Dealz is not liable for indirect or consequential losses from your use of the storefront. Cabinet Dealz's liability to you for the membership is limited to the membership fees you paid in the three months before the claim.",
    "",
    "10. Governing law",
    "TODO: Tom and his attorney will choose the governing law and the venue. This draft does not choose a state.",
    "",
    "11. Separate document",
    "This agreement is only between Cabinet Dealz and the affiliate. It does not replace the website Terms & Conditions, the privacy policy, or any manufacturer warranty.",
  ].join("\n");
}

export function agreementMentionsForbiddenWords(text: string): string[] {
  const found: string[] = [];
  if (/\binventory\b/i.test(text)) found.push("inventory");
  if (/\bstock\b/i.test(text)) found.push("stock");
  return found;
}

export type CheckoutAcknowledgementInput = {
  operatorNoticeAccepted: boolean;
  operatorNoticeAcceptedAt: string | null;
  agreementAccepted: boolean;
  agreementAcceptedAt: string | null;
  agreementVersion: string | null;
};

export function checkoutAcknowledgementsValid(
  input: CheckoutAcknowledgementInput,
): { ok: true; operatorNoticeAcceptedAt: string; agreementAcceptedAt: string; agreementVersion: string } | { ok: false; message: string } {
  if (!input.operatorNoticeAccepted) {
    return { ok: false, message: "Check the box that you are an independent operator and that you are paid on completion of an order." };
  }
  if (!input.agreementAccepted) {
    return { ok: false, message: "Check the box that you agree to the Affiliate Agreement." };
  }
  const operatorNoticeAcceptedAt = parseTimestamp(input.operatorNoticeAcceptedAt);
  if (!operatorNoticeAcceptedAt) {
    return { ok: false, message: "The independent-operator acknowledgement needs a time." };
  }
  const agreementAcceptedAt = parseTimestamp(input.agreementAcceptedAt);
  if (!agreementAcceptedAt) {
    return { ok: false, message: "The agreement acknowledgement needs a time." };
  }
  const agreementVersion = (input.agreementVersion ?? "").trim();
  if (!agreementVersion) {
    return { ok: false, message: "The agreement version is missing." };
  }
  return { ok: true, operatorNoticeAcceptedAt, agreementAcceptedAt, agreementVersion };
}

function parseTimestamp(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

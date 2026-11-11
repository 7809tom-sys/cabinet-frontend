// Plain notice shown before an affiliate pays, and anywhere payment or
// commission terms are shown. This is its own notice. It is not the website
// Terms & Conditions and it is not a warranty.

export const AFFILIATE_OPERATOR_NOTICE = {
  independent:
    "You are an independent operator. You are not an employee of Cabinet Dealz.",
  paidOnCompletion: "You get paid on completion of an order.",
} as const;

export const AFFILIATE_OPERATOR_NOTICE_LINES = [
  AFFILIATE_OPERATOR_NOTICE.independent,
  AFFILIATE_OPERATOR_NOTICE.paidOnCompletion,
] as const;

export function affiliateOperatorNoticeText(): string {
  return AFFILIATE_OPERATOR_NOTICE_LINES.join(" ");
}

import { describe, expect, it } from "vitest";
import { AFFILIATE_MEMBERSHIP } from "./affiliate";
import {
  AFFILIATE_AGREEMENT_VERSION,
  agreementMentionsForbiddenWords,
  affiliateAgreementVersionLabel,
  buildAffiliateAgreementText,
  checkoutAcknowledgementsValid,
} from "./affiliateAgreement";
import { AFFILIATE_OPERATOR_NOTICE } from "./affiliateOperatorNotice";

describe("affiliate agreement draft", () => {
  const text = buildAffiliateAgreementText();

  it("is marked as a draft and records a version", () => {
    expect(text.startsWith("DRAFT")).toBe(true);
    expect(text).toContain(affiliateAgreementVersionLabel(AFFILIATE_AGREEMENT_VERSION));
    expect(text).toContain("TODO: Tom and his attorney will choose the governing law");
  });

  it("covers the commercial points and both membership prices", () => {
    expect(text).toContain("not an employee of Cabinet Dealz");
    expect(text).toContain("responsible for your own taxes");
    expect(text).toContain("no authority to bind Cabinet Dealz");
    expect(text).toContain("completion of an order");
    expect(text).toContain(`$${AFFILIATE_MEMBERSHIP.priceUsd.toLocaleString("en-US")}`);
    expect(text).toContain(`$${AFFILIATE_MEMBERSHIP.monthlyPriceUsd}`);
    expect(text).toContain(`${AFFILIATE_MEMBERSHIP.monthlyMinimumMonths} paid months`);
    expect(text).toContain("approved sales rep");
    expect(text).toContain("does not replace the website Terms & Conditions");
  });

  it("does not mention inventory or stock", () => {
    expect(agreementMentionsForbiddenWords(text)).toEqual([]);
  });
});

describe("checkout acknowledgements", () => {
  const now = "2026-11-11T15:00:00.000Z";

  it("requires both boxes, a time, and the agreement version", () => {
    expect(checkoutAcknowledgementsValid({
      operatorNoticeAccepted: false,
      operatorNoticeAcceptedAt: now,
      agreementAccepted: true,
      agreementAcceptedAt: now,
      agreementVersion: AFFILIATE_AGREEMENT_VERSION,
    }).ok).toBe(false);

    const ready = checkoutAcknowledgementsValid({
      operatorNoticeAccepted: true,
      operatorNoticeAcceptedAt: now,
      agreementAccepted: true,
      agreementAcceptedAt: now,
      agreementVersion: affiliateAgreementVersionLabel(),
    });
    expect(ready.ok).toBe(true);
    if (ready.ok) expect(ready.agreementVersion).toContain("affiliate-agreement@");
  });

  it("uses the plain operator sentences", () => {
    expect(AFFILIATE_OPERATOR_NOTICE.independent).toMatch(/independent operator/i);
    expect(AFFILIATE_OPERATOR_NOTICE.independent).toMatch(/not an employee/i);
    expect(AFFILIATE_OPERATOR_NOTICE.paidOnCompletion).toMatch(/paid on completion of an order/i);
  });
});

import { describe, expect, it } from "vitest";
import {
  ADMIN_CRM_SENDER_PROFILE,
  CRM_FORM_LETTERS,
  affiliateCrmSenderProfile,
  composeHasTypedText,
  contractorCrmSenderProfile,
  crmFormLetterMergeFields,
  crmFormLetterRoleFor,
  crmFormLettersForRole,
  crmSenderMergeFields,
  fillCrmFormLetter,
} from "./crmFormLetters";
import { applyCrmMergeFields } from "./crmMailbox";

const STARTER_KEYS = [
  "design_review_questions",
  "quote_ready",
  "quote_follow_up",
  "order_received",
  "order_verified",
  "order_shipped",
  "need_measurements",
  "post_delivery_check_in",
];

const deal = {
  contactName: "Ana Ruiz",
  dealTitle: "Osprey bath quote",
  estimatedValue: "9200",
  designLink: "https://cabinetdealz.com/design/12",
  quoteLink: "https://cabinetdealz.com/quote/12",
  signature: "<p>— Rich</p>",
};

const storeProfile = affiliateCrmSenderProfile({
  storeName: "Reaves Way Cabinet Shop",
  publicAddress: "1200 Main St, Sarasota, FL",
  publicPhone: "941-555-0100",
  publicEmail: "hello@reavesway.test",
});

describe("role-aware CRM form letters", () => {
  it("ships the eight starter letters for every role, in the same order", () => {
    for (const role of ["admin", "affiliate", "contractor"] as const) {
      const letters = crmFormLettersForRole(role);
      expect(letters.map((letter) => letter.key)).toEqual(STARTER_KEYS);
      expect(new Set(letters.map((letter) => letter.key)).size).toBe(letters.length);
    }
    expect(CRM_FORM_LETTERS.contractor).toHaveLength(STARTER_KEYS.length);
  });

  it("gives each role its own wording, not one body with swapped names", () => {
    const admin = CRM_FORM_LETTERS.admin.find((letter) => letter.key === "quote_ready")!;
    const affiliate = CRM_FORM_LETTERS.affiliate.find((letter) => letter.key === "quote_ready")!;
    const contractor = CRM_FORM_LETTERS.contractor.find((letter) => letter.key === "quote_ready")!;
    expect(admin.bodyHtml).not.toBe(affiliate.bodyHtml);
    expect(affiliate.bodyHtml).not.toBe(contractor.bodyHtml);
    expect(affiliate.bodyHtml).toContain("{{senderCompany}}");
    expect(contractor.bodyHtml).toContain("{{senderPhone}}");
  });

  it("fills a letter from the deal plus the signed-in store", () => {
    const letter = CRM_FORM_LETTERS.affiliate.find((item) => item.key === "quote_ready")!;
    const filled = fillCrmFormLetter(letter, crmFormLetterMergeFields({ role: "affiliate", profile: storeProfile, deal }));
    expect(filled.subject).toBe("Your quote is ready — Osprey bath quote");
    expect(filled.bodyHtml).toContain("Hi Ana Ruiz,");
    expect(filled.bodyHtml).toContain("Reaves Way Cabinet Shop");
    expect(filled.bodyHtml).toContain("9200");
    expect(filled.bodyHtml).toContain("1200 Main St, Sarasota, FL");
    expect(filled.bodyHtml).toContain("941-555-0100");
    expect(filled.bodyHtml).toContain("hello@reavesway.test");
    expect(filled.bodyHtml).not.toContain("{{");
  });

  it("keeps a [bracket] placeholder for anything the record cannot supply", () => {
    const contractorProfile = contractorCrmSenderProfile({ businessName: "Hale Builds", phone: "941-555-0177" });
    const fields = crmFormLetterMergeFields({ role: "contractor", profile: contractorProfile, deal: { contactName: "Chris" } });
    expect(fields.senderCompany).toBe("Hale Builds");
    expect(fields.senderPhone).toBe("941-555-0177");
    // Contractor records have no location or business email field yet.
    expect(fields.senderLocation).toBe("[business location]");
    expect(fields.senderEmail).toBe("[business email]");
    expect(fields.estimatedValue).toBe("[quote total]");
    expect(fields.dealTitle).toBe("[deal name]");
  });

  it("names the missing field for the role that is reading the letter", () => {
    expect(crmSenderMergeFields(null, "admin")).toEqual({
      senderCompany: "Cabinet Dealz",
      senderLocation: "[Cabinet Dealz location]",
      senderPhone: "[Cabinet Dealz phone]",
      senderEmail: "[Cabinet Dealz email]",
    });
    expect(crmSenderMergeFields(null, "affiliate").senderCompany).toBe("[store name]");
    expect(crmSenderMergeFields(null, "contractor").senderLocation).toBe("[business location]");
  });

  it("uses the affiliate public address before its service area, and never a private email", () => {
    const profile = affiliateCrmSenderProfile({
      storeName: "Harbor Cabinets",
      publicAddress: "9 Bay St, Naples, FL",
      serviceArea: "Naples & Bonita Springs",
      publicPhone: "239-555-0134",
      phone: "239-555-9999",
      publicEmail: "sales@harbor.test",
      email: "owner-private@harbor.test",
    });
    expect(profile.location).toBe("9 Bay St, Naples, FL");
    expect(profile.phone).toBe("239-555-0134");
    expect(profile.email).toBe("sales@harbor.test");
    expect(affiliateCrmSenderProfile({ serviceArea: "Sarasota" }).location).toBe("Sarasota");
    expect(affiliateCrmSenderProfile(null).companyName).toBeNull();
  });

  it("signs house letters with the Cabinet Dealz brand", () => {
    expect(ADMIN_CRM_SENDER_PROFILE.companyName).toBe("Cabinet Dealz");
    const letter = CRM_FORM_LETTERS.admin.find((item) => item.key === "post_delivery_check_in")!;
    expect(fillCrmFormLetter(letter, crmFormLetterMergeFields({ role: "admin", profile: ADMIN_CRM_SENDER_PROFILE, deal })).bodyHtml)
      .toContain("our team will make it right");
  });

  it("leaves the details only the sender knows as brackets", () => {
    const shipped = CRM_FORM_LETTERS.admin.find((item) => item.key === "order_shipped")!;
    const body = fillCrmFormLetter(shipped, crmFormLetterMergeFields({ role: "admin", deal })).bodyHtml;
    for (const bracket of ["[order number]", "[carrier]", "[tracking number]", "[delivery date]"]) {
      expect(body).toContain(bracket);
    }
  });

  it("maps the signed-in account to the right letter set", () => {
    expect(crmFormLetterRoleFor({ userRole: "contractor", audience: "affiliate" })).toBe("contractor");
    expect(crmFormLetterRoleFor({ userRole: "admin", audience: "affiliate" })).toBe("admin");
    expect(crmFormLetterRoleFor({ userRole: "partner", audience: "affiliate" })).toBe("affiliate");
    expect(crmFormLetterRoleFor({ userRole: "user", audience: "admin" })).toBe("admin");
    expect(crmFormLetterRoleFor({ userRole: null, audience: null })).toBe("admin");
  });

  it("counts a started subject or a keystroke in the body as typed text", () => {
    expect(composeHasTypedText({ subject: "", bodyText: "" })).toBe(false);
    expect(composeHasTypedText({ subject: "   ", bodyText: "Hi Ana" })).toBe(true);
    expect(composeHasTypedText({ subject: "Re: quote", bodyText: "" })).toBe(true);
    expect(composeHasTypedText({ subject: "", bodyText: "My own wording" })).toBe(true);
  });

  it("does not treat the pre-filled greeting or a loaded draft as something to confirm", () => {
    const baseline = "Hi Ana Ruiz,";
    expect(composeHasTypedText({ subject: "", bodyText: baseline, baselineBodyText: baseline })).toBe(false);
    expect(composeHasTypedText({ subject: "", bodyText: "Hi Ana Ruiz, thanks!", baselineBodyText: baseline })).toBe(true);
    expect(composeHasTypedText({ subject: "", bodyText: "", baselineBodyText: baseline })).toBe(false);
    expect(composeHasTypedText({ subject: "", bodyText: baseline, baselineBodyText: "" })).toBe(true);
  });

  it("still merges the pre-existing per-deal tokens", () => {
    expect(applyCrmMergeFields("Hi {{contactName}}", { contactName: "Ana" })).toBe("Hi Ana");
    expect(applyCrmMergeFields("{{unknownToken}}", {})).toBe("{{unknownToken}}");
  });
});

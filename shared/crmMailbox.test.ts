import { describe, expect, it } from "vitest";
import {
  CRM_BUILTIN_EMAIL_TEMPLATES,
  affiliateSmtpReady,
  applyCrmMergeFields,
  crmDueState,
  crmMailboxVisible,
  filterMondayDeals,
  formatMailboxFrom,
  pickPipelineDeal,
  resolveCrmOutbound,
  sanitizeCrmEmailHtml,
  summarizeAffiliatePipelines,
  toPublicAffiliateEmailSettings,
} from "./crmMailbox";
const platform = {
  smtpHost: "smtp.platform.test",
  smtpPort: 465,
  smtpUser: "platform@cabinetdealz.com",
  smtpPass: "platform-secret",
  smtpFrom: "sales@cabinetdealz.com",
  enabled: true,
};

const affiliateSettings = {
  affiliateId: 7,
  provider: "gmail",
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpUser: "store@gmail.com",
  smtpPass: "affiliate-secret",
  smtpFrom: "store@gmail.com",
  fromName: "Reaves Way",
  replyTo: "hello@reaves.test",
  signatureHtml: "<p>Thanks</p>",
  enabled: true,
};

describe("CRM outbound mail", () => {
  it("uses the affiliate mailbox when that affiliate has connected email", () => {
    const plan = resolveCrmOutbound({
      dealAffiliateId: 7,
      storeName: "Reaves Way Cabinet Shop",
      publicEmail: "public@reaves.test",
      affiliate: affiliateSettings,
      platform,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.channel).toBe("affiliate");
    expect(plan.from).toBe('"Reaves Way" <store@gmail.com>');
    expect(plan.replyTo).toBe("hello@reaves.test");
    expect(plan.smtp.pass).toBe("affiliate-secret");
  });

  it("falls back to platform SMTP with the store name and public reply-to", () => {
    const plan = resolveCrmOutbound({
      dealAffiliateId: 7,
      storeName: "Reaves Way Cabinet Shop",
      publicEmail: "public@reaves.test",
      affiliate: { ...affiliateSettings, enabled: false },
      platform,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.channel).toBe("platform_fallback");
    expect(plan.from).toBe('"Reaves Way Cabinet Shop" <sales@cabinetdealz.com>');
    expect(plan.replyTo).toBe("public@reaves.test");
    expect(plan.smtp.user).toBe("platform@cabinetdealz.com");
    expect(plan.smtp.pass).toBe("platform-secret");
  });

  it("keeps house deals on the platform mailbox", () => {
    const plan = resolveCrmOutbound({
      dealAffiliateId: null,
      storeName: "Cabinet Dealz",
      publicEmail: null,
      affiliate: null,
      platform,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.channel).toBe("platform");
    expect(plan.from).toBe("sales@cabinetdealz.com");
    expect(plan.replyTo).toBeUndefined();
  });

  it("blocks fallback when platform mail is disabled and the affiliate is not connected", () => {
    const plan = resolveCrmOutbound({
      dealAffiliateId: 7,
      storeName: "Shop",
      publicEmail: "public@shop.test",
      affiliate: null,
      platform: { ...platform, enabled: false },
    });
    expect(plan).toEqual({ ok: false, reason: "disabled" });
  });
});

describe("affiliate email privacy and isolation", () => {
  it("drops the stored password from the public settings object", () => {
    const pub = toPublicAffiliateEmailSettings({ ...affiliateSettings, smtpPass: "cabinetdealz:smtp:v1:ciphertext" });
    expect(pub).not.toHaveProperty("smtpPass");
    expect(JSON.stringify(pub)).not.toContain("ciphertext");
    expect(pub.hasPassword).toBe(true);
    expect(pub.connected).toBe(true);
    expect(affiliateSmtpReady({ ...affiliateSettings, smtpPass: "" })).toBe(false);
  });

  it("shows an affiliate only its own mailbox rows and shows every row to the house CRM", () => {
    const row = { affiliateId: 7, authorUserId: 3 };
    expect(crmMailboxVisible({ kind: "affiliate", affiliateId: 7 }, row)).toBe(true);
    expect(crmMailboxVisible({ kind: "affiliate", affiliateId: 8 }, row)).toBe(false);
    expect(crmMailboxVisible({ kind: "house" }, row)).toBe(true);
    expect(crmMailboxVisible({ kind: "contractor", userId: 3 }, { affiliateId: null, authorUserId: 3 })).toBe(true);
    expect(crmMailboxVisible({ kind: "contractor", userId: 4 }, { affiliateId: null, authorUserId: 3 })).toBe(false);
  });
});

describe("pipeline attach and monday filters", () => {
  const candidates = [
    { id: 1, affiliateId: 7, contactEmail: "a@shop.test", orderRequestId: 10, stage: "new" },
    { id: 2, affiliateId: null, contactEmail: "a@shop.test", orderRequestId: null, stage: "new" },
    { id: 3, affiliateId: 7, contactEmail: "a@shop.test", orderRequestId: null, stage: "won" },
  ];

  it("attaches an order to the deal already created for that order in the same affiliate pipeline", () => {
    expect(pickPipelineDeal(candidates, { affiliateId: 7, match: "order", orderRequestId: 10 })?.id).toBe(1);
    expect(pickPipelineDeal(candidates, { affiliateId: null, match: "order", orderRequestId: 10 })).toBeNull();
  });

  it("attaches a design lead to the open deal with the same email and ignores a won deal", () => {
    expect(pickPipelineDeal(candidates, { affiliateId: 7, match: "email", contactEmail: "A@shop.test" })?.id).toBe(1);
    expect(pickPipelineDeal(candidates, { affiliateId: null, match: "email", contactEmail: "a@shop.test" })?.id).toBe(2);
  });

  it("highlights due today and overdue, and totals each affiliate pipeline including house", () => {
    const now = new Date("2026-10-26T15:00:00");
    expect(crmDueState("2026-10-26T09:00:00", now)).toBe("today");
    expect(crmDueState("2026-10-25T09:00:00", now)).toBe("overdue");
    const totals = summarizeAffiliatePipelines([
      { id: 1, title: "A", stage: "new", priority: "high", contactName: null, contactEmail: null, company: null, estimatedValue: "100", nextFollowUpAt: null, affiliateId: null },
      { id: 2, title: "B", stage: "won", priority: "low", contactName: null, contactEmail: null, company: null, estimatedValue: "50", nextFollowUpAt: null, affiliateId: 7 },
    ], { 7: "Reaves Way" });
    expect(totals.map((row) => row.name)).toEqual(["Cabinet Dealz (house)", "Reaves Way"]);
    expect(totals[0]).toMatchObject({ openCount: 1, openValue: 100, wonCount: 0 });
    expect(totals[1]).toMatchObject({ openCount: 0, wonCount: 1 });
    expect(filterMondayDeals([
      { id: 1, title: "Kitchen", stage: "new", priority: "high", contactName: "Ana", contactEmail: null, company: null, estimatedValue: null, nextFollowUpAt: "2026-10-25T09:00:00", affiliateId: 7 },
    ], { search: "ana", stage: "all", priority: "all", due: "overdue", affiliate: "all" }, now)).toHaveLength(1);
  });

  it("merges template fields and strips scripts from rich text", () => {
    expect(CRM_BUILTIN_EMAIL_TEMPLATES.map((template) => template.key)).toEqual(["follow_up", "quote_ready", "design_ready"]);
    expect(applyCrmMergeFields("Hi {{contactName}}", { contactName: "Ana" })).toBe("Hi Ana");
    expect(sanitizeCrmEmailHtml('<p onclick="alert(1)">Hi</p><script>alert(1)</script>')).toBe("<p>Hi</p>");
    expect(formatMailboxFrom("Shop", "a@shop.test")).toBe('"Shop" <a@shop.test>');
  });
});

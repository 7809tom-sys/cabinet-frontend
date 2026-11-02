import { describe, expect, it } from "vitest";
import {
  AFFILIATE_APP_PASSWORD_HELP,
  AFFILIATE_EMAIL_PRESETS,
  AFFILIATE_EMAIL_SETUP_GUIDES,
  AFFILIATE_INVOICE_COPY_NOTE,
  YAHOO_APP_PASSWORD_HELP,
  affiliateEmailDraftDirty,
  affiliateEmailDraftFromView,
  affiliateEmailSettingsConfigured,
  affiliateEmailSetupGuide,
  affiliateEmailStatus,
  applyAffiliateEmailPreset,
  buildAffiliateEmailSettingsUpdate,
  canManageAffiliateEmailSettings,
  canViewAffiliateEmailSettings,
  emptyAffiliateEmailDraft,
  isAffiliateEmailProvider,
  normalizeAppPassword,
  toAffiliateEmailSettingsView,
  type AffiliateEmailSettingsRecord,
} from "./affiliateEmailSettings";

const record: AffiliateEmailSettingsRecord = {
  affiliateId: 7,
  email: "rich@reaveswaycabinets.com",
  provider: "yahoo",
  smtpHost: "smtp.mail.yahoo.com",
  smtpPort: 465,
  secure: true,
  username: "rich@reaveswaycabinets.com",
  appPassword: "cabinetdealz:smtp:v1:ciphertext",
  enabled: true,
  lastTestedAt: new Date("2026-11-01T12:00:00.000Z"),
  lastTestOk: true,
};

const draft = {
  email: "rich@reaveswaycabinets.com",
  provider: "yahoo" as const,
  smtpHost: "smtp.mail.yahoo.com",
  smtpPort: 465,
  username: "rich@reaveswaycabinets.com",
  appPassword: "abcdwxyzabcdwxyz",
  enabled: true,
};

describe("affiliate email presets", () => {
  it("fills Yahoo with smtp.mail.yahoo.com on port 465 with SSL", () => {
    expect(AFFILIATE_EMAIL_PRESETS.yahoo).toMatchObject({
      host: "smtp.mail.yahoo.com",
      port: 465,
      secure: true,
    });
    const empty = emptyAffiliateEmailDraft();
    expect(empty.provider).toBe("yahoo");
    expect(empty.smtpHost).toBe("smtp.mail.yahoo.com");
    expect(empty.smtpPort).toBe(465);
  });

  it("keeps Gmail, Outlook, and Custom available and fills the server on switch", () => {
    const gmail = applyAffiliateEmailPreset(emptyAffiliateEmailDraft("yahoo"), "gmail");
    expect(gmail).toMatchObject({ provider: "gmail", smtpHost: "smtp.gmail.com", smtpPort: 465 });
    const outlook = applyAffiliateEmailPreset(gmail, "outlook");
    expect(outlook).toMatchObject({ provider: "outlook", smtpHost: "smtp-mail.outlook.com", smtpPort: 587 });
    const custom = applyAffiliateEmailPreset(outlook, "custom");
    expect(custom.provider).toBe("custom");
    expect(custom.smtpPort).toBe(587);
    expect(isAffiliateEmailProvider("yahoo")).toBe(true);
    expect(isAffiliateEmailProvider("aol")).toBe(false);
  });

  it("says Yahoo needs an app password from Account Info > Account Security", () => {
    expect(YAHOO_APP_PASSWORD_HELP).toContain("Account Info");
    expect(YAHOO_APP_PASSWORD_HELP).toContain("Account Security");
    expect(YAHOO_APP_PASSWORD_HELP).toContain("Generate app password");
    expect(AFFILIATE_EMAIL_PRESETS.yahoo.summary).toContain("app password");
    expect(AFFILIATE_APP_PASSWORD_HELP.yahoo.detail).toContain("Account Info, then Account Security, then Generate app password");
    expect(AFFILIATE_APP_PASSWORD_HELP.yahoo.detail).toContain("normal Yahoo password will not work");
    expect(AFFILIATE_APP_PASSWORD_HELP.gmail.detail).toContain("App passwords");
    expect(AFFILIATE_APP_PASSWORD_HELP.outlook.detail).toContain("Advanced security");
  });
});

describe("affiliate email setup instructions", () => {
  it("covers Yahoo, Gmail, Outlook, and Other in order", () => {
    expect(AFFILIATE_EMAIL_SETUP_GUIDES.map((guide) => guide.label)).toEqual(["Yahoo", "Gmail", "Outlook", "Other"]);
  });

  it("gives every provider short numbered steps that end with the test email", () => {
    for (const guide of AFFILIATE_EMAIL_SETUP_GUIDES) {
      expect(guide.steps.length).toBeGreaterThanOrEqual(4);
      expect(guide.steps.length).toBeLessThanOrEqual(6);
      expect(guide.steps.join(" ")).toMatch(/Save email settings/);
      expect(guide.steps[guide.steps.length - 1]).toMatch(/Send test email/);
      expect(guide.failTips.length).toBeGreaterThan(0);
    }
  });

  it("names the exact app-password menu path for each provider", () => {
    const text = (key: "yahoo" | "gmail" | "outlook" | "custom") => affiliateEmailSetupGuide(key).steps.join(" ");
    expect(text("yahoo")).toContain("Account Info");
    expect(text("yahoo")).toContain("Account Security");
    expect(text("yahoo")).toContain("Generate app password");
    expect(text("gmail")).toContain("Google Account");
    expect(text("gmail")).toContain("2-Step Verification");
    expect(text("gmail")).toContain("App passwords");
    expect(text("outlook")).toContain("Advanced security");
    expect(text("outlook")).toContain("App passwords");
    expect(text("custom")).toContain("mail server");
  });
});

describe("affiliate email privacy", () => {
  it("never returns the saved app password, only a configured flag", () => {
    const view = toAffiliateEmailSettingsView(record, { canEdit: true });
    expect(view).not.toHaveProperty("appPassword");
    expect(JSON.stringify(view)).not.toContain("ciphertext");
    expect(view.hasAppPassword).toBe(true);
    expect(view.configured).toBe(true);
    expect(view.canEdit).toBe(true);
  });

  it("starts the form with a blank password even when one is saved", () => {
    const view = toAffiliateEmailSettingsView(record, { canEdit: true });
    expect(affiliateEmailDraftFromView(view).appPassword).toBe("");
    expect(affiliateEmailDraftDirty(affiliateEmailDraftFromView(view), view)).toBe(false);
  });

  it("does not count a mailbox as configured without a password", () => {
    expect(affiliateEmailSettingsConfigured({ ...record, appPassword: "" })).toBe(false);
    expect(affiliateEmailSettingsConfigured(record)).toBe(true);
    expect(affiliateEmailStatus(toAffiliateEmailSettingsView({ ...record, appPassword: "" }, { canEdit: true }))).toBe("not_configured");
    expect(affiliateEmailStatus(toAffiliateEmailSettingsView({ ...record, enabled: false }, { canEdit: true }))).toBe("configured_disabled");
    expect(affiliateEmailStatus(toAffiliateEmailSettingsView(record, { canEdit: true }))).toBe("active");
  });
});

describe("affiliate email validation", () => {
  it("rejects a missing or malformed customer address", () => {
    expect(buildAffiliateEmailSettingsUpdate({ affiliateId: 7, draft: { ...draft, email: " " }, hasAppPassword: true }))
      .toMatchObject({ ok: false, field: "email" });
    expect(buildAffiliateEmailSettingsUpdate({ affiliateId: 7, draft: { ...draft, email: "rich@" }, hasAppPassword: true }))
      .toMatchObject({ ok: false, field: "email" });
  });

  it("requires an app password on the first save but keeps it when blank afterwards", () => {
    expect(buildAffiliateEmailSettingsUpdate({ affiliateId: 7, draft: { ...draft, appPassword: "" }, hasAppPassword: false }))
      .toMatchObject({ ok: false, field: "appPassword" });
    const kept = buildAffiliateEmailSettingsUpdate({ affiliateId: 7, draft: { ...draft, appPassword: "   " }, hasAppPassword: true });
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(kept.input).not.toHaveProperty("appPassword");
  });

  it("strips the Google spaces from the app password and sends only the server fields", () => {
    const checked = buildAffiliateEmailSettingsUpdate({
      affiliateId: 7,
      draft: { ...draft, appPassword: "abcd wxyz abcd wxyz" },
      hasAppPassword: false,
    });
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.input).toEqual({
      affiliateId: 7,
      email: "rich@reaveswaycabinets.com",
      provider: "yahoo",
      smtpHost: "smtp.mail.yahoo.com",
      smtpPort: 465,
      secure: true,
      username: "rich@reaveswaycabinets.com",
      enabled: true,
      appPassword: "abcdwxyzabcdwxyz",
    });
    expect(normalizeAppPassword("abcd wxyz abcd wxyz")).toBe("abcdwxyzabcdwxyz");
  });

  it("refuses a pasted web address in the mail server field", () => {
    const checked = buildAffiliateEmailSettingsUpdate({
      affiliateId: 7,
      draft: { ...draft, provider: "custom", smtpHost: "https://smtp.mail.yahoo.com/services" },
      hasAppPassword: true,
    });
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.input.smtpHost).toBe("smtp.mail.yahoo.com");
    expect(checked.input.secure).toBe(true);

    expect(buildAffiliateEmailSettingsUpdate({
      affiliateId: 7,
      draft: { ...draft, smtpHost: "smtp server with spaces" },
      hasAppPassword: true,
    })).toMatchObject({ ok: false, field: "smtpHost" });
  });

  it("validates the port and username", () => {
    expect(buildAffiliateEmailSettingsUpdate({ affiliateId: 7, draft: { ...draft, smtpPort: "abc" }, hasAppPassword: true }))
      .toMatchObject({ ok: false, field: "smtpPort" });
    expect(buildAffiliateEmailSettingsUpdate({ affiliateId: 7, draft: { ...draft, smtpPort: 70000 }, hasAppPassword: true }))
      .toMatchObject({ ok: false, field: "smtpPort" });
    expect(buildAffiliateEmailSettingsUpdate({ affiliateId: 7, draft: { ...draft, username: "  " }, hasAppPassword: true }))
      .toMatchObject({ ok: false, field: "username" });
  });

  it("marks the form dirty only when something really changed", () => {
    const view = toAffiliateEmailSettingsView(record, { canEdit: true });
    expect(affiliateEmailDraftDirty({ ...draft, appPassword: "" }, view)).toBe(false);
    expect(affiliateEmailDraftDirty({ ...draft, appPassword: "newpassword" }, view)).toBe(true);
    expect(affiliateEmailDraftDirty({ ...draft, enabled: false }, view)).toBe(true);
  });
});

describe("affiliate email access", () => {
  const owner = { role: "partner", ownAffiliateId: 7, memberships: [] };
  const teamMember = { role: "user", ownAffiliateId: null, memberships: [] };
  const otherOwner = {
    role: "partner",
    ownAffiliateId: 8,
    memberships: [{ affiliateId: 8, isOwner: true, isActive: true }],
  };
  const coOwner = {
    role: "user",
    ownAffiliateId: null,
    memberships: [{ affiliateId: 7, isOwner: true, isActive: true }],
  };
  const salesperson = {
    role: "user",
    ownAffiliateId: null,
    memberships: [{ affiliateId: 7, isOwner: false, isActive: true }],
  };

  it("lets the store owner and a co-owner manage their own store", () => {
    expect(canManageAffiliateEmailSettings(owner, 7).ok).toBe(true);
    expect(canManageAffiliateEmailSettings(coOwner, 7).ok).toBe(true);
  });

  it("lets a platform admin manage any store", () => {
    expect(canManageAffiliateEmailSettings({ role: "admin", ownAffiliateId: null, memberships: [] }, 42).ok).toBe(true);
  });

  it("never lets another affiliate read or change these settings", () => {
    expect(canManageAffiliateEmailSettings(otherOwner, 7).ok).toBe(false);
    const denied = canManageAffiliateEmailSettings(otherOwner, 7);
    expect(denied).toEqual({
      ok: false,
      message: "Only the store owner or a CabinetDealz administrator can change these email settings.",
    });
    expect(canViewAffiliateEmailSettings(otherOwner, 7).ok).toBe(false);
    // Its own store stays reachable, so the rule is scope, not a blanket lock.
    expect(canManageAffiliateEmailSettings(otherOwner, 8).ok).toBe(true);
  });

  it("keeps a non-owner team member read-only", () => {
    expect(canManageAffiliateEmailSettings(salesperson, 7).ok).toBe(false);
    expect(canManageAffiliateEmailSettings(teamMember, 7).ok).toBe(false);
    expect(canManageAffiliateEmailSettings(null, 7).ok).toBe(false);
  });

  it("ignores an inactive owner membership", () => {
    const inactiveOwner = {
      role: "user",
      ownAffiliateId: null,
      memberships: [{ affiliateId: 7, isOwner: true, isActive: false }],
    };
    expect(canManageAffiliateEmailSettings(inactiveOwner, 7).ok).toBe(false);
  });
});

describe("affiliate invoice copy notice", () => {
  it("states that CabinetDealz receives every invoice and cannot switch it off", () => {
    expect(AFFILIATE_INVOICE_COPY_NOTE).toContain("CabinetDealz gets a copy of every invoice you send to a customer");
    expect(AFFILIATE_INVOICE_COPY_NOTE).toContain("cannot be turned off");
  });
});

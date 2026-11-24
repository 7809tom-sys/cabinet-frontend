// Affiliate (contractor) email settings for their own storefront.
//
// A store owner enters the normal email address they use with customers plus
// the SMTP sender details their mail provider issued. The app password is
// write-only: it goes to the server once and comes back only as a boolean
// (`hasAppPassword`). Nothing here stores, logs, or re-displays it.
//
// This module is pure so the client form, the server validation, and the
// tests share one definition of the presets, the setup instructions, and the
// access rule.

export const AFFILIATE_EMAIL_PROVIDERS = ["yahoo", "gmail", "outlook", "custom"] as const;
export type AffiliateEmailProvider = (typeof AFFILIATE_EMAIL_PROVIDERS)[number];

export type AffiliateEmailPreset = {
  label: string;
  /** Empty for Custom: the owner types their provider's server. */
  host: string;
  port: number;
  /** 465 is implicit SSL. 587 upgrades with STARTTLS. */
  secure: boolean;
  summary: string;
};

/**
 * Yahoo is first because it is the preset most store owners pick. Its server
 * settings are the ones the owner would otherwise have to look up:
 * smtp.mail.yahoo.com on port 465 with SSL.
 */
export const AFFILIATE_EMAIL_PRESETS: Record<AffiliateEmailProvider, AffiliateEmailPreset> = {
  yahoo: {
    label: "Yahoo",
    host: "smtp.mail.yahoo.com",
    port: 465,
    secure: true,
    summary: "Yahoo needs an app password. Your normal Yahoo password will not work.",
  },
  gmail: {
    label: "Gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    summary: "Google needs an app password. Your normal Google password will not work.",
  },
  outlook: {
    label: "Outlook",
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: false,
    summary: "Microsoft needs an app password for most accounts.",
  },
  custom: {
    label: "Custom",
    host: "",
    port: 587,
    secure: false,
    summary: "Use the server name and port your email provider gave you.",
  },
};

export const DEFAULT_AFFILIATE_EMAIL_PROVIDER: AffiliateEmailProvider = "yahoo";

/** Read-only notice shown in the settings panel. It is not an editable option. */
export const AFFILIATE_INVOICE_COPY_NOTE =
  "CabinetDealz gets a copy of every invoice you send to a customer. This is built into invoicing and cannot be turned off.";

/** Yahoo shows the app-password page behind Account Info > Account Security. */
export const YAHOO_APP_PASSWORD_HELP =
  "In Yahoo Mail, open Account Info, then Account Security, then Generate app password.";

/**
 * One-line warning above the server fields. Yahoo is the default preset, so its
 * wording is the one most store owners read first.
 */
export const AFFILIATE_APP_PASSWORD_HELP: Record<AffiliateEmailProvider, { headline: string; detail: string }> = {
  yahoo: {
    headline: "Yahoo needs an app password.",
    detail: `${YAHOO_APP_PASSWORD_HELP} Your normal Yahoo password will not work here.`,
  },
  gmail: {
    headline: "Gmail needs an app password.",
    detail: "In your Google Account, open Security, turn on 2-Step Verification, then open App passwords (myaccount.google.com/apppasswords). Your normal Google password will not work here.",
  },
  outlook: {
    headline: "Outlook usually needs an app password.",
    detail: "Sign in at account.microsoft.com, open Security, then Advanced security options, then App passwords. Your normal Microsoft password will not work here.",
  },
  custom: {
    headline: "Your provider may need an app password.",
    detail: "Ask your email provider whether outside apps need a separate password, and where to create it.",
  },
};

export type AffiliateEmailSetupGuideKey = AffiliateEmailProvider;

export type AffiliateEmailSetupGuide = {
  key: AffiliateEmailSetupGuideKey;
  label: string;
  steps: string[];
  failTips: string[];
};

/**
 * Plain-language, numbered setup help. Written for a contractor, not for a
 * mail administrator: short sentences and the exact menu names the provider
 * uses on screen.
 */
export const AFFILIATE_EMAIL_SETUP_GUIDES: AffiliateEmailSetupGuide[] = [
  {
    key: "yahoo",
    label: "Yahoo",
    steps: [
      "Open Yahoo Mail, click your name at the top right, then click Account Info.",
      "Click Account Security, then click Generate app password. Yahoo may ask you to sign in again.",
      "Type a name like CabinetDealz and click Generate. Copy the password Yahoo shows you.",
      "Come back to this page. Type your Yahoo address, keep Yahoo selected, paste the app password, and click Save email settings.",
      "Click Send test email. When the test arrives in your inbox, you are done.",
    ],
    failTips: [
      "Use the app password Yahoo generated, not your normal Yahoo password.",
      "If Yahoo has no Generate app password button, turn on two-step verification under Account Security first.",
      "Copy the password again. A wrong or expired app password is the most common reason a test fails.",
    ],
  },
  {
    key: "gmail",
    label: "Gmail",
    steps: [
      "Open your Google Account, click Security, then turn on 2-Step Verification if it is off.",
      "On the same Security page, click App passwords, or go straight to myaccount.google.com/apppasswords. If you do not see it, 2-Step Verification is not on yet, or your account is managed by an organization that blocks app passwords.",
      "Type a name like CabinetDealz and click Create. Copy the 16-character password Google shows you.",
      "Come back to this page. Type your Gmail address, choose Gmail, paste the app password, and click Save email settings.",
      "Click Send test email. When the test arrives in your inbox, you are done.",
    ],
    failTips: [
      "App passwords only appear after 2-Step Verification is on.",
      "Google shows the password once. If you lost it, create a new app password.",
      "Spaces in the Google password are fine. We remove them when we save it.",
    ],
  },
  {
    key: "outlook",
    label: "Outlook",
    steps: [
      "Sign in at account.microsoft.com, click Security, then click Advanced security options.",
      "Turn on two-step verification if Microsoft asks you to.",
      "Under App passwords, click Create a new app password, then copy the password Microsoft shows you.",
      "Come back to this page. Type your Outlook address, choose Outlook, paste the app password, and click Save email settings.",
      "Click Send test email. When the test arrives in your inbox, you are done.",
    ],
    failTips: [
      "If you do not see App passwords, your Microsoft account or work mailbox does not allow them. Ask your work IT contact for the mail server name and password, then choose Custom.",
      "Use the app password, not your Microsoft account password.",
      "Copy the password again if Outlook says the login failed.",
    ],
  },
  {
    key: "custom",
    label: "Other",
    steps: [
      "Ask your email provider for its mail server name, its port, and whether it uses SSL.",
      "Ask whether outside apps need an app password. If yes, create one in the provider's security settings.",
      "Come back to this page, choose Other, and type the server name, port, username, and app password. Click Save email settings.",
      "Click Send test email. When the test arrives in your inbox, you are done.",
    ],
    failTips: [
      "Most providers use port 465 with SSL, or port 587 without SSL.",
      "The username is usually the full email address.",
      "If the server name starts with https:// or has a slash, remove that part. Only the server name goes in this field.",
    ],
  },
];

export function affiliateEmailSetupGuide(provider: AffiliateEmailProvider): AffiliateEmailSetupGuide {
  return AFFILIATE_EMAIL_SETUP_GUIDES.find((guide) => guide.key === provider)
    ?? AFFILIATE_EMAIL_SETUP_GUIDES[AFFILIATE_EMAIL_SETUP_GUIDES.length - 1];
}

// ─── Provider recognition ─────────────────────────────────────────────────────

const PROVIDER_DOMAINS: Record<Exclude<AffiliateEmailProvider, "custom">, readonly string[]> = {
  gmail: ["gmail.com", "googlemail.com"],
  yahoo: ["yahoo.com", "ymail.com", "rocketmail.com"],
  outlook: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
};

/** Consumer mailboxes with no preset here. The owner must look up the server. */
const OTHER_FREE_MAIL_DOMAINS = [
  "aol.com", "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com",
  "gmx.com", "zoho.com", "comcast.net", "att.net", "sbcglobal.net", "verizon.net", "cox.net",
];

export function affiliateEmailDomain(email: string): string | null {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1) return null;
  const domain = value.slice(at + 1);
  return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain) ? domain : null;
}

export type AffiliateEmailRecognition =
  | { kind: "none" }
  | { kind: "preset"; provider: Exclude<AffiliateEmailProvider, "custom">; domain: string }
  | { kind: "other-free"; domain: string }
  | { kind: "own-domain"; domain: string };

/**
 * What the typed address tells us. Gmail, Yahoo and Outlook.com addresses map to
 * their preset. A different consumer mailbox has no preset. Anything else is
 * treated as the owner's own domain.
 */
export function recognizeAffiliateEmail(email: string): AffiliateEmailRecognition {
  const domain = affiliateEmailDomain(email);
  if (!domain) return { kind: "none" };
  for (const provider of Object.keys(PROVIDER_DOMAINS) as Array<keyof typeof PROVIDER_DOMAINS>) {
    if (PROVIDER_DOMAINS[provider].includes(domain)) return { kind: "preset", provider, domain };
  }
  if (OTHER_FREE_MAIL_DOMAINS.includes(domain)) return { kind: "other-free", domain };
  return { kind: "own-domain", domain };
}

/**
 * Apply what the typed address implies. A recognized address switches the
 * provider (and its server and port) and fills the username with the address,
 * but only when the owner has not already chosen something else on purpose:
 * `providerTouched` is true after they pick a provider by hand.
 */
export function applyAffiliateEmailRecognition(
  draft: AffiliateEmailSettingsDraft,
  options: { providerTouched: boolean; usernameTouched: boolean },
): AffiliateEmailSettingsDraft {
  const recognition = recognizeAffiliateEmail(draft.email);
  let next = draft;
  if (recognition.kind === "preset" && !options.providerTouched && draft.provider !== recognition.provider) {
    next = applyAffiliateEmailPreset(next, recognition.provider);
  }
  if (recognition.kind !== "none" && !options.usernameTouched) {
    next = { ...next, username: draft.email.trim() };
  }
  return next;
}

// ─── Own-domain mailbox instructions ──────────────────────────────────────────
// Every host, port and DNS value below comes from the provider's own help page
// (URLs in `sources`). Nothing here is a guess. DKIM values that Google and
// Microsoft generate per domain are deliberately not written out: the guide
// tells the owner where to copy them from.

export type DomainMailHostKey = "hostinger" | "google" | "microsoft" | "other";

export type DomainDnsRecord = {
  type: "TXT" | "CNAME";
  name: string;
  value: string;
  note?: string;
};

export type DomainMailHostGuide = {
  key: DomainMailHostKey;
  label: string;
  /** Where the owner creates the mailbox. */
  createMailbox: string[];
  /** Server fields to type into this page. `host` is empty for "other". */
  smtp: { host: string; port: number; security: string; username: string; password: string };
  /** Records for deliverability, with the owner's domain filled in. */
  dns: (domain: string) => DomainDnsRecord[];
  sources: string[];
};

export const DOMAIN_MAIL_HOST_GUIDES: DomainMailHostGuide[] = [
  {
    key: "hostinger",
    label: "Hostinger Email",
    createMailbox: [
      "In Hostinger hPanel, open Emails, then pick your domain and create a mailbox like you@yourdomain.com.",
      "Write down the mailbox password. Hostinger accepts that password, or an app password if the mailbox uses two-factor sign-in.",
    ],
    smtp: {
      host: "smtp.hostinger.com",
      port: 465,
      security: "SSL/TLS (port 587 with STARTTLS also works if 465 is blocked)",
      username: "The full email address",
      password: "The mailbox password (or an app password if the mailbox uses 2FA)",
    },
    dns: (domain) => [
      { type: "TXT", name: "@", value: "v=spf1 include:_spf.mail.hostinger.com ~all", note: "Keep only one SPF record on the domain." },
      { type: "CNAME", name: "hostingermail-a._domainkey", value: "hostingermail-a.dkim.mail.hostinger.com" },
      { type: "CNAME", name: "hostingermail-b._domainkey", value: "hostingermail-b.dkim.mail.hostinger.com" },
      { type: "CNAME", name: "hostingermail-c._domainkey", value: "hostingermail-c.dkim.mail.hostinger.com" },
      { type: "TXT", name: "_dmarc", value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`, note: "p=none only watches. It does not block anything." },
    ],
    sources: [
      "https://docs.hostinger.com/emails/setup-devices",
      "https://www.hostinger.com/support/how-to-fix-smtp-email-sending-errors-on-hostinger/",
      "https://www.hostinger.com/support/1583673-what-is-the-spf-record-for-hostinger-email/",
      "https://www.hostinger.com/support/4456413-what-are-the-dkim-records-for-hostinger-email/",
      "https://www.hostinger.com/support/8412851-how-to-add-a-dmarc-record-for-hostinger-email/",
    ],
  },
  {
    key: "google",
    label: "Google Workspace",
    createMailbox: [
      "In the Google Admin console, add the user (Directory, then Users) so they have you@yourdomain.com.",
      "Sign in as that user, turn on 2-Step Verification, then create an app password at myaccount.google.com/apppasswords. Your Workspace administrator can block app passwords, so ask them if the page is missing.",
    ],
    smtp: {
      host: "smtp.gmail.com",
      port: 465,
      security: "SSL/TLS (port 587 with STARTTLS also works)",
      username: "The full Google Workspace email address",
      password: "A Google app password",
    },
    dns: (domain) => [
      { type: "TXT", name: "@", value: "v=spf1 include:_spf.google.com ~all", note: "If other services also send mail for your domain, add their include: values to this same record." },
      { type: "TXT", name: "google._domainkey", value: "Copy the value Google shows you", note: "Google Admin console, Apps, Google Workspace, Gmail, Authenticate email, Generate new record. Then click Start authentication. Google says to wait 24 to 72 hours after turning Gmail on before the key is available." },
      { type: "TXT", name: "_dmarc", value: `v=DMARC1; p=none; rua=mailto:postmaster@${domain}`, note: "Google says to wait 48 hours after SPF and DKIM are working before adding DMARC." },
    ],
    sources: [
      "https://developers.google.com/workspace/gmail/imap/imap-smtp",
      "https://knowledge.workspace.google.com/admin/gmail/send-email-from-a-printer-scanner-or-app",
      "https://knowledge.workspace.google.com/admin/security/set-up-spf",
      "https://knowledge.workspace.google.com/admin/security/set-up-dkim",
      "https://knowledge.workspace.google.com/admin/security/set-up-dmarc",
    ],
  },
  {
    key: "microsoft",
    label: "Microsoft 365",
    createMailbox: [
      "In the Microsoft 365 admin center, open Users, then Active users, and add a licensed user with you@yourdomain.com.",
      "Turn on Authenticated SMTP for that mailbox: select the user, open Mail, then Manage email apps, check Authenticated SMTP, and save. Microsoft turns it off by default for newer organizations.",
    ],
    smtp: {
      host: "smtp.office365.com",
      port: 587,
      security: "STARTTLS (TLS 1.2 or newer). Microsoft does not support port 465 for this.",
      username: "The full Microsoft 365 email address",
      password: "The mailbox password. If your organization uses security defaults, SMTP sign-in may be blocked and your administrator must allow it.",
    },
    dns: (domain) => [
      { type: "TXT", name: "@", value: "v=spf1 include:spf.protection.outlook.com -all", note: "This is Microsoft's record when Microsoft 365 is the only sender for the domain." },
      { type: "CNAME", name: "selector1._domainkey", value: "Copy the target Microsoft shows you", note: "Microsoft Defender portal, Email authentication settings, DKIM. The target is different for every domain." },
      { type: "CNAME", name: "selector2._domainkey", value: "Copy the target Microsoft shows you", note: "Same page as selector1." },
      { type: "TXT", name: "_dmarc", value: `v=DMARC1; p=none; pct=100; rua=mailto:dmarc@${domain}` },
    ],
    sources: [
      "https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365",
      "https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission",
      "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-spf-configure",
      "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dkim-configure",
      "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dmarc-configure",
    ],
  },
  {
    key: "other",
    label: "Another host",
    createMailbox: [
      "Create the mailbox in your hosting or email provider's control panel.",
      "Find its Outgoing mail (SMTP) settings in the provider's help. Look for the server name, the port, and whether it uses SSL/TLS or STARTTLS.",
    ],
    smtp: {
      host: "",
      port: 587,
      security: "Use what your provider lists. Port 465 is SSL/TLS. Port 587 is STARTTLS.",
      username: "Usually the full email address",
      password: "The mailbox password or an app password",
    },
    dns: (domain) => [
      { type: "TXT", name: "@", value: "Your provider's SPF value", note: "Ask your provider for it. A domain may have only one SPF record." },
      { type: "TXT", name: "(selector)._domainkey", value: "Your provider's DKIM value", note: "Your provider names the selector and gives the value." },
      { type: "TXT", name: "_dmarc", value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`, note: "A starting record that only watches. Add it after SPF and DKIM work." },
    ],
    sources: [],
  },
];

/** The settings to type in for a host guide. Only the preset-less "custom" provider is used. */
export function applyDomainMailHost(
  draft: AffiliateEmailSettingsDraft,
  guide: DomainMailHostGuide,
): AffiliateEmailSettingsDraft {
  return {
    ...draft,
    provider: "custom",
    smtpHost: guide.smtp.host || draft.smtpHost,
    smtpPort: guide.smtp.port,
    username: draft.username || draft.email.trim(),
  };
}

export function isAffiliateEmailProvider(value: unknown): value is AffiliateEmailProvider {
  return typeof value === "string" && (AFFILIATE_EMAIL_PROVIDERS as readonly string[]).includes(value);
}

/**
 * The row the server keeps. `appPassword` is encrypted at rest by the backend
 * and never leaves it: see `toAffiliateEmailSettingsView`.
 */
export type AffiliateEmailSettingsRecord = {
  affiliateId: number;
  email: string;
  provider: AffiliateEmailProvider;
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  username: string;
  appPassword: string;
  enabled: boolean;
  lastTestedAt: Date | string | null;
  lastTestOk: boolean | null;
};

/** What the browser is allowed to see. No password, only a configured flag. */
export type AffiliateEmailSettingsView = {
  affiliateId: number;
  email: string;
  provider: AffiliateEmailProvider;
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  username: string;
  enabled: boolean;
  hasAppPassword: boolean;
  configured: boolean;
  canEdit: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  /** The store's own domain, when it has one. */
  customDomain?: string | null;
  /** True when the server could not read the settings table (pending database update). */
  unavailable?: boolean;
};

export function affiliateEmailSettingsConfigured(
  settings: Pick<AffiliateEmailSettingsRecord, "email" | "smtpHost" | "username" | "appPassword"> | null | undefined,
): boolean {
  return Boolean(
    settings
    && settings.email.trim()
    && settings.smtpHost.trim()
    && settings.username.trim()
    && settings.appPassword.trim(),
  );
}

/**
 * Client-safe projection. The stored password is reduced to `hasAppPassword`
 * so a saved value can never be rendered back into a form field.
 */
export function toAffiliateEmailSettingsView(
  row: AffiliateEmailSettingsRecord,
  options: { canEdit: boolean },
): AffiliateEmailSettingsView {
  return {
    affiliateId: row.affiliateId,
    email: row.email.trim(),
    provider: row.provider,
    smtpHost: row.smtpHost.trim(),
    smtpPort: row.smtpPort,
    secure: row.secure,
    username: row.username.trim(),
    enabled: row.enabled,
    hasAppPassword: row.appPassword.trim().length > 0,
    configured: affiliateEmailSettingsConfigured(row),
    canEdit: options.canEdit,
    lastTestedAt: row.lastTestedAt == null
      ? null
      : row.lastTestedAt instanceof Date
        ? row.lastTestedAt.toISOString()
        : String(row.lastTestedAt),
    lastTestOk: row.lastTestOk ?? null,
  };
}

export type AffiliateEmailSettingsDraft = {
  email: string;
  provider: AffiliateEmailProvider;
  smtpHost: string;
  smtpPort: number | string;
  username: string;
  appPassword: string;
  enabled: boolean;
};

/** The exact payload `affiliateEmailSettings.update` expects. */
export type AffiliateEmailSettingsUpdateInput = {
  affiliateId: number;
  email: string;
  provider: AffiliateEmailProvider;
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  username: string;
  enabled: boolean;
  /** Omitted when the owner leaves the field blank to keep the saved password. */
  appPassword?: string;
};

export type AffiliateEmailSettingsTestInput = { affiliateId: number };
export type AffiliateEmailSettingsTestResult = {
  ok: boolean;
  /** Address the test went to. */
  to: string;
  /** The provider's exact error text when `ok` is false. */
  error: string | null;
};

export function emptyAffiliateEmailDraft(provider: AffiliateEmailProvider = DEFAULT_AFFILIATE_EMAIL_PROVIDER): AffiliateEmailSettingsDraft {
  const preset = AFFILIATE_EMAIL_PRESETS[provider];
  return {
    email: "",
    provider,
    smtpHost: preset.host,
    smtpPort: preset.port,
    username: "",
    appPassword: "",
    enabled: true,
  };
}

/** Load saved settings into the form. The password always starts blank. */
export function affiliateEmailDraftFromView(view: AffiliateEmailSettingsView | null | undefined): AffiliateEmailSettingsDraft {
  if (!view) return emptyAffiliateEmailDraft();
  const provider = isAffiliateEmailProvider(view.provider) ? view.provider : "custom";
  return {
    email: view.email,
    provider,
    smtpHost: view.smtpHost || AFFILIATE_EMAIL_PRESETS[provider].host,
    smtpPort: view.smtpPort || AFFILIATE_EMAIL_PRESETS[provider].port,
    username: view.username,
    appPassword: "",
    enabled: view.enabled,
  };
}

/** Switching the preset fills in that provider's server. */
export function applyAffiliateEmailPreset(
  draft: AffiliateEmailSettingsDraft,
  provider: AffiliateEmailProvider,
): AffiliateEmailSettingsDraft {
  const preset = AFFILIATE_EMAIL_PRESETS[provider];
  return {
    ...draft,
    provider,
    smtpHost: preset.host || (provider === "custom" ? draft.smtpHost : ""),
    smtpPort: preset.port,
  };
}

/** Google shows app passwords with spaces; mail servers want them without. */
export function normalizeAppPassword(value: string): string {
  return value.replace(/\s+/g, "");
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HOST_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

export function isValidEmailAddress(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 254 && EMAIL_PATTERN.test(trimmed);
}

export type AffiliateEmailValidation =
  | { ok: true; input: AffiliateEmailSettingsUpdateInput }
  | { ok: false; field: keyof AffiliateEmailSettingsDraft; message: string };

/**
 * Validate one save. `hasAppPassword` is the saved state: a blank field keeps
 * the stored password, but the first save needs one.
 */
export function buildAffiliateEmailSettingsUpdate(args: {
  affiliateId: number;
  draft: AffiliateEmailSettingsDraft;
  hasAppPassword: boolean;
}): AffiliateEmailValidation {
  const { draft } = args;
  const email = draft.email.trim();
  if (!email) return { ok: false, field: "email", message: "Enter the email address you use with your customers." };
  if (!isValidEmailAddress(email)) return { ok: false, field: "email", message: "Enter a complete email address, like you@yourstore.com." };

  const provider = isAffiliateEmailProvider(draft.provider) ? draft.provider : "custom";
  const smtpHost = draft.smtpHost.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (!smtpHost) return { ok: false, field: "smtpHost", message: "Enter the outgoing mail server from your email provider." };
  if (!HOST_PATTERN.test(smtpHost) || smtpHost.length > 253) {
    return { ok: false, field: "smtpHost", message: "Enter only the server name, like smtp.mail.yahoo.com." };
  }

  const port = typeof draft.smtpPort === "number" ? draft.smtpPort : Number(draft.smtpPort.trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, field: "smtpPort", message: "Enter the port number your provider gave you, like 465 or 587." };
  }

  const username = draft.username.trim();
  if (!username) return { ok: false, field: "username", message: "Enter the username your provider gave you. It is usually your email address." };

  const appPassword = normalizeAppPassword(draft.appPassword);
  if (!appPassword && !args.hasAppPassword) {
    return { ok: false, field: "appPassword", message: "Enter the app password from your email provider." };
  }
  if (appPassword && appPassword.length < 8) {
    return { ok: false, field: "appPassword", message: "That app password looks too short. Copy the whole password from your provider." };
  }

  const preset = AFFILIATE_EMAIL_PRESETS[provider];
  return {
    ok: true,
    input: {
      affiliateId: args.affiliateId,
      email,
      provider,
      smtpHost,
      smtpPort: port,
      secure: provider === "custom" ? port === 465 : preset.secure,
      username,
      enabled: draft.enabled,
      ...(appPassword ? { appPassword } : {}),
    },
  };
}

/** True when the form differs from what the server has saved. */
export function affiliateEmailDraftDirty(
  draft: AffiliateEmailSettingsDraft,
  saved: AffiliateEmailSettingsView | null | undefined,
): boolean {
  if (!saved) return true;
  return draft.email.trim() !== saved.email.trim()
    || draft.provider !== saved.provider
    || draft.smtpHost.trim() !== saved.smtpHost.trim()
    || Number(draft.smtpPort) !== saved.smtpPort
    || draft.username.trim() !== saved.username.trim()
    || draft.enabled !== saved.enabled
    || normalizeAppPassword(draft.appPassword).length > 0;
}

/** Status line for the panel header. */
export function affiliateEmailStatus(view: AffiliateEmailSettingsView | null | undefined): "not_configured" | "configured_disabled" | "active" {
  if (!view?.configured) return "not_configured";
  return view.enabled ? "active" : "configured_disabled";
}

export const AFFILIATE_EMAIL_STATUS_LABELS: Record<ReturnType<typeof affiliateEmailStatus>, string> = {
  not_configured: "Not set up yet",
  configured_disabled: "Set up, sending is off",
  active: "Sending is on",
};

// ─── Access ───────────────────────────────────────────────────────────────────
// The server must call this too. The dashboard hides the section, but the API
// is the real boundary: another affiliate's owner must never read or change
// these settings, even with a hand-made request.

export type AffiliateEmailActor = {
  /** "admin" is the CabinetDealz platform administrator. */
  role: string;
  /** Affiliate this login directly owns, when it owns one. */
  ownAffiliateId: number | null;
  /** Active team memberships, including owner rows. */
  memberships: { affiliateId: number; isOwner: boolean; isActive: boolean }[];
};

export type AffiliateEmailAccess = { ok: true } | { ok: false; message: string };

export function canManageAffiliateEmailSettings(
  actor: AffiliateEmailActor | null | undefined,
  affiliateId: number,
): AffiliateEmailAccess {
  if (!actor) return { ok: false, message: "Sign in to change email settings." };
  if (actor.role === "admin") return { ok: true };
  if (!Number.isInteger(affiliateId) || affiliateId <= 0) {
    return { ok: false, message: "Choose a store before changing email settings." };
  }
  if (actor.ownAffiliateId === affiliateId) return { ok: true };
  const owner = actor.memberships.find(
    (membership) => membership.affiliateId === affiliateId && membership.isOwner && membership.isActive,
  );
  if (owner) return { ok: true };
  return { ok: false, message: "Only the store owner or a CabinetDealz administrator can change these email settings." };
}

export function canViewAffiliateEmailSettings(
  actor: AffiliateEmailActor | null | undefined,
  affiliateId: number,
): AffiliateEmailAccess {
  const manage = canManageAffiliateEmailSettings(actor, affiliateId);
  if (manage.ok) return manage;
  return { ok: false, message: manage.message };
}

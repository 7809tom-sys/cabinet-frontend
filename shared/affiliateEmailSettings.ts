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
    detail: "In your Google Account, open Security, turn on 2-Step Verification, then open App passwords. Your normal Google password will not work here.",
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
      "On the same Security page, click App passwords. If you do not see it, search for App passwords in the search box at the top of the page.",
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

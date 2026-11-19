// Auto Design access rules: who may RUN an Auto Design (Tom, voice, Nov 19, 2026, 7:52 AM CT).
//
// Browsing is always open. Anyone can open the Designer, look around, and open
// the Auto Design dialog. Only the run itself (the Build action) is gated, and
// only while the gate flag is on (see client/src/lib/autoDesignAccessFlag.ts;
// default OFF so this ships dark).
//
// Identity for limits is a VERIFIED PHONE NUMBER, not an email or account.
// One free Auto Design per phone number stops people opening several free
// accounts with different emails. The same phone keys the 90-day design credit
// (shared/autoDesignCredit.ts).
//
// Pure functions only: no database, no network, no clock of their own. The
// server must enforce the same rules; anything the browser decides here is UX,
// not security.

/**
 * Pricing and limits are CONFIG, not settled policy. Tom has said both "one
 * design per phone number" (Nov 19) and "three free designs, then packs: 5 for
 * $9.99, 10 for more" (Nov 17). Defaults below follow the Nov 19 call; the
 * client can override them per environment (client/src/lib/autoDesignAccessFlag.ts)
 * and the server must use the same numbers. Packs are left empty until Tom
 * confirms them.
 */
export interface AutoDesignAccessConfig {
  /** Free Auto Design runs per verified phone before a subscription is needed. */
  freeDesignsPerPhone: number;
  /** The access / app download fee in cents. $9.99 is Tom's number. */
  accessFeeCents: number;
  /** Optional design packs (unconfirmed). */
  packs: ReadonlyArray<{ designs: number; priceCents: number }>;
}

export const DEFAULT_AUTO_DESIGN_ACCESS_CONFIG: AutoDesignAccessConfig = Object.freeze({
  freeDesignsPerPhone: 1,
  accessFeeCents: 999,
  packs: Object.freeze([]),
});

/** Default access fee ($9.99). Prefer reading the resolved config. */
export const AUTO_DESIGN_ACCESS_FEE_CENTS = DEFAULT_AUTO_DESIGN_ACCESS_CONFIG.accessFeeCents;
/** Default free runs per phone. Prefer reading the resolved config. */
export const FREE_AUTO_DESIGNS_PER_PHONE = DEFAULT_AUTO_DESIGN_ACCESS_CONFIG.freeDesignsPerPhone;

function nonNegativeInt(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Merge string/number overrides (e.g. from env) onto the defaults; bad values are ignored. */
export function resolveAutoDesignAccessConfig(overrides: { freeDesignsPerPhone?: unknown; accessFeeCents?: unknown } = {}): AutoDesignAccessConfig {
  const free = nonNegativeInt(overrides.freeDesignsPerPhone);
  const fee = nonNegativeInt(overrides.accessFeeCents);
  return {
    ...DEFAULT_AUTO_DESIGN_ACCESS_CONFIG,
    freeDesignsPerPhone: free ?? DEFAULT_AUTO_DESIGN_ACCESS_CONFIG.freeDesignsPerPhone,
    accessFeeCents: fee != null && fee > 0 ? fee : DEFAULT_AUTO_DESIGN_ACCESS_CONFIG.accessFeeCents,
  };
}

const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Same normalization as cabinet-backend server/lib/twilioVerify.ts
 * normalizePhoneE164, so a number keys the same row in both places.
 * A 10-digit number is read as U.S./Canada (+1). Returns null when invalid
 * instead of throwing, so UI code can show a message.
 */
export function normalizePhoneE164(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  const normalized = trimmed.startsWith("+")
    ? `+${digits}`
    : digits.length === 10
      ? `+1${digits}`
      : `+${digits}`;
  return E164.test(normalized) ? normalized : null;
}

export function isValidPhoneE164(value: string | null | undefined): boolean {
  return typeof value === "string" && E164.test(value);
}

export const PHONE_INPUT_ERROR =
  "Enter a valid mobile number with country code, or a 10-digit U.S./Canada mobile number.";

export interface AutoDesignAccessStatus {
  /** Signed in to a CabinetDealz account. */
  signedIn: boolean;
  /** E.164 phone that passed SMS verification for this account, or null. */
  verifiedPhoneE164: string | null;
  /** Active subscription or a paid $9.99 access fee on this phone. */
  hasActiveSubscription: boolean;
  /** Auto Design runs already recorded against this verified phone (any account). */
  runsForPhone: number;
}

export type AutoDesignRunBlockReason = "sign_in" | "verify_phone" | "subscribe";

export type AutoDesignRunDecision =
  | { allowed: true; basis: "gate_off" | "subscribed" | "free_run"; freeRunsLeftAfter: number | null }
  | { allowed: false; reason: AutoDesignRunBlockReason; message: string };

export function freeRunsLeft(runsForPhone: number, limit: number = FREE_AUTO_DESIGNS_PER_PHONE): number {
  const used = Number.isFinite(runsForPhone) && runsForPhone > 0 ? Math.floor(runsForPhone) : 0;
  return Math.max(0, limit - used);
}

/**
 * Decide whether the Build action may run.
 * Order: gate off -> allowed; not signed in -> sign in; no verified phone ->
 * verify phone; subscribed -> allowed; free runs left on this phone -> allowed;
 * otherwise -> subscribe.
 */
export function decideAutoDesignRun(
  gateEnabled: boolean,
  status: AutoDesignAccessStatus | null | undefined,
  config: AutoDesignAccessConfig = DEFAULT_AUTO_DESIGN_ACCESS_CONFIG,
): AutoDesignRunDecision {
  if (!gateEnabled) return { allowed: true, basis: "gate_off", freeRunsLeftAfter: null };
  if (!status || !status.signedIn) {
    return { allowed: false, reason: "sign_in", message: "Sign in to run Auto Design. You can keep browsing the Designer without an account." };
  }
  if (!isValidPhoneE164(status.verifiedPhoneE164)) {
    return { allowed: false, reason: "verify_phone", message: config.freeDesignsPerPhone > 0
      ? `Verify your mobile number to run Auto Design. ${freeDesignsPhrase(config.freeDesignsPerPhone)} per phone number.`
      : "Verify your mobile number to run Auto Design." };
  }
  if (status.hasActiveSubscription) return { allowed: true, basis: "subscribed", freeRunsLeftAfter: null };
  const left = freeRunsLeft(status.runsForPhone, config.freeDesignsPerPhone);
  if (left > 0) return { allowed: true, basis: "free_run", freeRunsLeftAfter: left - 1 };
  return {
    allowed: false,
    reason: "subscribe",
    message: config.freeDesignsPerPhone > 0
      ? `You've used the free Auto Design for this phone number. Subscribe for ${formatUsd(config.accessFeeCents)} to keep designing.`
      : `Subscribe for ${formatUsd(config.accessFeeCents)} to run Auto Design.`,
  };
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function freeDesignsPhrase(n: number): string {
  return n === 1 ? "One free Auto Design" : `${n} free Auto Designs`;
}

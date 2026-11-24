// ─── AI follow-up outreach: shared settings, sequence and stage rules ─────────
// The server is the source of truth; the admin UI imports these for labels and
// form defaults. Nothing here sends anything.

export const OUTREACH_MODES = ["preview", "approval", "auto"] as const;
export type OutreachMode = (typeof OUTREACH_MODES)[number];

export const OUTREACH_MODE_LABELS: Record<OutreachMode, string> = {
  preview: "Preview only: drafts are saved, nothing is sent",
  approval: "Approval queue: each draft waits for you to approve it",
  auto: "Automatic: drafts send on schedule, within the caps",
};

export type OutreachStep = {
  /** Stable key, e.g. "reintroduction". */
  key: string;
  label: string;
  /** Days after the previous step (or after enrolment, for step 1). */
  delayDays: number;
  /** What this email is for, given to the AI as its brief. */
  goal: string;
  /**
   * Optional offer text Tom writes himself (e.g. "free design consultation").
   * The AI may only mention an offer if it is written here, word for word.
   * Empty = no offer is mentioned.
   */
  offerText: string;
};

export const DEFAULT_OUTREACH_SEQUENCE: readonly OutreachStep[] = [
  {
    key: "reintroduction",
    label: "Re-introduction",
    delayDays: 0,
    goal: "Reconnect with a past customer, say CabinetDealz now has an online kitchen designer, and invite them to try it if they are planning a project.",
    offerText: "",
  },
  {
    key: "follow_up",
    label: "Follow-up",
    delayDays: 7,
    goal: "A short, friendly follow-up to the first note. Offer to help if they have a kitchen, bath or cabinet project coming up, and invite a reply with any question.",
    offerText: "",
  },
  {
    key: "seasonal",
    label: "Seasonal note",
    delayDays: 21,
    goal: "A brief seasonal check-in (use the current season). Mention the offer only if one is provided; otherwise just invite them to start a design when they are ready.",
    offerText: "",
  },
];

export const OUTREACH_CAP_LIMITS = {
  dailyCapMax: 500,
  perContactCapMax: 6,
  maxSteps: 6,
  maxDelayDays: 365,
} as const;

export type OutreachSettings = {
  enabled: boolean;
  mode: OutreachMode;
  dailyCap: number;
  perContactCap: number;
  senderName: string;
  sequence: OutreachStep[];
};

export const DEFAULT_OUTREACH_SETTINGS: OutreachSettings = {
  enabled: false,
  mode: "preview",
  dailyCap: 25,
  perContactCap: 3,
  senderName: "Tom at CabinetDealz",
  sequence: DEFAULT_OUTREACH_SEQUENCE.map((step) => ({ ...step })),
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function text(value: unknown, max: number, fallback = ""): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : fallback;
}

/** Repairs a stored sequence; an empty or broken one falls back to the default. */
export function normalizeOutreachSequence(raw: unknown): OutreachStep[] {
  const list = Array.isArray(raw) ? raw : [];
  const steps = list.slice(0, OUTREACH_CAP_LIMITS.maxSteps).flatMap((item, index): OutreachStep[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const label = text(record.label, 64);
    const goal = text(record.goal, 600);
    if (!label || !goal) return [];
    return [{
      key: text(record.key, 48) || `step_${index + 1}`,
      label,
      delayDays: clampInt(record.delayDays, 0, OUTREACH_CAP_LIMITS.maxDelayDays, index === 0 ? 0 : 7),
      goal,
      offerText: text(record.offerText, 200),
    }];
  });
  return steps.length ? steps : DEFAULT_OUTREACH_SEQUENCE.map((step) => ({ ...step }));
}

export function normalizeOutreachSettings(raw: Partial<Record<keyof OutreachSettings, unknown>> | null | undefined): OutreachSettings {
  if (!raw) return { ...DEFAULT_OUTREACH_SETTINGS, sequence: normalizeOutreachSequence(null) };
  const mode = OUTREACH_MODES.includes(raw.mode as OutreachMode) ? (raw.mode as OutreachMode) : "preview";
  let sequence: unknown = raw.sequence;
  if (typeof sequence === "string") {
    try { sequence = JSON.parse(sequence); } catch { sequence = null; }
  }
  return {
    enabled: raw.enabled === true || raw.enabled === 1,
    mode,
    dailyCap: clampInt(raw.dailyCap, 0, OUTREACH_CAP_LIMITS.dailyCapMax, DEFAULT_OUTREACH_SETTINGS.dailyCap),
    perContactCap: clampInt(raw.perContactCap, 1, OUTREACH_CAP_LIMITS.perContactCapMax, DEFAULT_OUTREACH_SETTINGS.perContactCap),
    senderName: text(raw.senderName, 128) || DEFAULT_OUTREACH_SETTINGS.senderName,
    sequence: normalizeOutreachSequence(sequence),
  };
}

/**
 * CRM stage movement from outreach signals. Moves forward only and never
 * touches a deal that is already quoted, won, lost or in image review.
 */
const STAGE_RANK: Record<string, number> = { new: 0, new_sale: 0, contacted: 1, qualified: 2 };
export type OutreachSignal = "click" | "design_start" | "reply";
const SIGNAL_TARGET: Record<OutreachSignal, "contacted" | "qualified"> = {
  click: "contacted",
  reply: "contacted",
  design_start: "qualified",
};

export function outreachStageAdvance(current: string, signal: OutreachSignal): "contacted" | "qualified" | null {
  const from = STAGE_RANK[current];
  if (from == null) return null;
  const target = SIGNAL_TARGET[signal];
  return STAGE_RANK[target] > from ? target : null;
}

export const OUTREACH_ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Finished sequence",
  replied: "Replied (stopped)",
  unsubscribed: "Unsubscribed",
  bounced: "Bounced",
  needs_owner: "Needs Tom (asked a question)",
  stopped: "Stopped",
};

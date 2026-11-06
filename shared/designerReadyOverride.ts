/**
 * The admin designer-visibility override: a tri-state, not a boolean.
 *
 * The catalog's own answer (`effectiveDesignerEligible`) is still the default.
 * An administrator can replace it in either direction:
 *
 *   null / "auto"  → use the catalog's rules (the normal case)
 *   "ready"        → FORCED READY. Clears the red flag on an item the rules would
 *                    refuse, e.g. one whose dimensions can be derived from its SKU.
 *   "off"          → FORCED OFF. Hides a perfectly valid item from the 3D Designer
 *                    and auto-design, e.g. a cabinet out of stock for months.
 *
 * Both directions record who and when, and both are reversible with "Reset to
 * automatic", which simply nulls the override so the catalog decides again.
 *
 * Why a tri-state and not a boolean: a boolean cannot express "this looks fine
 * but do not offer it", and worse, `false` is indistinguishable from "no
 * override", so turning an item off would silently fall back to automatic.
 *
 * "Off" can carry a reason and a "back in stock" date. With a date the item
 * returns to automatic by itself — evaluated at read time, so no cron is needed
 * and the answer is correct the instant the date passes.
 */

import {
  cabinetCanBeRenderedOrPlacedIn3d,
  designerEligibilityDecision,
  positiveDesignerMeasure,
  type DesignerCabinetShape,
} from "./designerEligibility";
import { cabinetSkuDimensions } from "./cabinetSkuDimensions";

/** Stored as ENUM('ready','off') NULL. Only these two values mean "overridden". */
export type DesignerReadyOverrideState = "ready" | "off";

export const DESIGNER_OVERRIDE_READY: DesignerReadyOverrideState = "ready";
export const DESIGNER_OVERRIDE_OFF: DesignerReadyOverrideState = "off";

export type DesignerReadyOverride = {
  designerReadyOverride?: DesignerReadyOverrideState | string | null;
  designerReadyOverrideBy?: string | null;
  designerReadyOverrideAt?: string | Date | null;
  /** Set when an admin approved an item whose dimensions were derived from the SKU. */
  designerReadyDerivedFrom?: string | null;
  /** Why it was turned off — free text, defaults to "Out of stock". */
  designerOffReason?: string | null;
  /** When it should come back automatically. Null means "until an admin resets it". */
  designerOffUntil?: string | Date | null;
};

export type DesignerReadyCabinet = DesignerCabinetShape & DesignerReadyOverride & {
  /** The stored catalog flag, before any override. */
  designerEligible?: boolean | null;
  id?: number | null;
  masterCode?: string | null;
};

export type DimensionSource = "catalog" | "derived";

export type DerivedDimensions = {
  width: number;
  height: number;
  depth: number;
  /** The code the values came from, e.g. "W3024". */
  from: string;
};

/** The override in force right now: "ready", "off", or null for automatic. */
export type ActiveOverride = DesignerReadyOverrideState | null;

export const DEFAULT_DESIGNER_OFF_REASON = "Out of stock";

function text(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/** The raw stored value normalised to the two legal states, or null. */
export function normaliseOverrideState(value: unknown): ActiveOverride {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "ready") return DESIGNER_OVERRIDE_READY;
  if (raw === "off") return DESIGNER_OVERRIDE_OFF;
  return null;
}

function asDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A back-in-stock value is a CALENDAR DATE, not an instant. "2027-08-01" means
 * August 1 wherever the reader is; parsing it as midnight UTC and comparing
 * instants would make the item return the evening of July 31 in Central time.
 *
 * Returns the date as `YYYY-MM-DD`, or null when there is nothing usable.
 */
export function designerOffUntilDate(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
  }
  const date = asDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

/** Today's Central calendar date as `YYYY-MM-DD`. */
export function centralToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * True when the back-in-stock date has arrived. Compared as calendar dates in
 * Central time, so the item returns on the date that was entered — evaluated on
 * read, so no cron is needed.
 */
export function designerOffUntilReached(value: string | Date | null | undefined, now: Date = new Date()): boolean {
  const until = designerOffUntilDate(value);
  if (!until) return false;
  return until <= centralToday(now);
}

/**
 * The override in force at `now`.
 *
 * A forced-off item whose `designerOffUntil` has passed is back to automatic —
 * the stored row is left alone, so the history of when it was turned off is
 * preserved and the decision is simply re-evaluated on every read.
 */
export function activeDesignerOverride(
  cabinet: DesignerReadyOverride,
  now: Date = new Date(),
): ActiveOverride {
  const stored = normaliseOverrideState(cabinet.designerReadyOverride);
  if (stored !== DESIGNER_OVERRIDE_OFF) return stored;
  if (designerOffUntilReached(cabinet.designerOffUntil, now)) return null;
  return DESIGNER_OVERRIDE_OFF;
}

/** True when the item was turned off and its return date has passed. */
export function designerOffExpired(cabinet: DesignerReadyOverride, now: Date = new Date()): boolean {
  if (normaliseOverrideState(cabinet.designerReadyOverride) !== DESIGNER_OVERRIDE_OFF) return false;
  return designerOffUntilReached(cabinet.designerOffUntil, now);
}

/** True when an administrator approved this item by hand. */
export function hasDesignerReadyOverride(cabinet: DesignerReadyOverride, now: Date = new Date()): boolean {
  return activeDesignerOverride(cabinet, now) === DESIGNER_OVERRIDE_READY;
}

/** True when an administrator hid this item from the Designer. */
export function isDesignerTurnedOff(cabinet: DesignerReadyOverride, now: Date = new Date()): boolean {
  return activeDesignerOverride(cabinet, now) === DESIGNER_OVERRIDE_OFF;
}

/**
 * The flag to act on: the override wins, otherwise the catalog's own value.
 * "Reset to automatic" therefore restores the real eligibility instead of false.
 */
export function effectiveDesignerEligible(cabinet: DesignerReadyCabinet, now: Date = new Date()): boolean {
  const override = activeDesignerOverride(cabinet, now);
  if (override === DESIGNER_OVERRIDE_READY) return true;
  if (override === DESIGNER_OVERRIDE_OFF) return false;
  return cabinet.designerEligible === true;
}

/**
 * Whether the item appears in the Designer palette and auto-design. Same rule as
 * `effectiveDesignerEligible`, named for the call sites that filter a product
 * list, and it always reads the override first so "off" really is off.
 */
export function isOfferedInDesigner(cabinet: DesignerReadyCabinet, now: Date = new Date()): boolean {
  return effectiveDesignerEligible(cabinet, now);
}

/**
 * Why the item is flagged in the catalog's own words. This is what the admin sees
 * before overriding. A forced-off item is not "flagged by the rules" — it was
 * turned off deliberately, so that is said instead.
 */
export function designerFlagReason(
  cabinet: DesignerReadyCabinet,
  hasPublishedPrice = true,
  now: Date = new Date(),
): string {
  if (isDesignerTurnedOff(cabinet, now)) {
    const reason = text(cabinet.designerOffReason) || DEFAULT_DESIGNER_OFF_REASON;
    const until = designerOffUntilDate(cabinet.designerOffUntil);
    return until ? `turned off by an administrator: ${reason} until ${until}` : `turned off by an administrator: ${reason}`;
  }
  return designerEligibilityDecision(cabinet, hasPublishedPrice).reason;
}

export type OverrideEligibility = {
  blocked: boolean;
  /** Why it is blocked, naming the missing field. Null when allowed. */
  reason: string | null;
  dimensions: { width: number; height: number; depth: number };
  source: DimensionSource;
  derived: DerivedDimensions | null;
  missing: readonly ("width" | "height" | "depth")[];
};

/**
 * Dimensions to hand the Designer, and where they came from.
 *
 * The catalog columns win. Only when width, height OR depth is unusable do we
 * try the SKU, and only an unambiguous parse is accepted — the same parser the
 * Designer itself uses, so a derived box matches what the plan will build.
 */
export function resolveDesignerDimensions(cabinet: DesignerReadyCabinet): OverrideEligibility {
  const missing: Array<"width" | "height" | "depth"> = [];
  if (!positiveDesignerMeasure(cabinet.width)) missing.push("width");
  if (!positiveDesignerMeasure(cabinet.height)) missing.push("height");
  if (!positiveDesignerMeasure(cabinet.depth)) missing.push("depth");

  const parse = missing.length > 0 ? cabinetSkuDimensions(cabinet.masterCode) : null;
  const derived: DerivedDimensions | null = parse
    ? { ...parse, from: text(cabinet.masterCode).toUpperCase() }
    : null;

  const num = (value: string | number | null | undefined, fallback: number | null): number =>
    positiveDesignerMeasure(value) ? Number(value) : (fallback ?? 0);

  const dimensions = {
    width: num(cabinet.width, derived?.width ?? null),
    height: num(cabinet.height, derived?.height ?? null),
    depth: num(cabinet.depth, derived?.depth ?? null),
  };

  const stillMissing = (["width", "height", "depth"] as const)
    .filter((field) => !(dimensions[field] > 0));

  if (stillMissing.length > 0) {
    return {
      blocked: true,
      reason: `${stillMissing.join(", ")} ${stillMissing.length === 1 ? "is" : "are"} missing and ${cabinet.masterCode ? `"${cabinet.masterCode}" cannot be parsed` : "there is no SKU to parse"}. Fill the catalog dimensions first.`,
      dimensions,
      source: "catalog",
      derived: null,
      missing: stillMissing,
    };
  }

  return {
    blocked: false,
    reason: null,
    dimensions,
    source: missing.length > 0 ? "derived" : "catalog",
    derived: missing.length > 0 ? derived : null,
    missing: [],
  };
}

export type OverrideAction = "ready" | "off" | "reset";

export type OverrideDecision =
  | {
    allowed: true;
    action: OverrideAction;
    /** Only meaningful for "ready". */
    dimensions: OverrideEligibility["dimensions"];
    source: DimensionSource;
    derived: DerivedDimensions | null;
    note: string;
  }
  | { allowed: false; reason: string };

/**
 * Whether an administrator may make this change, and what it will do.
 *
 * `role` is checked here as well as on the server: the controls are admin-only,
 * and returning "not allowed" for anyone else means a stray call cannot produce
 * an approval note.
 */
export function designerOverrideDecision(
  cabinet: DesignerReadyCabinet,
  action: OverrideAction,
  opts: { role: string | null | undefined; hasPublishedPrice?: boolean; now?: Date },
): OverrideDecision {
  const now = opts.now ?? new Date();
  if (opts.role !== "admin") {
    return { allowed: false, reason: "Only an administrator can change Designer availability." };
  }
  const current = activeDesignerOverride(cabinet, now);

  if (action === "reset") {
    if (current == null) return { allowed: false, reason: "This item is already on automatic." };
    return {
      allowed: true,
      action,
      dimensions: { width: 0, height: 0, depth: 0 },
      source: "catalog",
      derived: null,
      note: "Back to the catalog's own rules.",
    };
  }

  if (action === "off") {
    if (current === DESIGNER_OVERRIDE_OFF) return { allowed: false, reason: "This item is already turned off." };
    // Turning something off never needs dimensions: the Designer simply stops
    // offering it. That is the point of the control.
    return {
      allowed: true,
      action,
      dimensions: { width: 0, height: 0, depth: 0 },
      source: "catalog",
      derived: null,
      note: "Hidden from the 3D Designer and auto-design. Saved designs keep it.",
    };
  }

  // "ready"
  if (current === DESIGNER_OVERRIDE_READY) {
    return { allowed: false, reason: "This item is already available in the 3D Designer." };
  }
  if (opts.hasPublishedPrice === false) {
    return {
      allowed: false,
      reason: `Approving the flag will not put this in the Designer yet: ${designerEligibilityDecision(cabinet, false).reason}. Fix the price first.`,
    };
  }

  const geometry = resolveDesignerDimensions(cabinet);
  if (geometry.blocked) return { allowed: false, reason: geometry.reason ?? "Dimensions are missing." };

  const placeable = cabinetCanBeRenderedOrPlacedIn3d({
    ...cabinet,
    width: geometry.dimensions.width,
    height: geometry.dimensions.height,
    depth: geometry.dimensions.depth,
  });
  if (!placeable) {
    return { allowed: false, reason: "The Designer cannot build a box for this item type, so approving it would not make it usable." };
  }

  return {
    allowed: true,
    action,
    dimensions: geometry.dimensions,
    source: geometry.source,
    derived: geometry.derived,
    note: geometry.derived
      ? `Dimensions ${geometry.dimensions.width}″ × ${geometry.dimensions.height}″ × ${geometry.dimensions.depth}″ derived from ${geometry.derived.from}`
      : `Using the catalog dimensions ${geometry.dimensions.width}″ × ${geometry.dimensions.height}″ × ${geometry.dimensions.depth}″`,
  };
}

/** Backwards-compatible name for the "ready" case. */
export function designerReadyOverrideDecision(
  cabinet: DesignerReadyCabinet,
  opts: { role: string | null | undefined; hasPublishedPrice?: boolean; now?: Date },
): OverrideDecision {
  return designerOverrideDecision(cabinet, "ready", opts);
}

function actorLabel(actor: { name?: string | null; email?: string | null }): string {
  const name = text(actor.name);
  const email = text(actor.email);
  if (name && email) return `${name} <${email}>`.slice(0, 255);
  return (name || email || "admin").slice(0, 255);
}

/** The values to store for "forced ready". */
export function designerReadyOverridePayload(
  decision: Extract<OverrideDecision, { allowed: true }>,
  actor: { name?: string | null; email?: string | null },
  now: Date = new Date(),
): {
  designerReadyOverride: DesignerReadyOverrideState;
  designerReadyOverrideBy: string;
  designerReadyOverrideAt: string;
  designerReadyDerivedFrom: string | null;
  designerOffReason: null;
  designerOffUntil: null;
  width: number | null;
  height: number | null;
  depth: number | null;
} {
  return {
    designerReadyOverride: DESIGNER_OVERRIDE_READY,
    designerReadyOverrideBy: actorLabel(actor),
    designerReadyOverrideAt: now.toISOString(),
    designerReadyDerivedFrom: decision.derived?.from ?? null,
    designerOffReason: null,
    designerOffUntil: null,
    // Persist derived dimensions so the Designer has a real box immediately.
    width: decision.source === "derived" ? decision.dimensions.width : null,
    height: decision.source === "derived" ? decision.dimensions.height : null,
    depth: decision.source === "derived" ? decision.dimensions.depth : null,
  };
}

/** The values to store for "forced off", with the optional reason and return date. */
export function designerOffPayload(
  input: { reason?: string | null; until?: string | Date | null },
  actor: { name?: string | null; email?: string | null },
  now: Date = new Date(),
): {
  designerReadyOverride: DesignerReadyOverrideState;
  designerReadyOverrideBy: string;
  designerReadyOverrideAt: string;
  designerOffReason: string;
  designerOffUntil: string | null;
} {
  const reason = text(input.reason) || DEFAULT_DESIGNER_OFF_REASON;
  // Stored as a calendar date (YYYY-MM-DD). A date already reached would put the
  // item straight back on, which is not what "turn it off" means, so it is
  // dropped rather than stored — the caller can still see the reason.
  const until = designerOffUntilDate(input.until);
  return {
    designerReadyOverride: DESIGNER_OVERRIDE_OFF,
    designerReadyOverrideBy: actorLabel(actor),
    designerReadyOverrideAt: now.toISOString(),
    designerOffReason: reason.slice(0, 255),
    designerOffUntil: until && until > centralToday(now) ? until : null,
  };
}

/** The values to store for "reset to automatic". */
export function designerReadyUndoPayload(): {
  designerReadyOverride: null;
  designerReadyOverrideBy: null;
  designerReadyOverrideAt: null;
  designerReadyDerivedFrom: null;
  designerOffReason: null;
  designerOffUntil: null;
} {
  return {
    designerReadyOverride: null,
    designerReadyOverrideBy: null,
    designerReadyOverrideAt: null,
    designerReadyDerivedFrom: null,
    designerOffReason: null,
    designerOffUntil: null,
  };
}

/** "Off: Out of stock until Nov 5, 2026" — the line under a turned-off item. */
export function designerOffLabel(
  cabinet: DesignerReadyOverride,
  formatDate: (value: string | Date | null | undefined) => string | null,
  now: Date = new Date(),
): string | null {
  if (!isDesignerTurnedOff(cabinet, now)) return null;
  const reason = text(cabinet.designerOffReason) || DEFAULT_DESIGNER_OFF_REASON;
  // Format the calendar date, so a value stored as a timestamp still reads as the
  // day it was entered rather than the evening before.
  const untilDate = designerOffUntilDate(cabinet.designerOffUntil);
  const until = untilDate ? formatDate(untilDate) : null;
  return until ? `Off: ${reason} until ${until}` : `Off: ${reason}`;
}

/** "Manually approved by Dana · Nov 5, 2026" — the line under an approved item. */
export function designerReadyOverrideNote(
  cabinet: DesignerReadyOverride,
  formatWhen: (value: string | Date | null | undefined) => string | null,
  now: Date = new Date(),
): string | null {
  if (!hasDesignerReadyOverride(cabinet, now)) return null;
  const by = text(cabinet.designerReadyOverrideBy);
  const name = by.includes("<") ? by.slice(0, by.indexOf("<")).trim() || by : by;
  const when = formatWhen(cabinet.designerReadyOverrideAt);
  const who = name || "an administrator";
  return when ? `Manually approved by ${who} · ${when}` : `Manually approved by ${who}`;
}

/** "Turned off by Dana · Nov 5, 2026" — who hid it and when. */
export function designerOffAttribution(
  cabinet: DesignerReadyOverride,
  formatWhen: (value: string | Date | null | undefined) => string | null,
  now: Date = new Date(),
): string | null {
  if (!isDesignerTurnedOff(cabinet, now)) return null;
  const by = text(cabinet.designerReadyOverrideBy);
  const name = by.includes("<") ? by.slice(0, by.indexOf("<")).trim() || by : by;
  const when = formatWhen(cabinet.designerReadyOverrideAt);
  const who = name || "an administrator";
  return when ? `Turned off by ${who} · ${when}` : `Turned off by ${who}`;
}

/**
 * A saved design that already contains this item keeps it, but flags it as
 * unavailable so the plan is not silently changed under the customer.
 */
export function savedDesignItemAvailability(
  cabinet: DesignerReadyCabinet,
  now: Date = new Date(),
): { available: boolean; label: string | null } {
  if (isDesignerTurnedOff(cabinet, now)) {
    const reason = text(cabinet.designerOffReason) || DEFAULT_DESIGNER_OFF_REASON;
    return { available: false, label: `Unavailable — ${reason}` };
  }
  if (cabinet.designerEligible !== true && activeDesignerOverride(cabinet, now) == null) {
    return { available: false, label: "Unavailable — not designer ready" };
  }
  return { available: true, label: null };
}

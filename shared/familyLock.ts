// Family-lock rule (pure, testable).
//
// Business rule: a single order must stay within ONE cabinet family — i.e. one
// door style (styleId) sourced from one supply line (distributorId). Mixing
// families on a single order forces multiple shipments and breaks pricing/finish
// consistency, so the backend rejects it.
//
// Only *matched, priced* lines are constrained: a line with no resolved styleId
// (e.g. an unmatched OCR line still in review) does not break the lock — it
// simply isn't covered yet. The order-level styleId, when supplied, defines the
// canonical family every priced line must agree with.

export interface FamilyLockLine {
  /** Resolved door-style id for this line, or null if not yet matched/priced. */
  styleId?: number | null;
  /** Optional human label, used only for error messages. */
  masterCode?: string | null;
}

export interface FamilyLockResult {
  ok: boolean;
  /** The single styleId the order is locked to, when resolvable. */
  styleId: number | null;
  /** Distinct styleIds seen across priced lines (sorted ascending). */
  distinctStyleIds: number[];
  /** Human-readable reason when ok = false. */
  reason?: string;
}

/**
 * Validate that every priced line in an order belongs to one door-style family.
 *
 * @param lines         order lines (each may carry a styleId once priced)
 * @param orderStyleId  optional order-level family the lines must match
 */
export function validateFamilyLock(
  lines: FamilyLockLine[],
  orderStyleId?: number | null
): FamilyLockResult {
  const styleIds = lines
    .map((l) => (l.styleId == null ? null : Number(l.styleId)))
    .filter((s): s is number => s != null && Number.isFinite(s));

  const distinct = Array.from(new Set(styleIds)).sort((a, b) => a - b);

  // No priced line carries a style yet — nothing to enforce. Lock to the
  // order-level style if one was provided.
  if (distinct.length === 0) {
    return {
      ok: true,
      styleId: orderStyleId ?? null,
      distinctStyleIds: [],
    };
  }

  // More than one style across priced lines → mixed family, reject.
  if (distinct.length > 1) {
    return {
      ok: false,
      styleId: null,
      distinctStyleIds: distinct,
      reason:
        "An order must stay within a single door-style family. " +
        `This order mixes ${distinct.length} different styles (ids: ${distinct.join(", ")}). ` +
        "Please split it into one order per door style.",
    };
  }

  const single = distinct[0];

  // If the order declares a family, every priced line must match it.
  if (orderStyleId != null && Number(orderStyleId) !== single) {
    return {
      ok: false,
      styleId: null,
      distinctStyleIds: distinct,
      reason:
        `Line items belong to door style ${single}, ` +
        `but the order is set to style ${orderStyleId}. ` +
        "All items must share one door-style family.",
    };
  }

  return { ok: true, styleId: single, distinctStyleIds: distinct };
}

// ─────────────────────────────────────────────────────────────────────────────
// Add-time family-lock decision (pure, testable).
//
// SCOPE = DISTRIBUTOR (supply line), NOT a single door style/color.
//
// Mixing colors (and door styles) in one design/order is a first-class feature:
// two-tone kitchens (e.g. a white perimeter + a contrasting island, or a
// completely different color on the wall cabinets than the base cabinets) are
// very common. So the cart must NOT block an item just because its color/style
// differs from what's already in it. "Lock" in the UI means "I'm done with this
// color, let me pick another" — a commit-and-continue action, not a restriction.
//
// The ONE thing we still enforce is that every line comes from the SAME
// distributor (supply line); cross-distributor mixing would break pricing,
// freight and ordering, so that is rejected. An empty cart (lockedDistributorId
// == null) accepts anything and sets the lock; once set, only items from that
// same distributor are accepted. Items with an unknown distributor (null) are
// always allowed (they carry no constraint).
// ─────────────────────────────────────────────────────────────────────────────
export interface CanAddResult {
  ok: boolean;
  /** True only when the cart already holds a DIFFERENT distributor. */
  blockedByLock: boolean;
}

export function canAddToCart(
  lockedDistributorId: number | null | undefined,
  incomingDistributorId: number | null | undefined
): CanAddResult {
  // Cart empty / no lock yet — anything is allowed and sets the lock.
  if (lockedDistributorId == null) return { ok: true, blockedByLock: false };
  // Incoming item has no distributor constraint — always allowed.
  if (incomingDistributorId == null) return { ok: true, blockedByLock: false };
  if (Number(lockedDistributorId) === Number(incomingDistributorId)) {
    return { ok: true, blockedByLock: false };
  }
  return { ok: false, blockedByLock: true };
}
